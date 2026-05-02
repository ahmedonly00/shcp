import React, { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { Input } from '@/app/components/ui/input';
import { Textarea } from '@/app/components/ui/textarea';
import {
  Video, VideoOff, Mic, MicOff, PhoneOff, MessageSquare,
  FileText, Clock, User, Maximize, Loader2, WifiOff, Calendar as CalendarIcon, Monitor, MonitorOff,
  Circle, Square, Send, Zap, Star, Building2, ChevronLeft, ToggleLeft, ToggleRight,
  Plus, Trash2, Pill, CheckCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { consultationsApi } from '@/app/api/consultations';
import { patientsApi } from '@/app/api/patients';
import { providersApi } from '@/app/api/providers';
import { referralsApi } from '@/app/api/referrals';
import { prescriptionsApi, MedicationItem } from '@/app/api/prescriptions';
import { ApiConsultationDto, ApiHealthRecordDto, ApiInstantAvailableProvider, ApiPrescriptionDto, ApiSymptomReport, Appointment, mapApiAppointment, isAppointmentExpired } from '@/app/types';
import { useAuth } from '@/app/context/AuthContext';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/app/components/ui/dialog';

const SIGNALING_URL = import.meta.env.VITE_SIGNALING_URL ?? 'http://localhost:3001';

// Public Google STUN as absolute fallback (no TURN = P2P only, may fail on strict networks)
const STUN_ONLY_CONFIG: RTCConfiguration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
};

/**
 * Fetches short-lived TURN credentials from the backend.
 * The backend generates HMAC-SHA1 time-limited tokens (4 h TTL) using the
 * shared coturn secret — no static credentials in the frontend bundle.
 * Falls back to STUN-only if the backend is unreachable.
 */
async function fetchIceServers(consultationId: string): Promise<RTCConfiguration> {
  try {
    const creds = await consultationsApi.getTurnCredentials(consultationId);
    return { iceServers: creds.iceServers as RTCIceServer[] };
  } catch {
    return STUN_ONLY_CONFIG;
  }
}

// Bitrate + resolution targets per network quality level (1=poor … 4=excellent).
// Used by the adaptive-bitrate effect below.
const QUALITY_PROFILES = [
  null,                                                    // 0 — unknown, no change
  { maxBitrate: 150_000,  width: 426,  height: 240 },    // 1 — poor  (240p)
  { maxBitrate: 400_000,  width: 640,  height: 360 },    // 2 — fair  (360p)
  { maxBitrate: 800_000,  width: 854,  height: 480 },    // 3 — good  (480p)
  { maxBitrate: 1_500_000, width: 1280, height: 720 },   // 4 — excellent (720p)
] as const;

const RX_TEMPLATES: Record<string, MedicationItem[]> = {
  'Common Cold': [
    { name: 'Paracetamol', dosage: '500mg', frequency: 'Every 6 hours', durationDays: 5 },
    { name: 'Vitamin C',   dosage: '1000mg', frequency: 'Once daily',   durationDays: 7 },
  ],
  'Headache':    [{ name: 'Ibuprofen',   dosage: '400mg', frequency: 'Every 8 hours',          durationDays: 3 }],
  'Allergies':   [{ name: 'Cetirizine',  dosage: '10mg',  frequency: 'Once daily',              durationDays: 14 }],
  'Hypertension':[{ name: 'Amlodipine',  dosage: '5mg',   frequency: 'Once daily',              durationDays: 30 }],
  'Diabetes':    [{ name: 'Metformin',   dosage: '500mg', frequency: 'Twice daily with meals',  durationDays: 30 }],
  'Pain Relief': [
    { name: 'Diclofenac', dosage: '50mg', frequency: 'Every 8 hours', durationDays: 5 },
    { name: 'Omeprazole', dosage: '20mg', frequency: 'Once daily',     durationDays: 5 },
  ],
};

type Phase = 'waiting' | 'connecting' | 'lobby' | 'active' | 'ended';

/** A patient waiting in the provider's lobby */
interface WaitingPatient { userId: string; socketId: string; }
type ChatMessage = { sender: string; message: string; time: string };

interface TeleconsultationProps {
  appointment?: Appointment;
}

export const Teleconsultation: React.FC<TeleconsultationProps> = ({ appointment: appointmentProp }) => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const isProvider = user?.role === 'doctor';

  // If no appointment was passed (direct navigation), let user pick one
  const [activeAppointment, setActiveAppointment] = useState<Appointment | undefined>(appointmentProp);
  const [myAppointments, setMyAppointments] = useState<Appointment[]>([]);
  const [loadingAppointments, setLoadingAppointments] = useState(false);

  // Load appointments when no appointment prop is passed
  useEffect(() => {
    if (appointmentProp) { setActiveAppointment(appointmentProp); return; }
    setLoadingAppointments(true);
    const fetch = isProvider
      ? providersApi.getMyAppointments(0, 50)
      : patientsApi.getMyAppointments(0, 50);
    fetch
      .then(list => setMyAppointments((list ?? []).map(mapApiAppointment).filter(
        a => (a.status === 'in-progress' || a.status === 'scheduled') && !isAppointmentExpired(a)
      )))
      .catch(() => {})
      .finally(() => setLoadingAppointments(false));
  }, [appointmentProp, isProvider]);

  // Use whichever appointment is active
  const appointment = activeAppointment;

  const [phase, setPhase] = useState<Phase>('waiting');
  const phaseRef = useRef<Phase>('waiting');
  const updatePhase = (p: Phase) => { phaseRef.current = p; setPhase(p); };
  const connectionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const peerJoinTimeoutRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { sender: 'System', message: 'Please wait while the connection is established.', time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) },
  ]);
  const [newMessage, setNewMessage] = useState('');
  const [consultationNotes, setConsultationNotes] = useState('');
  const [callDuration, setCallDuration] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');
  const [peerConnected, setPeerConnected] = useState(false);
  const [screenSharing, setScreenSharing] = useState(false);
  const screenStreamRef = useRef<MediaStream | null>(null);

  // ── Stream state — stored so effects can re-apply them when video elements mount ──
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  // ── New feature states ─────────────────────────────────────────────────────
  const [networkQuality, setNetworkQuality] = useState<0|1|2|3|4>(0); // 0=unknown,1=poor,4=excellent
  const [recording, setRecording] = useState(false);
  const [showConsentDialog, setShowConsentDialog] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'patient' | 'referral' | 'prescription'>('chat');

  // ── Instant consult state ─────────────────────────────────────────────────
  const [showInstantPanel, setShowInstantPanel] = useState(false);
  const [instantProviders, setInstantProviders] = useState<ApiInstantAvailableProvider[]>([]);
  const [loadingInstantProviders, setLoadingInstantProviders] = useState(false);
  const [startingInstant, setStartingInstant] = useState(false);
  const [instantAvailable, setInstantAvailable] = useState<boolean | null>(null);
  const [togglingInstant, setTogglingInstant] = useState(false);
  const [incomingInstant, setIncomingInstant] = useState<ApiConsultationDto | null>(null);
  const instantPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Waiting room (provider side) ──────────────────────────────────────────
  const [waitingPatients, setWaitingPatients] = useState<WaitingPatient[]>([]);

  // ── Referral form state (provider-only) ─────────────────────────────────
  const [referralType, setReferralType] = useState<'INTERNAL' | 'EXTERNAL'>('EXTERNAL');
  const [referralSpecialtyNeeded, setReferralSpecialtyNeeded] = useState('');
  const [referralReason, setReferralReason] = useState('');
  const [referralUrgency, setReferralUrgency] = useState<'ROUTINE' | 'URGENT' | 'EMERGENCY'>('ROUTINE');
  const [referralNotes, setReferralNotes] = useState('');
  const [referralTreatmentType, setReferralTreatmentType] = useState('');
  const [referralInstitutionName, setReferralInstitutionName] = useState('');
  const [referralInstitutionType, setReferralInstitutionType] = useState('');
  const [referralInstitutionAddress, setReferralInstitutionAddress] = useState('');
  const [referralInstitutionContact, setReferralInstitutionContact] = useState('');
  const [submittingReferral, setSubmittingReferral] = useState(false);
  const [referralSent, setReferralSent] = useState(false);

  // ── Prescription state (provider-only) ──────────────────────────────────────
  const [rxMedications, setRxMedications] = useState<MedicationItem[]>([
    { name: '', dosage: '', frequency: '', durationDays: 7 },
  ]);
  const [rxInstructions, setRxInstructions] = useState('');
  const [rxValidDays, setRxValidDays] = useState(30);
  const [rxDistrict, setRxDistrict] = useState('');
  const [rxSector, setRxSector] = useState('');
  const [rxCell, setRxCell] = useState('');
  const [issuingRx, setIssuingRx] = useState(false);
  const [issuedRxList, setIssuedRxList] = useState<ApiPrescriptionDto[]>([]);

  const [ehrSummary, setEhrSummary] = useState<ApiHealthRecordDto | null>(null);
  const [symptomReport, setSymptomReport] = useState<ApiSymptomReport | null>(null);
  const [loadingPatientInfo, setLoadingPatientInfo] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  // Refs — don't cause re-renders
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const peerConnRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const consultationRef = useRef<ApiConsultationDto | null>(null);
  const remotePeerSocketIdRef = useRef<string | null>(null);
  const callStartTimeRef = useRef<number | null>(null);
  // Populated by fetchIceServers() in joinConsultation before the peer connection is created
  const iceConfigRef = useRef<RTCConfiguration>(STUN_ONLY_CONFIG);
  // Previous network-stats sample — used to compute per-interval deltas, not cumulative totals
  const prevStatsRef = useRef<{ packetsLost: number; packetsReceived: number } | null>(null);

  // Call duration timer
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (phase === 'active') {
      callStartTimeRef.current = Date.now();
      interval = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [phase]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup(false);
      if (instantPollRef.current) clearInterval(instantPollRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load provider's instant availability status — refresh each time they return to waiting phase
  useEffect(() => {
    if (!isProvider || phase !== 'waiting') return;
    providersApi.getMyProfile()
      .then(p => setInstantAvailable(p.isAvailableForInstant ?? false))
      .catch(() => {});
  }, [isProvider, phase]);

  // Poll for incoming instant consultation requests when provider is available
  useEffect(() => {
    if (!isProvider || !instantAvailable || phase !== 'waiting') {
      if (instantPollRef.current) { clearInterval(instantPollRef.current); instantPollRef.current = null; }
      setIncomingInstant(null);
      return;
    }
    const poll = async () => {
      try {
        const c = await consultationsApi.getIncomingInstant();
        setIncomingInstant(c);
      } catch { /* ignore */ }
    };
    poll();
    instantPollRef.current = setInterval(poll, 3000);
    return () => { if (instantPollRef.current) clearInterval(instantPollRef.current); };
  }, [isProvider, instantAvailable, phase]);

  // Sync local stream → video element whenever either becomes available
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
      localVideoRef.current.play().catch(() => {});
    }
  }, [localStream, phase]);

  // Sync remote stream → video element whenever either becomes available
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream, phase]);

  // Network quality polling (every 3 s while call is active)
  useEffect(() => {
    if (phase !== 'active' || !peerConnected) { setNetworkQuality(0); return; }
    prevStatsRef.current = null; // reset on each new active session so first delta is clean
    const poll = setInterval(async () => {
      if (!peerConnRef.current) return;
      try {
        const stats = await peerConnRef.current.getStats();
        let packetsLost = 0, packetsReceived = 0, jitter = 0;
        stats.forEach(r => {
          if (r.type === 'inbound-rtp' && r.kind === 'video') {
            packetsLost += (r as RTCInboundRtpStreamStats).packetsLost ?? 0;
            packetsReceived += (r as RTCInboundRtpStreamStats).packetsReceived ?? 0;
            jitter = (r as RTCInboundRtpStreamStats).jitter ?? 0;
          }
        });
        // Use per-interval deltas so a burst of early loss doesn't poison future readings
        const prev = prevStatsRef.current;
        const deltaLost = packetsLost - (prev?.packetsLost ?? 0);
        const deltaReceived = packetsReceived - (prev?.packetsReceived ?? 0);
        prevStatsRef.current = { packetsLost, packetsReceived };
        const lossRate = (deltaLost + deltaReceived) > 0
          ? deltaLost / (deltaLost + deltaReceived) : 0;
        if (lossRate > 0.1 || jitter > 0.05) setNetworkQuality(1);
        else if (lossRate > 0.05 || jitter > 0.03) setNetworkQuality(2);
        else if (lossRate > 0.01 || jitter > 0.01) setNetworkQuality(3);
        else setNetworkQuality(4);
      } catch { /* ignore */ }
    }, 3000);
    return () => clearInterval(poll);
  }, [phase, peerConnected]);

  // Adaptive bitrate: whenever network quality changes, adjust the outbound video
  // encoding parameters and the camera resolution to match available bandwidth.
  useEffect(() => {
    if (networkQuality === 0) return; // unknown — leave current settings untouched
    const profile = QUALITY_PROFILES[networkQuality];
    if (!profile) return;

    (async () => {
      try {
        // 1. Shrink/grow the video track resolution on the capture side.
        const videoTrack = localStreamRef.current?.getVideoTracks()[0];
        if (videoTrack) {
          await videoTrack.applyConstraints({ width: profile.width, height: profile.height });
        }

        // 2. Tell the RTP sender the new bitrate ceiling.
        //    setParameters() must be called with the object returned by getParameters()
        //    — never construct the object from scratch.
        const sender = peerConnRef.current?.getSenders().find(s => s.track?.kind === 'video');
        if (sender) {
          const params = sender.getParameters();
          if (!params.encodings || params.encodings.length === 0) {
            params.encodings = [{}];
          }
          params.encodings[0].maxBitrate = profile.maxBitrate;
          await sender.setParameters(params);
        }
      } catch {
        // applyConstraints / setParameters can fail on some browsers — degrade gracefully.
      }
    })();
  }, [networkQuality]);

  // Fetch patient info when peer connects
  useEffect(() => {
    if (!peerConnected || !appointment) return;
    setLoadingPatientInfo(true);
    (async () => {
      try {
        if (isProvider) {
          const ehr = await providersApi.getPatientEhr(appointment.patientId);
          setEhrSummary(ehr);
        } else {
          const [reports, ehr] = await Promise.allSettled([
            patientsApi.getMySymptomReports(0, 1),
            patientsApi.getMyEhr(),
          ]);
          if (reports.status === 'fulfilled') setSymptomReport(reports.value[0] ?? null);
          if (ehr.status === 'fulfilled') setEhrSummary(ehr.value);
        }
      } catch { /* ignore */ }
      finally { setLoadingPatientInfo(false); }
    })();
  }, [peerConnected, appointment, isProvider]); // eslint-disable-line react-hooks/exhaustive-deps

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const addSystemMessage = (text: string) => {
    setChatMessages(prev => [...prev, {
      sender: 'System',
      message: text,
      time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    }]);
  };

  // ─── WebRTC helpers ────────────────────────────────────────────────────────

  /**
   * Attempt an ICE restart on the current peer connection.
   * Creates a new offer with iceRestart:true so both sides re-gather ICE
   * candidates without tearing down the media tracks.
   * Called automatically on connectionState 'failed' and after a 4-second
   * delay when the state is 'disconnected'.
   */
  const triggerIceRestart = useCallback(async () => {
    const pc  = peerConnRef.current;
    const rid = remotePeerSocketIdRef.current;
    if (!pc || !rid || pc.signalingState === 'closed') return;
    try {
      const offer = await pc.createOffer({ iceRestart: true });
      await pc.setLocalDescription(offer);
      socketRef.current?.emit('offer', { to: rid, sdp: pc.localDescription });
      addSystemMessage('Network interrupted — attempting ICE restart…');
    } catch {
      /* ICE restart failed; connection will remain degraded until manual rejoin */
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const createPeerConnection = useCallback((): RTCPeerConnection => {
    const pc = new RTCPeerConnection(iceConfigRef.current);

    // Send ICE candidates to remote peer via signaling server
    pc.onicecandidate = ({ candidate }) => {
      if (candidate && remotePeerSocketIdRef.current && socketRef.current) {
        socketRef.current.emit('ice-candidate', {
          to: remotePeerSocketIdRef.current,
          candidate,
        });
      }
    };

    // Receive remote media stream
    pc.ontrack = (event) => {
      const [stream] = event.streams;
      setRemoteStream(stream); // triggers effect to attach once video element is in DOM
      setPeerConnected(true);
      updatePhase('active');
      addSystemMessage('Peer video connected.');
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      if (state === 'connected') {
        setConnectionStatus('connected');
      } else if (state === 'disconnected') {
        // Brief drop — wait 4 s then try ICE restart if still disconnected.
        setConnectionStatus('disconnected');
        setTimeout(() => {
          if (peerConnRef.current?.connectionState === 'disconnected') {
            triggerIceRestart();
          }
        }, 4000);
      } else if (state === 'failed') {
        // Hard failure — trigger ICE restart immediately.
        setConnectionStatus('disconnected');
        triggerIceRestart();
        addSystemMessage('Connection interrupted. Attempting ICE restart…');
      } else if (state === 'closed') {
        setConnectionStatus('disconnected');
        setPeerConnected(false);
        addSystemMessage('Peer disconnected.');
      }
    };

    peerConnRef.current = pc;
    return pc;
  }, [triggerIceRestart]); // eslint-disable-line react-hooks/exhaustive-deps

  const addLocalTracksToPeer = useCallback((pc: RTCPeerConnection) => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }
  }, []);

  /** Called when we are the first peer and a new peer joins */
  const initiateOffer = useCallback(async (remoteSocketId: string) => {
    remotePeerSocketIdRef.current = remoteSocketId;
    const existing = peerConnRef.current;
    const pc = existing ?? createPeerConnection();
    // Only attach tracks to a brand-new peer connection.
    // Reusing an existing one (e.g. after signaling reconnect) already has tracks;
    // calling addTrack again throws InvalidAccessError.
    if (!existing) addLocalTracksToPeer(pc);

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    socketRef.current?.emit('offer', { to: remoteSocketId, sdp: pc.localDescription });
  }, [createPeerConnection, addLocalTracksToPeer]);

  /** Called when we receive an offer (we are the second peer, or during ICE restart) */
  const handleOffer = useCallback(async (from: string, sdp: RTCSessionDescriptionInit) => {
    remotePeerSocketIdRef.current = from;
    // Reuse an existing healthy connection for ICE-restart offers so that
    // the existing media tracks are preserved.  Only create a fresh peer
    // connection when there is none or the old one is already torn down.
    const existing = peerConnRef.current;
    const canReuse = existing &&
      existing.connectionState !== 'closed' &&
      existing.connectionState !== 'failed';
    let pc: RTCPeerConnection;
    if (canReuse) {
      pc = existing!;
    } else {
      pc = createPeerConnection();
      addLocalTracksToPeer(pc);
    }

    await pc.setRemoteDescription(new RTCSessionDescription(sdp));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    socketRef.current?.emit('answer', { to: from, sdp: pc.localDescription });
  }, [createPeerConnection, addLocalTracksToPeer]);

  /** Called when we receive an answer to our offer */
  const handleAnswer = useCallback(async (sdp: RTCSessionDescriptionInit) => {
    await peerConnRef.current?.setRemoteDescription(new RTCSessionDescription(sdp));
  }, []);

  /** Called when we receive an ICE candidate from the remote peer */
  const handleIceCandidate = useCallback(async (candidate: RTCIceCandidateInit) => {
    try {
      await peerConnRef.current?.addIceCandidate(new RTCIceCandidate(candidate));
    } catch {
      // Silently ignore ICE candidate errors (normal during negotiation)
    }
  }, []);

  // ─── Socket.IO connection ──────────────────────────────────────────────────

  const connectSocket = useCallback((roomId: string) => {
    const token = localStorage.getItem('accessToken') ?? '';

    const socket = io(SIGNALING_URL, {
      // Try WebSocket first; fall back to long-polling if the network blocks upgrades.
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 3,
      timeout: 10000,
    });

    // ── 20-second hard timeout — if the signaling server never sends 'joined'
    // (server down, token rejected, firewall, etc.) release the camera and
    // return the user to the waiting room instead of hanging forever.
    connectionTimeoutRef.current = setTimeout(() => {
      if (phaseRef.current === 'connecting') {
        cleanup(false);
        updatePhase('waiting');
        toast.error('Could not connect to the consultation room. Please try again.');
      }
    }, 20000);

    socket.on('connect', () => {
      setConnectionStatus('connecting');
      socket.emit('join', { roomId, token });
    });

    // ── PROVIDER: entered active room ──────────────────────────────────────────
    socket.on('joined', ({ peers }: { roomId: string; peers: Array<{ userId: string; role: string; socketId: string }> }) => {
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current);
        connectionTimeoutRef.current = null;
      }
      addSystemMessage('Joined consultation room. Waiting for peer…');
      updatePhase('active');
      consultationsApi.logAuditEvent(consultationRef.current!.consultationId, 'JOINED');

      if (peers.length > 0) {
        initiateOffer(peers[0].socketId);
      } else {
        peerJoinTimeoutRef.current = setTimeout(() => {
          if (!peerConnRef.current || peerConnRef.current.connectionState !== 'connected') {
            toast.error(
              'The other participant has not joined after 90 seconds. ' +
              'Please confirm the appointment is active and try again.',
              { duration: 8000 }
            );
          }
        }, 90_000);
      }
    });

    // ── PATIENT: placed in lobby (waiting to be admitted) ─────────────────────
    socket.on('in-lobby', ({ roomId: _rid }: { roomId: string }) => {
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current);
        connectionTimeoutRef.current = null;
      }
      updatePhase('lobby');
      addSystemMessage('You are in the waiting room. The provider will admit you shortly.');
      consultationsApi.logAuditEvent(consultationRef.current!.consultationId, 'JOINED',
        '{"location":"lobby"}');
    });

    // ── PATIENT: provider admitted them ───────────────────────────────────────
    socket.on('admitted', ({ peers }: { roomId: string; peers: Array<{ userId: string; role: string; socketId: string }> }) => {
      updatePhase('active');
      addSystemMessage('You have been admitted to the consultation.');
      consultationsApi.logAuditEvent(consultationRef.current!.consultationId, 'ADMITTED');
      // Patient initiates the offer since peers[0] is the provider already in the room
      if (peers.length > 0) {
        initiateOffer(peers[0].socketId);
      }
    });

    // ── PATIENT: rejected by provider ─────────────────────────────────────────
    socket.on('rejected', ({ message }: { message: string }) => {
      toast.error(message || 'The provider declined your session request.');
      cleanup(false);
      updatePhase('waiting');
    });

    // ── PROVIDER: a patient arrived in the lobby ──────────────────────────────
    socket.on('patient-waiting', ({ userId: pid, socketId: psid }: { userId: string; socketId: string }) => {
      setWaitingPatients(prev => {
        if (prev.some(p => p.socketId === psid)) return prev;
        return [...prev, { userId: pid, socketId: psid }];
      });
      toast.info('A patient is waiting in the lobby.', { duration: 5000 });
    });

    // ── PROVIDER: patient left lobby without being admitted ───────────────────
    socket.on('patient-left-lobby', ({ socketId: psid }: { socketId: string }) => {
      setWaitingPatients(prev => prev.filter(p => p.socketId !== psid));
    });

    // ── peer-joined (active room) ─────────────────────────────────────────────
    socket.on('peer-joined', ({ socketId, role }: { userId: string; role: string; socketId: string }) => {
      if (peerJoinTimeoutRef.current) {
        clearTimeout(peerJoinTimeoutRef.current);
        peerJoinTimeoutRef.current = null;
      }
      addSystemMessage(`${role.toLowerCase()} joined the room.`);
      remotePeerSocketIdRef.current = socketId;
      // Remove from waiting list if provider just admitted them
      setWaitingPatients(prev => prev.filter(p => p.socketId !== socketId));
    });

    socket.on('offer', ({ from, sdp }: { from: string; sdp: RTCSessionDescriptionInit }) => {
      handleOffer(from, sdp);
    });

    socket.on('answer', ({ sdp }: { from: string; sdp: RTCSessionDescriptionInit }) => {
      handleAnswer(sdp);
    });

    socket.on('ice-candidate', ({ candidate }: { from: string; candidate: RTCIceCandidateInit }) => {
      handleIceCandidate(candidate);
    });

    socket.on('peer-left', () => {
      setPeerConnected(false);
      addSystemMessage('The other participant has left the consultation.');
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    });

    socket.on('chat-message', ({ message }: { from: string; message: string }) => {
      setChatMessages(prev => [...prev, {
        sender: 'Peer',
        message,
        time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      }]);
    });

    socket.on('error', ({ message }: { message: string }) => {
      toast.error(`Signaling error: ${message}`);
    });

    // Socket.io failed to reach the server (network error, wrong URL, CORS, etc.)
    socket.on('connect_error', (err) => {
      if (phaseRef.current === 'connecting') {
        cleanup(false);
        updatePhase('waiting');
        toast.error(`Could not reach the signaling server: ${err.message}`);
      }
    });

    // All reconnection attempts exhausted while already in a call
    socket.on('reconnect_failed', () => {
      if (phaseRef.current === 'active' || phaseRef.current === 'connecting') {
        cleanup(false);
        updatePhase('waiting');
        toast.error('Connection to the consultation room was lost. Please rejoin.');
      }
    });

    socket.on('disconnect', (reason) => {
      setConnectionStatus('disconnected');
      // If we were still setting up, release the camera and send user back
      if (phaseRef.current === 'connecting') {
        cleanup(false);
        updatePhase('waiting');
        toast.error(`Disconnected before joining: ${reason}. Please try again.`);
      }
    });

    // Re-join the room after an automatic reconnect so the session survives
    // a brief network blip. A fresh token is read from storage in case the
    // original token expired during a long consultation.
    socket.on('reconnect', () => {
      const freshToken = localStorage.getItem('accessToken') ?? '';

      // If the peer connection is broken, close it so that the re-join
      // triggers a fresh offer/answer cycle via the 'joined' handler.
      // If it is still healthy the media path may have survived the blip
      // independently of the signaling socket — leave it untouched.
      const pc = peerConnRef.current;
      if (pc && (pc.connectionState === 'failed' || pc.connectionState === 'closed')) {
        pc.close();
        peerConnRef.current = null;
        remotePeerSocketIdRef.current = null;
        setPeerConnected(false);
        prevStatsRef.current = null;
      }

      socket.emit('join', { roomId, token: freshToken });
      addSystemMessage('Reconnected to signaling server. Re-establishing call…');
    });

    socketRef.current = socket;
  }, [initiateOffer, handleOffer, handleAnswer, handleIceCandidate]);

  // ─── User media ────────────────────────────────────────────────────────────

  const getUserMedia = async (): Promise<MediaStream> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        // Cap at 720p / 30 fps — adaptive bitrate will reduce further if bandwidth is low.
        video: videoEnabled
          ? { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { max: 30 } }
          : false,
        audio: audioEnabled,
      });
      localStreamRef.current = stream;
      setLocalStream(stream); // triggers effect to attach to video element once it mounts
      return stream;
    } catch (err) {
      if (err instanceof DOMException && err.name === 'NotAllowedError') {
        throw new Error('Camera/microphone access denied. Please allow access in your browser settings and reload.');
      }
      throw new Error('Could not access camera or microphone. Check your device connections.');
    }
  };

  // ─── Instant consult helpers ───────────────────────────────────────────────

  const loadInstantProviders = async () => {
    setLoadingInstantProviders(true);
    try {
      const list = await providersApi.getInstantAvailable();
      setInstantProviders(list ?? []);
    } catch {
      toast.error('Could not load available providers');
    } finally {
      setLoadingInstantProviders(false);
    }
  };

  const startInstantConsult = async (providerId: string) => {
    setStartingInstant(true);
    try {
      updatePhase('connecting');
      const consultation = await consultationsApi.startInstant({ providerId });
      consultationRef.current = consultation;
      iceConfigRef.current = await fetchIceServers(consultation.consultationId);
      await getUserMedia();
      connectSocket(consultation.roomId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to start instant consultation';
      toast.error(msg);
      updatePhase('waiting');
    } finally {
      setStartingInstant(false);
    }
  };

  const joinInstantConsult = async (consultation: ApiConsultationDto) => {
    updatePhase('connecting');
    try {
      consultationRef.current = consultation;
      iceConfigRef.current = await fetchIceServers(consultation.consultationId);
      await getUserMedia();
      connectSocket(consultation.roomId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to join instant consultation';
      toast.error(msg);
      updatePhase('waiting');
    }
  };

  const toggleInstantAvailability = async () => {
    setTogglingInstant(true);
    try {
      const updated = await providersApi.toggleInstantAvailability();
      setInstantAvailable(updated.isAvailableForInstant ?? false);
      toast.success(updated.isAvailableForInstant
        ? 'You are now available for instant consultations'
        : 'You are no longer available for instant consultations');
    } catch {
      toast.error('Could not update instant availability');
    } finally {
      setTogglingInstant(false);
    }
  };

  // ─── Main join flow ────────────────────────────────────────────────────────

  const joinConsultation = async () => {
    if (!appointment) {
      toast.error('No appointment selected');
      return;
    }

    updatePhase('connecting');

    try {
      // 1. Fetch fresh ICE/TURN credentials from backend (falls back to STUN-only if offline)

      // 2. Get the consultation room from backend
      let consultation: ApiConsultationDto | null = null;
      try {
        consultation = await consultationsApi.getByAppointment(appointment.id);
      } catch {
        if (isProvider) {
          // Provider can start the consultation if it doesn't exist yet
          consultation = await consultationsApi.start({ appointmentId: appointment.id });
        } else {
          // Patient cannot start — doctor hasn't started yet
          updatePhase('waiting');
          toast.info('Your doctor has not started the consultation yet. Please wait.');
          return;
        }
      }

      if (!consultation?.roomId) {
        throw new Error('No room ID returned from backend');
      }
      consultationRef.current = consultation;

      // 1. (deferred) Fetch TURN credentials now that we have a consultationId
      iceConfigRef.current = await fetchIceServers(consultation.consultationId);

      // 3. Acquire camera + mic
      await getUserMedia();

      // 4. Connect to signaling service
      connectSocket(consultation.roomId);

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to start consultation';
      toast.error(msg);
      updatePhase('waiting');
    }
  };

  // ─── Cleanup / end call ────────────────────────────────────────────────────

  const cleanup = useCallback((callEndApi = true) => {
    // Cancel any pending timeouts
    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current);
      connectionTimeoutRef.current = null;
    }
    if (peerJoinTimeoutRef.current) {
      clearTimeout(peerJoinTimeoutRef.current);
      peerJoinTimeoutRef.current = null;
    }
    // Close peer connection
    if (peerConnRef.current) {
      peerConnRef.current.close();
      peerConnRef.current = null;
    }
    // Stop screen share tracks
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(t => t.stop());
      screenStreamRef.current = null;
    }
    // Stop local media tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    }
    // Disconnect socket
    if (socketRef.current) {
      socketRef.current.emit('leave');
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    // Clear video elements and stream state
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    setLocalStream(null);
    setRemoteStream(null);

    // Log LEFT audit event before clearing consultationRef
    if (consultationRef.current) {
      consultationsApi.logAuditEvent(consultationRef.current.consultationId, 'LEFT');
    }

    // Notify backend
    if (callEndApi && consultationRef.current) {
      consultationsApi.end(consultationRef.current.consultationId, {
        notes: consultationNotes || undefined,
      }).catch(() => { /* best-effort */ });
    }
  }, [consultationNotes]);

  const endCall = () => {
    cleanup(true);
    updatePhase('ended');
    toast.info('Consultation ended');
  };

  // ─── Toggle camera / mic ───────────────────────────────────────────────────

  const toggleVideo = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach(t => {
        t.enabled = !t.enabled;
      });
    }
    setVideoEnabled(v => !v);
  };

  const toggleAudio = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(t => {
        t.enabled = !t.enabled;
      });
    }
    setAudioEnabled(a => !a);
  };

  // ─── Screen sharing ────────────────────────────────────────────────────────

  const toggleScreenShare = async () => {
    if (screenSharing) {
      // Stop screen share — restore camera track
      screenStreamRef.current?.getTracks().forEach(t => t.stop());
      screenStreamRef.current = null;
      const pc = peerConnRef.current;
      if (pc && localStreamRef.current) {
        const videoTrack = localStreamRef.current.getVideoTracks()[0];
        if (videoTrack) {
          try {
            const sender = pc.getSenders().find(s => s.track?.kind === 'video');
            await sender?.replaceTrack(videoTrack);
          } catch {
            toast.error('Could not restore camera after screen share');
          }
        }
        if (localStreamRef.current) setLocalStream(localStreamRef.current);
      }
      setScreenSharing(false);
      addSystemMessage('Screen sharing stopped.');
      consultationsApi.logAuditEvent(consultationRef.current?.consultationId ?? '', 'SCREEN_SHARE_STOPPED');
    } else {
      try {
        const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        screenStreamRef.current = displayStream;
        const screenTrack = displayStream.getVideoTracks()[0];
        // Replace video track in peer connection
        const pc = peerConnRef.current;
        if (pc) {
          const sender = pc.getSenders().find(s => s.track?.kind === 'video');
          sender?.replaceTrack(screenTrack);
        }
        // Show screen in local video element
        setLocalStream(displayStream);
        // When the user stops sharing via the browser UI the onended event fires.
        // We can't call toggleScreenShare() here because it captures a stale
        // closure where screenSharing===false (it was false when the async block
        // started). Instead, inline the revert logic with refs that are always current.
        screenTrack.onended = () => {
          screenStreamRef.current?.getTracks().forEach(t => t.stop());
          screenStreamRef.current = null;
          const activePc = peerConnRef.current;
          if (activePc && localStreamRef.current) {
            const camTrack = localStreamRef.current.getVideoTracks()[0];
            if (camTrack) {
              const sender = activePc.getSenders().find(s => s.track?.kind === 'video');
              sender?.replaceTrack(camTrack).catch(() => {
                toast.error('Could not restore camera after screen share');
              });
            }
            setLocalStream(localStreamRef.current);
          }
          setScreenSharing(false);
          addSystemMessage('Screen sharing stopped.');
        };
        setScreenSharing(true);
        addSystemMessage('Screen sharing started.');
        consultationsApi.logAuditEvent(consultationRef.current?.consultationId ?? '', 'SCREEN_SHARE_STARTED');
      } catch (err) {
        if ((err as DOMException).name !== 'NotAllowedError') {
          toast.error('Could not start screen sharing');
        }
      }
    }
  };

  // ─── Recording ─────────────────────────────────────────────────────────────

  const handleRecordToggle = () => {
    if (recording) {
      mediaRecorderRef.current?.stop();
    } else {
      setShowConsentDialog(true);
    }
  };

  const startRecording = () => {
    setShowConsentDialog(false);
    const stream = remoteVideoRef.current?.srcObject as MediaStream | null;
    if (!stream) { toast.error('No remote stream to record'); return; }

    const consultId = consultationRef.current?.consultationId;

    // Persist consent to backend (audit trail + DB column)
    if (consultId) {
      consultationsApi.grantRecordingConsent(consultId).catch(() => {});
      consultationsApi.logAuditEvent(consultId, 'RECORDING_CONSENT_GIVEN');
    }

    recordedChunksRef.current = [];
    try {
      const mr = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8' });
      mr.ondataavailable = (e) => { if (e.data.size > 0) recordedChunksRef.current.push(e.data); };
      mr.onstop = async () => {
        setRecording(false);
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        consultationsApi.logAuditEvent(consultId ?? '', 'RECORDING_STOPPED');

        if (consultId) {
          try {
            const formData = new FormData();
            formData.append('file', blob, `consultation-${Date.now()}.webm`);
            await consultationsApi.uploadRecording(consultId, formData);
            toast.success('Recording saved to server');
          } catch {
            // Server upload failed — fall back to local download
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = `consultation-${Date.now()}.webm`; a.click();
            URL.revokeObjectURL(url);
            toast.success('Recording downloaded locally (server upload failed)');
          }
        }
      };
      mr.start(1000);
      mediaRecorderRef.current = mr;
      setRecording(true);
      addSystemMessage('Recording started (consent logged).');
      consultationsApi.logAuditEvent(consultId ?? '', 'RECORDING_STARTED');
      toast.success('Recording started');
    } catch {
      toast.error('Recording not supported in this browser');
    }
  };

  // ─── Chat ──────────────────────────────────────────────────────────────────

  const sendMessage = () => {
    const text = newMessage.trim();
    if (!text) return;

    // Add to own chat immediately
    setChatMessages(prev => [...prev, {
      sender: 'You',
      message: text,
      time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    }]);

    // Relay to the other peer via the signaling server
    socketRef.current?.emit('chat-message', { message: text });

    setNewMessage('');
  };

  // ─── Referral submission ──────────────────────────────────────────────────

  const handleSendReferral = async () => {
    const patientId = appointment?.patientId ?? consultationRef.current?.patientId;
    if (!patientId) { toast.error('No patient in this consultation'); return; }
    if (!referralSpecialtyNeeded.trim()) { toast.error('Specialty / treatment area is required'); return; }
    if (!referralReason.trim()) { toast.error('Reason is required'); return; }
    if (referralType === 'EXTERNAL' && !referralInstitutionName.trim()) {
      toast.error('Institution name is required for external referrals'); return;
    }
    setSubmittingReferral(true);
    try {
      await referralsApi.create({
        patientId: patientId,
        consultationId: consultationRef.current?.consultationId,
        specialtyNeeded: referralSpecialtyNeeded,
        reason: referralReason,
        urgency: referralUrgency,
        notes: referralNotes || undefined,
        referralType,
        ...(referralType === 'EXTERNAL' && {
          institutionName: referralInstitutionName,
          institutionType: referralInstitutionType || undefined,
          institutionAddress: referralInstitutionAddress || undefined,
          institutionContact: referralInstitutionContact || undefined,
          treatmentType: referralTreatmentType || undefined,
        }),
      });
      toast.success('Referral sent — patient has been notified');
      setReferralSent(true);
      // Reset form for another possible referral
      setReferralSpecialtyNeeded('');
      setReferralReason('');
      setReferralNotes('');
      setReferralInstitutionName('');
      setReferralInstitutionType('');
      setReferralInstitutionAddress('');
      setReferralInstitutionContact('');
      setReferralTreatmentType('');
      setTimeout(() => setReferralSent(false), 4000);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      toast.error(e?.response?.data?.message || 'Failed to send referral');
    } finally {
      setSubmittingReferral(false);
    }
  };

  // ─── Prescription issuance ────────────────────────────────────────────────

  const handleIssuePrescription = async () => {
    const patientId = appointment?.patientId ?? consultationRef.current?.patientId;
    if (!patientId) { toast.error('No patient in this consultation'); return; }

    const validMeds = rxMedications.filter(m => m.name.trim());
    if (validMeds.length === 0) { toast.error('Add at least one medication'); return; }

    setIssuingRx(true);
    try {
      const rx = await prescriptionsApi.issue({
        consultationId: consultationRef.current?.consultationId,
        patientId,
        medications: validMeds,
        instructions: rxInstructions || undefined,
        validForDays: rxValidDays,
        providerSignature: user?.name,
        deliveryDistrict: rxDistrict || undefined,
        deliverySector:   rxSector   || undefined,
        deliveryCell:     rxCell     || undefined,
      });
      setIssuedRxList(prev => [rx, ...prev]);
      toast.success(
        rx.pharmacyName
          ? `Prescription issued · routed to ${rx.pharmacyName}`
          : 'Prescription issued · patient notified'
      );
      setRxMedications([{ name: '', dosage: '', frequency: '', durationDays: 7 }]);
      setRxInstructions('');
      setRxDistrict('');
      setRxSector('');
      setRxCell('');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      toast.error(e?.response?.data?.message || 'Failed to issue prescription');
    } finally {
      setIssuingRx(false);
    }
  };

  // ─── Render: Ended ────────────────────────────────────────────────────────

  if (phase === 'ended') {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12 space-y-4">
              <div className="h-20 w-20 bg-muted rounded-full flex items-center justify-center mx-auto">
                <PhoneOff className="h-10 w-10 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-semibold">{t('teleconsultation.consultationEnded')}</h3>
              <p className="text-muted-foreground">{t('teleconsultation.duration')}: {formatDuration(callDuration)}</p>
              <Button onClick={() => {
                updatePhase('waiting');
                setCallDuration(0);
                setChatMessages([{
                  sender: 'System',
                  message: 'Please wait while the connection is established.',
                  time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
                }]);
                setConsultationNotes('');
                consultationRef.current = null;
              }}>
                {t('teleconsultation.startNew')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── Render: Waiting Room ─────────────────────────────────────────────────

  if (phase === 'waiting') {
    // ── Provider: Instant consult panel ──────────────────────────────────────
    if (isProvider) {
      return (
        <div className="space-y-4">
          {/* Instant availability toggle */}
          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`h-10 w-10 rounded-full flex items-center justify-center ${instantAvailable ? 'bg-green-100' : 'bg-gray-100'}`}>
                    <Zap className={`h-5 w-5 ${instantAvailable ? 'text-green-600' : 'text-gray-400'}`} />
                  </div>
                  <div>
                    <p className="font-medium text-sm">Instant Consultation</p>
                    <p className="text-xs text-muted-foreground">
                      {instantAvailable ? 'Patients can reach you right now' : 'You are not accepting instant calls'}
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={toggleInstantAvailability}
                  disabled={togglingInstant || instantAvailable === null}
                  className={instantAvailable ? 'border-green-300 text-green-700 hover:bg-green-50' : ''}
                >
                  {togglingInstant ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : instantAvailable ? (
                    <><ToggleRight className="h-4 w-4 mr-1" /> Available</>
                  ) : (
                    <><ToggleLeft className="h-4 w-4 mr-1" /> Go Available</>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Incoming instant request banner */}
          {incomingInstant && (
            <Card className="border-green-400 bg-green-50">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-green-200 flex items-center justify-center animate-pulse">
                      <Zap className="h-5 w-5 text-green-700" />
                    </div>
                    <div>
                      <p className="font-semibold text-green-900 text-sm">Incoming Instant Consultation</p>
                      <p className="text-xs text-green-700">A patient is waiting for you right now</p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    className="bg-green-600 hover:bg-green-700 text-white shrink-0"
                    onClick={() => joinInstantConsult(incomingInstant)}
                  >
                    <Video className="h-4 w-4 mr-1" />
                    Join Now
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Regular appointment picker */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('teleconsultation.waitingRoom')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold mb-1">
                    {appointment ? `Consultation with ${appointment.patientName}` : 'Scheduled Appointments'}
                  </h3>
                  <p className="text-sm text-muted-foreground">{appointment ? 'Click below to start' : 'Select an appointment to begin'}</p>
                </div>

                {!appointment && (
                  <div className="space-y-2">
                    {loadingAppointments ? (
                      <div className="flex justify-center py-4"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground/70" /></div>
                    ) : myAppointments.length === 0 ? (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-800">
                        No upcoming or in-progress appointments found.
                      </div>
                    ) : (
                      myAppointments.map(apt => (
                        <button key={apt.id} onClick={() => setActiveAppointment(apt)}
                          className="w-full text-left border rounded-lg p-3 hover:bg-blue-50 hover:border-blue-300 transition-colors">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium text-sm">{apt.patientName}</p>
                              <p className="text-xs text-muted-foreground">{apt.date} at {apt.time}</p>
                            </div>
                            <Badge variant={apt.status === 'in-progress' ? 'default' : 'secondary'} className="text-xs capitalize ml-2">{apt.status}</Badge>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}

                {appointment && (
                  <>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-sm">Appointment Details</h4>
                        <button onClick={() => setActiveAppointment(undefined)} className="text-xs text-muted-foreground hover:underline">Change</button>
                      </div>
                      <div className="space-y-1 text-sm text-foreground/80">
                        <p><strong>Patient:</strong> {appointment.patientName}</p>
                        <p><strong>Scheduled:</strong> {appointment.date} at {appointment.time}</p>
                        <p><strong>Status:</strong> <span className="capitalize">{appointment.status}</span></p>
                      </div>
                    </div>
                    {!isAppointmentExpired(appointment) && (
                      <Button className="w-full" onClick={joinConsultation}>
                        <CalendarIcon className="h-4 w-4 mr-2" />
                        Start Consultation
                      </Button>
                    )}
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    // ── Patient: Instant consult panel ────────────────────────────────────────
    if (showInstantPanel) {
      return (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <button onClick={() => setShowInstantPanel(false)} className="text-muted-foreground hover:text-foreground">
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <CardTitle className="text-base flex items-center gap-2">
                  <Zap className="h-4 w-4 text-yellow-500" />
                  Talk Now — Available Doctors
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {loadingInstantProviders ? (
                <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground/70" /></div>
              ) : instantProviders.length === 0 ? (
                <div className="text-center py-8 space-y-3">
                  <div className="h-16 w-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto">
                    <User className="h-8 w-8 text-gray-400" />
                  </div>
                  <p className="font-medium text-gray-600">No doctors available right now</p>
                  <p className="text-sm text-muted-foreground">All instant-consult doctors are busy. Try booking a scheduled slot.</p>
                  <Button variant="outline" size="sm" onClick={loadInstantProviders}>
                    <Loader2 className="h-3 w-3 mr-1" /> Refresh
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {instantProviders.map(p => (
                    <div key={p.providerId} className="border rounded-lg p-4 flex items-center justify-between gap-4 hover:border-blue-300 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                          <User className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">{p.name}</p>
                          <p className="text-xs text-muted-foreground">{p.specialty}</p>
                          {p.facility && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                              <Building2 className="h-3 w-3" />{p.facility}
                            </p>
                          )}
                          {p.rating != null && (
                            <p className="text-xs text-yellow-600 flex items-center gap-1 mt-0.5">
                              <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />{Number(p.rating).toFixed(1)}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                        <Button
                          size="sm"
                          onClick={() => startInstantConsult(p.providerId)}
                          disabled={startingInstant}
                          className="bg-green-600 hover:bg-green-700 text-white"
                        >
                          {startingInstant ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Zap className="h-3 w-3 mr-1" />Connect</>}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      );
    }

    // ── Patient: Default waiting room ─────────────────────────────────────────
    return (
      <div className="space-y-6">
        {/* Talk Now banner */}
        <Card className="border-yellow-300 bg-gradient-to-r from-yellow-50 to-orange-50">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-yellow-200 flex items-center justify-center">
                  <Zap className="h-6 w-6 text-yellow-700" />
                </div>
                <div>
                  <p className="font-semibold text-sm">Need help right now?</p>
                  <p className="text-xs text-muted-foreground">Connect instantly with an available doctor — no appointment needed.</p>
                </div>
              </div>
              <Button
                className="bg-yellow-500 hover:bg-yellow-600 text-white shrink-0"
                onClick={() => { setShowInstantPanel(true); loadInstantProviders(); }}
              >
                <Zap className="h-4 w-4 mr-1" />
                Talk Now
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('teleconsultation.waitingRoom')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12 space-y-6">
              <div className="flex justify-center">
                <div className="h-24 w-24 bg-blue-100 rounded-full flex items-center justify-center animate-pulse">
                  <Video className="h-12 w-12 text-blue-600" />
                </div>
              </div>

              <div>
                <h3 className="text-xl font-semibold mb-2">
                  {appointment ? `Consultation with ${appointment.doctorName}` : 'Scheduled Consultation'}
                </h3>
                <p className="text-muted-foreground">{appointment ? 'Click below to join when you are ready' : 'Select an appointment to join'}</p>
              </div>

              {!appointment && (
                <div className="w-full max-w-md mx-auto text-left space-y-2">
                  {loadingAppointments ? (
                    <div className="flex justify-center py-4"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground/70" /></div>
                  ) : myAppointments.length === 0 ? (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-800">
                      No upcoming or in-progress appointments found.
                    </div>
                  ) : (
                    myAppointments.map(apt => (
                      <button
                        key={apt.id}
                        onClick={() => setActiveAppointment(apt)}
                        className="w-full text-left border rounded-lg p-3 hover:bg-blue-50 hover:border-blue-300 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-sm">{apt.doctorName}</p>
                            <p className="text-xs text-muted-foreground">{apt.date} at {apt.time}</p>
                          </div>
                          <Badge variant={apt.status === 'in-progress' ? 'default' : 'secondary'} className="text-xs capitalize ml-2">
                            {apt.status}
                          </Badge>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}

              {appointment && (
                <div className="max-w-md mx-auto bg-blue-50 border border-blue-200 rounded-lg p-4 text-left">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium">Appointment Details</h4>
                    <button onClick={() => setActiveAppointment(undefined)} className="text-xs text-muted-foreground hover:underline">Change</button>
                  </div>
                  <div className="space-y-1 text-sm text-foreground/80">
                    <p><strong>Doctor:</strong> {appointment.doctorName}</p>
                    {appointment.doctorSpecialization && (
                      <p><strong>Specialization:</strong> {appointment.doctorSpecialization}</p>
                    )}
                    <p><strong>Scheduled:</strong> {appointment.date} at {appointment.time}</p>
                    <p><strong>Status:</strong> <span className="capitalize">{appointment.status}</span></p>
                  </div>
                </div>
              )}

              {appointment && (() => {
                const isExpired = isAppointmentExpired(appointment);
                if (isExpired) {
                  return (
                    <div className="max-w-md mx-auto bg-red-50 border border-red-200 rounded-lg p-5 text-center space-y-2">
                      <div className="flex justify-center">
                        <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center">
                          <PhoneOff className="h-6 w-6 text-red-500" />
                        </div>
                      </div>
                      <p className="font-semibold text-red-800">This consultation has expired</p>
                      <p className="text-sm text-red-600">
                        The scheduled time has passed. Please go to{' '}
                        <strong>Appointments</strong> and book a new consultation.
                      </p>
                    </div>
                  );
                }
                return (
                  <>
                    <div className="flex gap-3 justify-center">
                      <Button variant={videoEnabled ? 'default' : 'outline'} onClick={() => setVideoEnabled(v => !v)}>
                        {videoEnabled ? <Video className="h-4 w-4 mr-2" /> : <VideoOff className="h-4 w-4 mr-2" />}
                        {videoEnabled ? 'Camera On' : 'Camera Off'}
                      </Button>
                      <Button variant={audioEnabled ? 'default' : 'outline'} onClick={() => setAudioEnabled(a => !a)}>
                        {audioEnabled ? <Mic className="h-4 w-4 mr-2" /> : <MicOff className="h-4 w-4 mr-2" />}
                        {audioEnabled ? 'Mic On' : 'Mic Off'}
                      </Button>
                    </div>
                    <Button size="lg" onClick={joinConsultation}>
                      <CalendarIcon className="h-4 w-4 mr-2" />
                      Join Consultation
                    </Button>
                  </>
                );
              })()}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── Render: Connecting ───────────────────────────────────────────────────

  if (phase === 'connecting') {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-16 space-y-4">
              <Loader2 className="h-16 w-16 animate-spin text-blue-600 mx-auto" />
              <h3 className="text-xl font-semibold">Connecting…</h3>
              <p className="text-muted-foreground">Setting up your secure video consultation</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── Render: Lobby (patient waiting to be admitted) ───────────────────────

  if (phase === 'lobby') {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-16 space-y-6">
              <div className="h-24 w-24 bg-yellow-100 rounded-full flex items-center justify-center mx-auto animate-pulse">
                <User className="h-12 w-12 text-yellow-600" />
              </div>
              <div>
                <h3 className="text-xl font-semibold">Waiting Room</h3>
                <p className="text-muted-foreground mt-2">
                  You are in the waiting room. The provider will admit you shortly.
                </p>
              </div>
              {/* Show local camera preview so patient can check their setup */}
              <div className="w-48 aspect-video bg-gray-800 rounded-lg border-2 border-yellow-400 overflow-hidden mx-auto">
                <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
              </div>
              <Button variant="outline" onClick={() => { cleanup(false); updatePhase('waiting'); }}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── Render: Active Call ──────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Status Bar */}
      <Card className="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
        <CardContent className="py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {connectionStatus === 'connected' ? (
                <div className="h-3 w-3 bg-green-400 rounded-full animate-pulse" />
              ) : (
                <WifiOff className="h-4 w-4 text-yellow-300" />
              )}
              <span className="font-medium">
                {peerConnected && connectionStatus === 'connected'
                  ? 'Consultation in Progress'
                  : peerConnected && connectionStatus === 'disconnected'
                    ? 'Reconnecting…'
                    : 'Waiting for peer…'}
              </span>
              {!peerConnected && (
                <Badge variant="secondary" className="text-xs">Peer not yet connected</Badge>
              )}
              {peerConnected && connectionStatus === 'disconnected' && (
                <Badge className="bg-yellow-500 text-white text-xs animate-pulse">ICE restart</Badge>
              )}
              {recording && (
                <Badge className="bg-red-500 text-white text-xs animate-pulse">● REC</Badge>
              )}
            </div>
            <div className="flex items-center gap-4">
              {/* Network quality bars */}
              {peerConnected && (
                <div className="flex items-end gap-0.5" title={
                  networkQuality === 0 ? 'Measuring…'
                  : networkQuality === 1 ? 'Poor connection'
                  : networkQuality === 2 ? 'Fair connection'
                  : networkQuality === 3 ? 'Good connection'
                  : 'Excellent connection'
                }>
                  {[1,2,3,4].map(level => (
                    <div
                      key={level}
                      style={{ height: `${level * 4 + 4}px`, width: '4px' }}
                      className={`rounded-sm transition-colors ${
                        networkQuality === 0 ? 'bg-white/30'
                        : level <= networkQuality
                          ? networkQuality <= 1 ? 'bg-red-400'
                          : networkQuality === 2 ? 'bg-yellow-400'
                          : 'bg-green-400'
                        : 'bg-white/30'
                      }`}
                    />
                  ))}
                </div>
              )}
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <span className="font-mono">{formatDuration(callDuration)}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Waiting Room Admit Banner (provider only) ─────────────────────── */}
      {isProvider && waitingPatients.length > 0 && (
        <Card className="border-yellow-400 bg-yellow-50">
          <CardContent className="py-3">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 bg-yellow-400 rounded-full animate-pulse" />
                <span className="font-medium text-yellow-900 text-sm">
                  {waitingPatients.length === 1
                    ? 'A patient is in the waiting room'
                    : `${waitingPatients.length} patients in the waiting room`}
                </span>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="bg-green-600 hover:bg-green-700 text-white"
                  onClick={() => {
                    const p = waitingPatients[0];
                    socketRef.current?.emit('admit-patient', { socketId: p.socketId });
                    setWaitingPatients(prev => prev.filter(w => w.socketId !== p.socketId));
                  }}
                >
                  Admit
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-red-600 border-red-300 hover:bg-red-50"
                  onClick={() => {
                    const p = waitingPatients[0];
                    socketRef.current?.emit('reject-patient', { socketId: p.socketId });
                    setWaitingPatients(prev => prev.filter(w => w.socketId !== p.socketId));
                  }}
                >
                  Reject
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Video Area */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardContent className="p-0">
              <div className="relative bg-gray-900 aspect-video rounded-lg overflow-hidden">
                {/* Remote Video (main) */}
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  className="absolute inset-0 w-full h-full object-cover"
                />
                {/* Placeholder when remote not connected */}
                {!peerConnected && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-blue-900 to-blue-700">
                    <div className="text-center text-white">
                      <div className="h-24 w-24 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
                        <User className="h-12 w-12" />
                      </div>
                      <h3 className="text-xl font-semibold">{appointment?.doctorName ?? 'Doctor'}</h3>
                      <p className="text-sm opacity-80 mt-1">Waiting to connect…</p>
                      <Loader2 className="h-6 w-6 animate-spin mx-auto mt-3" />
                    </div>
                  </div>
                )}

                {/* Local Video (picture-in-picture) */}
                <div className="absolute bottom-4 right-4 w-40 aspect-video bg-gray-800 rounded-lg border-2 border-white shadow-lg overflow-hidden">
                  <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                  {!videoEnabled && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80 text-white">
                      <VideoOff className="h-6 w-6" />
                    </div>
                  )}
                </div>

                {/* Controls Overlay */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-6">
                  <div className="flex items-center justify-center gap-3">
                    <Button
                      size="lg"
                      variant={videoEnabled ? 'secondary' : 'destructive'}
                      className="rounded-full h-14 w-14"
                      onClick={toggleVideo}
                    >
                      {videoEnabled ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
                    </Button>
                    <Button
                      size="lg"
                      variant={audioEnabled ? 'secondary' : 'destructive'}
                      className="rounded-full h-14 w-14"
                      onClick={toggleAudio}
                    >
                      {audioEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
                    </Button>
                    <Button
                      size="lg"
                      variant="destructive"
                      className="rounded-full h-14 w-14"
                      onClick={endCall}
                    >
                      <PhoneOff className="h-5 w-5" />
                    </Button>
                    <Button
                      size="lg"
                      variant={screenSharing ? 'default' : 'secondary'}
                      className="rounded-full h-14 w-14"
                      onClick={toggleScreenShare}
                      title={screenSharing ? 'Stop sharing' : 'Share screen'}
                    >
                      {screenSharing ? <MonitorOff className="h-5 w-5" /> : <Monitor className="h-5 w-5" />}
                    </Button>
                    <Button
                      size="lg"
                      variant={recording ? 'destructive' : 'secondary'}
                      className="rounded-full h-14 w-14"
                      onClick={handleRecordToggle}
                      title={recording ? 'Stop recording' : 'Record (with consent)'}
                    >
                      {recording ? <Square className="h-5 w-5" /> : <Circle className="h-5 w-5 text-red-500" />}
                    </Button>
                    <Button
                      size="lg"
                      variant="secondary"
                      className="rounded-full h-14 w-14"
                      onClick={() => {
                        if (document.fullscreenElement) {
                          document.exitFullscreen();
                        } else {
                          document.documentElement.requestFullscreen();
                        }
                      }}
                    >
                      <Maximize className="h-5 w-5" />
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Consultation Notes */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Consultation Notes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Add notes during the consultation…"
                rows={4}
                value={consultationNotes}
                onChange={(e) => setConsultationNotes(e.target.value)}
                className="resize-none"
              />
              <div className="flex justify-between items-center mt-2 text-xs text-muted-foreground">
                <span>Saved automatically when call ends</span>
                <span>{consultationNotes.length} chars</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Sidebar — Chat + Patient Info tabs */}
        <div className="lg:col-span-1">
          <Card className="h-[calc(100vh-250px)] flex flex-col">
            {/* Tab bar */}
            <div className="flex border-b">
              <button
                className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-1.5 transition-colors ${
                  activeTab === 'chat'
                    ? 'border-b-2 border-blue-600 text-blue-600'
                    : 'text-muted-foreground hover:text-foreground/80'
                }`}
                onClick={() => setActiveTab('chat')}
              >
                <MessageSquare className="h-4 w-4" /> Chat
              </button>
              <button
                className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-1.5 transition-colors ${
                  activeTab === 'patient'
                    ? 'border-b-2 border-blue-600 text-blue-600'
                    : 'text-muted-foreground hover:text-foreground/80'
                }`}
                onClick={() => setActiveTab('patient')}
              >
                <User className="h-4 w-4" /> Patient Info
              </button>
              {isProvider && (
                <button
                  className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-1.5 transition-colors ${
                    activeTab === 'referral'
                      ? 'border-b-2 border-orange-500 text-orange-600'
                      : 'text-muted-foreground hover:text-foreground/80'
                  }`}
                  onClick={() => setActiveTab('referral')}
                >
                  <Send className="h-4 w-4" /> Refer
                </button>
              )}
              {isProvider && (
                <button
                  className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-1.5 transition-colors ${
                    activeTab === 'prescription'
                      ? 'border-b-2 border-green-600 text-green-700'
                      : 'text-muted-foreground hover:text-foreground/80'
                  }`}
                  onClick={() => setActiveTab('prescription')}
                >
                  <Pill className="h-4 w-4" /> Rx
                </button>
              )}
            </div>

            {/* Chat tab */}
            {activeTab === 'chat' && (
              <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {chatMessages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`flex ${msg.sender === 'You' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`max-w-[80%] rounded-lg p-3 ${
                        msg.sender === 'You'
                          ? 'bg-blue-600 text-white'
                          : msg.sender === 'System'
                          ? 'bg-muted text-muted-foreground text-center w-full'
                          : 'bg-muted text-foreground'
                      }`}>
                        {msg.sender !== 'System' && (
                          <p className="text-xs font-medium mb-1 opacity-80">{msg.sender}</p>
                        )}
                        <p className="text-sm">{msg.message}</p>
                        <p className="text-xs opacity-70 mt-1">{msg.time}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="border-t p-4">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Type a message…"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                    />
                    <Button onClick={sendMessage}>Send</Button>
                  </div>
                </div>
              </CardContent>
            )}

            {/* Patient Info tab */}
            {activeTab === 'patient' && (
              <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
                {loadingPatientInfo ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/70" />
                  </div>
                ) : (
                  <>
                    {/* Latest Symptom Report */}
                    {symptomReport && (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Latest Symptom Report</p>
                        <div className="border rounded-lg p-3 space-y-1 text-sm bg-amber-50 border-amber-200">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-amber-800">{symptomReport.aiPathway}</span>
                            <Badge className={
                              symptomReport.aiUrgency === 'EMERGENCY' ? 'bg-red-500 text-white' :
                              symptomReport.aiUrgency === 'HIGH' ? 'bg-orange-500 text-white' :
                              symptomReport.aiUrgency === 'MODERATE' ? 'bg-yellow-500 text-white' :
                              'bg-green-500 text-white'
                            }>
                              {symptomReport.aiUrgency}
                            </Badge>
                          </div>
                          <p className="text-muted-foreground text-xs">{symptomReport.careRecommendation}</p>
                          <p className="text-muted-foreground/70 text-xs">{symptomReport.createdAt.split('T')[0]}</p>
                        </div>
                      </div>
                    )}

                    {/* EHR Summary */}
                    {ehrSummary && (
                      <>
                        {(['allergies', 'medications', 'diagnoses'] as (keyof ApiHealthRecordDto)[]).map(key => {
                          let items: Record<string, string>[] = [];
                          try { items = JSON.parse(ehrSummary[key] as string) ?? []; } catch { items = []; }
                          const label = key === 'allergies' ? 'Allergies' : key === 'medications' ? 'Active Medications' : 'Diagnoses';
                          const color = key === 'allergies' ? 'bg-red-50 border-red-200 text-red-700'
                            : key === 'medications' ? 'bg-blue-50 border-blue-200 text-blue-700'
                            : 'bg-purple-50 border-purple-200 text-purple-700';
                          if (items.length === 0) return null;
                          return (
                            <div key={key}>
                              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{label}</p>
                              <div className={`border rounded-lg p-2 space-y-1 ${color}`}>
                                {items.slice(0, 4).map((item, i) => (
                                  <p key={i} className="text-xs">
                                    <span className="font-medium">{item.name || item.allergen || item.diagnosis || `Entry ${i+1}`}</span>
                                    {item.dosage && <span className="opacity-70"> — {item.dosage}</span>}
                                  </p>
                                ))}
                                {items.length > 4 && <p className="text-xs opacity-60">+{items.length - 4} more</p>}
                              </div>
                            </div>
                          );
                        })}
                      </>
                    )}

                    {!ehrSummary && !symptomReport && (
                      <p className="text-sm text-muted-foreground/70 text-center py-8">
                        {peerConnected ? 'No patient data available' : 'Connect to view patient info'}
                      </p>
                    )}
                  </>
                )}
              </CardContent>
            )}

            {/* Referral tab — provider only */}
            {activeTab === 'referral' && isProvider && (
              <CardContent className="flex-1 overflow-y-auto p-4 space-y-3">
                {referralSent && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-800 flex items-center gap-2">
                    <Send className="h-4 w-4 flex-shrink-0" />
                    Referral sent — patient notified via email and push.
                  </div>
                )}

                {/* Referral type toggle */}
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Referral Type</p>
                  <div className="flex rounded-lg border overflow-hidden text-sm">
                    <button
                      className={`flex-1 py-2 font-medium transition-colors ${referralType === 'EXTERNAL' ? 'bg-orange-500 text-white' : 'text-muted-foreground hover:bg-muted/50'}`}
                      onClick={() => setReferralType('EXTERNAL')}
                    >
                      External Institution
                    </button>
                    <button
                      className={`flex-1 py-2 font-medium transition-colors ${referralType === 'INTERNAL' ? 'bg-blue-600 text-white' : 'text-muted-foreground hover:bg-muted/50'}`}
                      onClick={() => setReferralType('INTERNAL')}
                    >
                      Internal Specialist
                    </button>
                  </div>
                </div>

                {/* External institution fields */}
                {referralType === 'EXTERNAL' && (
                  <>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Institution Name *</label>
                      <input
                        className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                        placeholder="e.g. CHUK, King Faisal Hospital"
                        value={referralInstitutionName}
                        onChange={e => setReferralInstitutionName(e.target.value)}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Institution Type</label>
                        <select
                          className="w-full border border-border rounded-md px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-input-background"
                          value={referralInstitutionType}
                          onChange={e => setReferralInstitutionType(e.target.value)}
                        >
                          <option value="">Select type</option>
                          <option value="HOSPITAL">Hospital</option>
                          <option value="SURGICAL_CENTER">Surgical Center</option>
                          <option value="CLINIC">Clinic</option>
                          <option value="LABORATORY">Laboratory</option>
                          <option value="IMAGING_CENTER">Imaging Center</option>
                          <option value="REHABILITATION_CENTER">Rehabilitation Center</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Treatment Type</label>
                        <select
                          className="w-full border border-border rounded-md px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-input-background"
                          value={referralTreatmentType}
                          onChange={e => setReferralTreatmentType(e.target.value)}
                        >
                          <option value="">Select type</option>
                          <option value="OPERATION">Operation / Surgery</option>
                          <option value="SPECIALIST_CARE">Specialist Care</option>
                          <option value="EMERGENCY">Emergency</option>
                          <option value="LAB_TESTS">Lab Tests</option>
                          <option value="IMAGING">Imaging / Radiology</option>
                          <option value="PHYSIOTHERAPY">Physiotherapy</option>
                          <option value="REHABILITATION">Rehabilitation</option>
                          <option value="OTHER">Other</option>
                        </select>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Address</label>
                      <input
                        className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                        placeholder="Institution address"
                        value={referralInstitutionAddress}
                        onChange={e => setReferralInstitutionAddress(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Contact</label>
                      <input
                        className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                        placeholder="Phone or email"
                        value={referralInstitutionContact}
                        onChange={e => setReferralInstitutionContact(e.target.value)}
                      />
                    </div>
                  </>
                )}

                {/* Common fields */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Specialty / Treatment Area *</label>
                  <input
                    className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    placeholder="e.g. Cardiology, General Surgery"
                    value={referralSpecialtyNeeded}
                    onChange={e => setReferralSpecialtyNeeded(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Reason *</label>
                  <textarea
                    className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
                    rows={3}
                    placeholder="Clinical reason for referral…"
                    value={referralReason}
                    onChange={e => setReferralReason(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Urgency</label>
                  <div className="flex gap-2">
                    {(['ROUTINE', 'URGENT', 'EMERGENCY'] as const).map(u => (
                      <button
                        key={u}
                        className={`flex-1 py-1.5 rounded-md text-xs font-semibold border transition-colors ${
                          referralUrgency === u
                            ? u === 'EMERGENCY' ? 'bg-red-500 text-white border-red-500'
                              : u === 'URGENT'  ? 'bg-orange-400 text-white border-orange-400'
                              : 'bg-green-500 text-white border-green-500'
                            : 'text-muted-foreground border-border hover:bg-muted/50'
                        }`}
                        onClick={() => setReferralUrgency(u)}
                      >
                        {u}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Additional Notes</label>
                  <textarea
                    className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
                    rows={2}
                    placeholder="Optional notes for receiving facility…"
                    value={referralNotes}
                    onChange={e => setReferralNotes(e.target.value)}
                  />
                </div>
                <Button
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white"
                  onClick={handleSendReferral}
                  disabled={submittingReferral}
                >
                  {submittingReferral
                    ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Sending…</>
                    : <><Send className="h-4 w-4 mr-2" />Send Referral &amp; Notify Patient</>
                  }
                </Button>
              </CardContent>
            )}
            {/* Prescription tab — provider only */}
            {activeTab === 'prescription' && isProvider && (
              <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">

                {/* Issued prescriptions for this consultation */}
                {issuedRxList.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Issued This Session</p>
                    {issuedRxList.map(rx => {
                      let meds: MedicationItem[] = [];
                      try { meds = JSON.parse(rx.medications); } catch { meds = []; }
                      return (
                        <div key={rx.prescriptionId} className="bg-green-50 border border-green-200 rounded-lg p-3 space-y-1">
                          <div className="flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
                            <span className="text-xs font-semibold text-green-800">
                              {meds.length} medication{meds.length !== 1 ? 's' : ''} · valid until {rx.validUntil}
                            </span>
                          </div>
                          {meds.map((m, i) => (
                            <p key={i} className="text-xs text-green-700 pl-6">
                              {m.name} {m.dosage} — {m.frequency} × {m.durationDays}d
                            </p>
                          ))}
                          {rx.pharmacyName && (
                            <p className="text-xs text-green-600 pl-6 flex items-center gap-1">
                              <Building2 className="h-3 w-3" /> Routed to: {rx.pharmacyName}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Quick templates */}
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Quick Templates</p>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(RX_TEMPLATES).map(([label, meds]) => (
                      <button
                        key={label}
                        onClick={() => setRxMedications(meds.map(m => ({ ...m })))}
                        className="text-xs px-2.5 py-1 rounded-full border border-primary/30 text-primary hover:bg-primary/5 transition-colors"
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Medication rows */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Medications *</p>
                    <button
                      onClick={() => setRxMedications(prev => [...prev, { name: '', dosage: '', frequency: '', durationDays: 7 }])}
                      className="text-xs text-primary hover:underline flex items-center gap-1"
                    >
                      <Plus className="h-3 w-3" /> Add
                    </button>
                  </div>
                  {rxMedications.map((med, idx) => (
                    <div key={idx} className="border rounded-lg p-2.5 space-y-2 bg-muted/20 relative">
                      {rxMedications.length > 1 && (
                        <button
                          onClick={() => setRxMedications(prev => prev.filter((_, i) => i !== idx))}
                          className="absolute top-2 right-2 text-muted-foreground hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <input
                        className="w-full border rounded px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                        placeholder="Drug name (e.g. Amoxicillin)"
                        value={med.name}
                        onChange={e => setRxMedications(prev => prev.map((m, i) => i === idx ? { ...m, name: e.target.value } : m))}
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          className="border rounded px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                          placeholder="Dosage (e.g. 500mg)"
                          value={med.dosage}
                          onChange={e => setRxMedications(prev => prev.map((m, i) => i === idx ? { ...m, dosage: e.target.value } : m))}
                        />
                        <input
                          className="border rounded px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                          placeholder="Frequency"
                          value={med.frequency}
                          onChange={e => setRxMedications(prev => prev.map((m, i) => i === idx ? { ...m, frequency: e.target.value } : m))}
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-muted-foreground whitespace-nowrap">Duration (days)</label>
                        <input
                          type="number"
                          min={1}
                          max={365}
                          className="w-16 border rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                          value={med.durationDays}
                          onChange={e => setRxMedications(prev => prev.map((m, i) => i === idx ? { ...m, durationDays: Number(e.target.value) || 1 } : m))}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Instructions */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Instructions</label>
                  <textarea
                    className="w-full border rounded-md px-2.5 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                    rows={2}
                    placeholder="Take with food, avoid alcohol, etc."
                    value={rxInstructions}
                    onChange={e => setRxInstructions(e.target.value)}
                  />
                </div>

                {/* Valid for days */}
                <div className="flex items-center gap-3">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Valid for (days)</label>
                  <input
                    type="number"
                    min={1}
                    max={365}
                    className="w-20 border rounded px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                    value={rxValidDays}
                    onChange={e => setRxValidDays(Number(e.target.value) || 30)}
                  />
                </div>

                {/* Delivery location — used for nearest-pharmacy routing */}
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Delivery Location (optional)</p>
                  <p className="text-xs text-muted-foreground/70">Used to auto-route to the nearest pharmacy with stock</p>
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      className="border rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                      placeholder="District"
                      value={rxDistrict}
                      onChange={e => setRxDistrict(e.target.value)}
                    />
                    <input
                      className="border rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                      placeholder="Sector"
                      value={rxSector}
                      onChange={e => setRxSector(e.target.value)}
                    />
                    <input
                      className="border rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                      placeholder="Cell"
                      value={rxCell}
                      onChange={e => setRxCell(e.target.value)}
                    />
                  </div>
                </div>

                <Button
                  className="w-full bg-green-600 hover:bg-green-700 text-white"
                  onClick={handleIssuePrescription}
                  disabled={issuingRx}
                >
                  {issuingRx
                    ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Issuing…</>
                    : <><Pill className="h-4 w-4 mr-2" />Issue Prescription</>
                  }
                </Button>

                <p className="text-xs text-muted-foreground/70 text-center leading-relaxed">
                  Prescription is saved to patient EHR, patient is notified, and the nearest pharmacy with stock is automatically assigned.
                </p>
              </CardContent>
            )}

          </Card>
        </div>
      </div>

      {/* ── Recording Consent Dialog ──────────────────────────────────────── */}
      <Dialog open={showConsentDialog} onOpenChange={setShowConsentDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Circle className="h-5 w-5 text-red-500" />
              Recording Consent Required
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm text-foreground/80">
            <p>Recording this consultation requires the explicit consent of <strong>both parties</strong>.</p>
            <p>By clicking <strong>"I Confirm & Record"</strong>, you confirm that:</p>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground pl-2">
              <li>The other participant has been informed that this consultation will be recorded.</li>
              <li>Both parties have agreed to the recording.</li>
              <li>The recording will be uploaded securely to the SHCP server and linked to this consultation.</li>
            </ul>
            <p className="text-xs text-muted-foreground/70">Your consent will be logged with a timestamp as part of the consultation audit trail.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConsentDialog(false)}>Cancel</Button>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={startRecording}
            >
              <Circle className="h-4 w-4 mr-2" />
              I Consent &amp; Start Recording
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
