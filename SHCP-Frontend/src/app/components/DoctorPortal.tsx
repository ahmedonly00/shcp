import React, { useState, useEffect } from 'react';
import { LocationPicker } from '@/app/components/ui/LocationPicker';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { Calendar } from '@/app/components/ui/calendar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/app/components/ui/dialog';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Textarea } from '@/app/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import {
  Calendar as CalendarIcon, Clock, Users, TrendingUp,
  Video, CheckCircle, XCircle, FileText,
  Plus, Edit, DollarSign, BarChart, User, Loader2, AlertTriangle, ArrowRight,
  AlertCircle, ShieldCheck, Download, X, FilePlus
} from 'lucide-react';
import { useAuth } from '@/app/context/AuthContext';
import { providersApi } from '@/app/api/providers';
import { analyticsApi } from '@/app/api/analytics';
import { appointmentsApi } from '@/app/api/appointments';
import { consultationsApi } from '@/app/api/consultations';
import { prescriptionsApi, MedicationItem } from '@/app/api/prescriptions';
import { referralsApi } from '@/app/api/referrals';
import { Appointment, mapApiAppointment, ApiHealthRecordDto, ApiSlot } from '@/app/types';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import {
  BarChart as RechartsBarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from 'recharts';
import { Skeleton } from '@/app/components/ui/skeleton';

// ── Prescription template presets ───────────────────────────────────────────

const TEMPLATES: Record<string, MedicationItem[]> = {
  'Common Cold': [
    { name: 'Paracetamol', dosage: '500mg', frequency: 'Every 6 hours', durationDays: 5 },
    { name: 'Vitamin C', dosage: '1000mg', frequency: 'Once daily', durationDays: 7 },
  ],
  'Headache': [
    { name: 'Ibuprofen', dosage: '400mg', frequency: 'Every 8 hours', durationDays: 3 },
  ],
  'Allergies': [
    { name: 'Cetirizine', dosage: '10mg', frequency: 'Once daily', durationDays: 14 },
  ],
  'Hypertension': [
    { name: 'Amlodipine', dosage: '5mg', frequency: 'Once daily', durationDays: 30 },
  ],
  'Diabetes': [
    { name: 'Metformin', dosage: '500mg', frequency: 'Twice daily with meals', durationDays: 30 },
  ],
  'Pain Relief': [
    { name: 'Diclofenac', dosage: '50mg', frequency: 'Every 8 hours', durationDays: 5 },
    { name: 'Omeprazole', dosage: '20mg', frequency: 'Once daily', durationDays: 5 },
  ],
};

interface DoctorPortalProps {
  onNavigateToConsultation?: (appointment: Appointment) => void;
}

const DoctorPortalSkeleton: React.FC = () => (
  <div className="space-y-6">
    <div className="space-y-2">
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-4 w-72" />
    </div>
    <div className="grid md:grid-cols-4 gap-4">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="rounded-lg border bg-card p-6">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <Skeleton className="h-3.5 w-28" />
              <Skeleton className="h-7 w-12" />
              <Skeleton className="h-3 w-20" />
            </div>
            <Skeleton className="h-12 w-12 rounded-full" />
          </div>
        </div>
      ))}
    </div>
    <div className="grid md:grid-cols-2 gap-6">
      <div className="rounded-lg border bg-card p-6 space-y-3">
        <Skeleton className="h-5 w-40" />
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-3 rounded-lg border">
            <Skeleton className="h-12 w-12 rounded-full shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-8 w-20" />
          </div>
        ))}
      </div>
      <div className="rounded-lg border bg-card p-6 space-y-3">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-[200px] w-full rounded-lg" />
      </div>
    </div>
  </div>
);

export const DoctorPortal: React.FC<DoctorPortalProps> = ({ onNavigateToConsultation }) => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [stats, setStats] = useState<{
    totalAppointments: number;
    completedAppointments: number;
    totalPatients: number;
    averageRating: number;
    totalEarnings: number;
    appointmentsThisMonth: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  // ── Action loading states ──────────────────────────────────────────────────
  const [startingId, setStartingId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [addingSlot, setAddingSlot] = useState(false);
  const [issuingRx, setIssuingRx] = useState(false);

  // ── Dialog states ──────────────────────────────────────────────────────────
  const [selectedApt, setSelectedApt] = useState<Appointment | null>(null);
  const [showAptDialog, setShowAptDialog] = useState(false);
  const [showSlotDialog, setShowSlotDialog] = useState(false);
  const [showRxDialog, setShowRxDialog] = useState(false);
  const [showReferralDialog, setShowReferralDialog] = useState(false);
  const [showEhrDialog, setShowEhrDialog] = useState(false);
  const [ehrPatientName, setEhrPatientName] = useState('');
  const [ehrData, setEhrData] = useState<ApiHealthRecordDto | null>(null);
  const [ehrLoading, setEhrLoading] = useState(false);

  // ── Prescription safety ────────────────────────────────────────────────────
  const [rxConflicts, setRxConflicts] = useState<string[]>([]);
  const [loadingEhrForRx, setLoadingEhrForRx] = useState(false);
  const [rxSignature, setRxSignature] = useState('');

  // ── Availability slots ─────────────────────────────────────────────────────
  const [mySlots, setMySlots] = useState<ApiSlot[]>([]);
  const [showWeeklyDialog, setShowWeeklyDialog] = useState(false);
  const [weeklyForm, setWeeklyForm] = useState({
    days: [] as number[],       // 0=Sun,1=Mon,...,6=Sat
    startTime: '09:00',
    endTime: '09:30',
    type: 'VIDEO' as 'VIDEO' | 'FOLLOWUP' | 'URGENT',
    weeksAhead: 4,
  });
  const [settingWeekly, setSettingWeekly] = useState(false);

  // ── Forms ──────────────────────────────────────────────────────────────────
  const [slotForm, setSlotForm] = useState(() => {
    // Default to tomorrow so times are always in the future
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return {
      date: tomorrow.toISOString().split('T')[0],
      startTime: '09:00',
      endTime: '09:30',
      type: 'VIDEO' as 'VIDEO' | 'FOLLOWUP' | 'URGENT',
    };
  });

  const [referralForm, setReferralForm] = useState({
    patientId: '',
    specialtyNeeded: '',
    reason: '',
    urgency: 'ROUTINE',
    notes: '',
  });
  const [creatingReferral, setCreatingReferral] = useState(false);

  const [rxForm, setRxForm] = useState({
    patientId: '',
    medications: [] as MedicationItem[],
    instructions: '',
    validForDays: 30,
    deliveryAddress: '',
    deliveryDistrict: '',
    deliverySector: '',
    deliveryCell: '',
    deliveryLatitude: '' as string,
    deliveryLongitude: '' as string,
  });
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [newMed, setNewMed] = useState<MedicationItem>({ name: '', dosage: '', frequency: '', durationDays: 1 });

  // ── Load data ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      const [appts, provStats, slots] = await Promise.allSettled([
        providersApi.getMyAppointments(0, 50),
        analyticsApi.providerStats(),
        providersApi.getMySlots(),
      ]);
      if (appts.status === 'fulfilled') {
        setAppointments((appts.value ?? []).map(mapApiAppointment));
      }
      if (provStats.status === 'fulfilled' && provStats.value) {
        setStats(provStats.value);
      }
      if (slots.status === 'fulfilled') {
        setMySlots(slots.value ?? []);
      }
      setLoading(false);
    };
    load();
  }, []);

  // ── Derived data ───────────────────────────────────────────────────────────
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayAppointments = appointments.filter(a => a.date === todayStr);
  const upcomingAppointments = appointments.filter(a => a.status === 'scheduled');
  const completedToday = todayAppointments.filter(a => a.status === 'completed').length;

  // Derive weekly consultations from loaded appointments
  const weeklyConsultations = (() => {
    const labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const counts = new Array(7).fill(0);
    appointments.forEach(a => {
      if (a.status === 'completed' || a.status === 'in-progress') {
        counts[new Date(a.date).getDay()]++;
      }
    });
    return labels.map((day, i) => ({ day, consultations: counts[i] }));
  })();

  // Unique patients from appointments for the prescription patient picker
  const patientOptions = Array.from(
    new Map(appointments.map(a => [a.patientId, a.patientName])).entries()
  ).map(([id, name]) => ({ id, name }));

  const statVal = (n: number | undefined) =>
    loading ? <Skeleton className="h-7 w-14 inline-block align-middle" /> : (n ?? 0).toLocaleString();

  // ── Calendar slot helpers ──────────────────────────────────────────────────
  const slotDateKey = (iso: string) => iso.slice(0, 10);

  const availableDates = [...new Set(
    mySlots.filter(s => !s.isBooked && !s.isBlocked).map(s => slotDateKey(s.startTime))
  )].map(d => new Date(d + 'T12:00:00'));

  const bookedDates = [...new Set(
    mySlots.filter(s => s.isBooked).map(s => slotDateKey(s.startTime))
  )].map(d => new Date(d + 'T12:00:00'));

  const blockedDates = [...new Set(
    mySlots.filter(s => s.isBlocked).map(s => slotDateKey(s.startTime))
  )].map(d => new Date(d + 'T12:00:00'));

  const slotsForDate = (date: Date | undefined): ApiSlot[] => {
    if (!date) return [];
    const key = date.toISOString().slice(0, 10);
    return mySlots.filter(s => slotDateKey(s.startTime) === key)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  };

  const handleBlockSlot = async (slotId: string) => {
    try {
      const updated = await providersApi.blockSlot(slotId);
      setMySlots(prev => prev.map(s => s.slotId === slotId ? updated : s));
      toast.success(updated.isBlocked ? 'Slot blocked' : 'Slot unblocked');
    } catch {
      toast.error('Failed to update slot');
    }
  };

  const handleExportIcal = async () => {
    try {
      const ical = await providersApi.exportIcal();
      const blob = new Blob([ical], { type: 'text/calendar' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'availability.ics'; a.click();
      URL.revokeObjectURL(url);
      toast.success('Calendar exported');
    } catch {
      toast.error('Export failed');
    }
  };

  const handleSetWeeklySchedule = async () => {
    if (weeklyForm.days.length === 0) { toast.error('Select at least one day'); return; }
    setSettingWeekly(true);
    try {
      const slots: { startTime: string; endTime: string; appointmentType: string }[] = [];
      const now = new Date();
      for (let w = 0; w < weeklyForm.weeksAhead; w++) {
        for (const dow of weeklyForm.days) {
          const d = new Date(now);
          d.setDate(now.getDate() + ((dow - now.getDay() + 7) % 7) + w * 7);
          if (d <= now) continue;
          const dateStr = d.toISOString().slice(0, 10);
          slots.push({
            startTime: new Date(`${dateStr}T${weeklyForm.startTime}`).toISOString(),
            endTime:   new Date(`${dateStr}T${weeklyForm.endTime}`).toISOString(),
            appointmentType: weeklyForm.type,
          });
        }
      }
      if (slots.length === 0) { toast.error('No future slots generated'); return; }
      await providersApi.setMyAvailability(slots);
      const updated = await providersApi.getMySlots();
      setMySlots(updated ?? []);
      setShowWeeklyDialog(false);
      toast.success(`${slots.length} slots scheduled`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })
        ?.response?.data?.error?.message;
      toast.error(msg || 'Failed to set schedule');
    } finally {
      setSettingWeekly(false);
    }
  };

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleStartConsultation = async (apt: Appointment) => {
    setStartingId(apt.id);
    try {
      await consultationsApi.start({ appointmentId: apt.id });
      setAppointments(prev =>
        prev.map(a => a.id === apt.id ? { ...a, status: 'in-progress' } : a)
      );
      setShowAptDialog(false);
      toast.success('Consultation started');
      onNavigateToConsultation?.(apt);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })
        ?.response?.data?.error?.message;
      toast.error(msg || 'Failed to start consultation');
    } finally {
      setStartingId(null);
    }
  };

  const handleCancelAppointment = async (aptId: string) => {
    setCancellingId(aptId);
    try {
      await appointmentsApi.cancel(aptId, { reason: 'Cancelled by provider' });
      setAppointments(prev =>
        prev.map(a => a.id === aptId ? { ...a, status: 'cancelled' } : a)
      );
      setShowAptDialog(false);
      toast.success('Appointment cancelled');
    } catch {
      toast.error('Failed to cancel appointment');
    } finally {
      setCancellingId(null);
    }
  };

  const handleAddSlot = async () => {
    // Parse as LOCAL time (no tz suffix → browser local), then convert to UTC ISO for the backend
    const startDate = new Date(`${slotForm.date}T${slotForm.startTime}`);
    const endDate = new Date(`${slotForm.date}T${slotForm.endTime}`);

    if (isNaN(startDate.getTime())) { toast.error('Invalid start date/time'); return; }
    if (isNaN(endDate.getTime())) { toast.error('Invalid end date/time'); return; }
    if (startDate <= new Date()) { toast.error('Start time must be in the future'); return; }
    if (endDate <= startDate) { toast.error('End time must be after start time'); return; }

    setAddingSlot(true);
    try {
      await providersApi.addSlot({
        startTime: startDate.toISOString(),   // UTC, e.g. 2026-03-24T07:00:00.000Z
        endTime: endDate.toISOString(),
        appointmentType: slotForm.type,
      });
      const updated = await providersApi.getMySlots();
      setMySlots(updated ?? []);
      setShowSlotDialog(false);
      toast.success('Availability slot added');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })
        ?.response?.data?.error?.message;
      toast.error(msg || 'Failed to add slot');
    } finally {
      setAddingSlot(false);
    }
  };

  const handleOpenBlank = () => {
    const defaultPatientId = patientOptions[0]?.id ?? '';
    setSelectedTemplate('');
    setRxForm({
      patientId: defaultPatientId, medications: [], instructions: '', validForDays: 30,
      deliveryAddress: '', deliveryDistrict: '', deliverySector: '', deliveryCell: '',
      deliveryLatitude: '', deliveryLongitude: '',
    });
    setRxConflicts([]);
    setRxSignature('');
    setNewMed({ name: '', dosage: '', frequency: '', durationDays: 1 });
    setShowRxDialog(true);
    if (defaultPatientId) handleRxPatientSelect(defaultPatientId, []);
  };

  const handleOpenTemplate = (template: string) => {
    const defaultPatientId = patientOptions[0]?.id ?? '';
    const medications = TEMPLATES[template] ?? [];
    setSelectedTemplate(template);
    setRxForm({
      patientId: defaultPatientId, medications, instructions: '', validForDays: 30,
      deliveryAddress: '', deliveryDistrict: '', deliverySector: '', deliveryCell: '',
      deliveryLatitude: '', deliveryLongitude: '',
    });
    setRxConflicts([]);
    setRxSignature('');
    setShowRxDialog(true);
    if (defaultPatientId) handleRxPatientSelect(defaultPatientId, medications);
  };

  const handleIssuePrescription = async () => {
    if (!rxForm.patientId) { toast.error('Please select a patient'); return; }
    if (rxForm.medications.length === 0) { toast.error('Please add at least one medication'); return; }
    if (!rxSignature.trim()) { toast.error('Please sign the prescription before issuing'); return; }
    if (rxSignature.trim() !== (user?.name ?? '').trim()) {
      toast.error('Signature does not match your registered name'); return;
    }
    setIssuingRx(true);
    try {
      const rx = await prescriptionsApi.issue({
        patientId: rxForm.patientId,
        medications: rxForm.medications,
        instructions: rxForm.instructions || undefined,
        validForDays: rxForm.validForDays,
        providerSignature: rxSignature.trim(),
        deliveryAddress:   rxForm.deliveryAddress   || undefined,
        deliveryDistrict:  rxForm.deliveryDistrict  || undefined,
        deliverySector:    rxForm.deliverySector    || undefined,
        deliveryCell:      rxForm.deliveryCell       || undefined,
        deliveryLatitude:  rxForm.deliveryLatitude  ? Number(rxForm.deliveryLatitude)  : undefined,
        deliveryLongitude: rxForm.deliveryLongitude ? Number(rxForm.deliveryLongitude) : undefined,
      });
      setShowRxDialog(false);
      setRxSignature('');
      toast.success(
        rx.pharmacyName
          ? `Prescription issued — assigned to ${rx.pharmacyName}`
          : 'Prescription issued. No nearby pharmacy found — please contact one directly.'
      );
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })
        ?.response?.data?.error?.message;
      toast.error(msg || 'Failed to issue prescription');
    } finally {
      setIssuingRx(false);
    }
  };

  const handleCreateReferral = async () => {
    if (!referralForm.patientId) { toast.error('Please select a patient'); return; }
    if (!referralForm.specialtyNeeded.trim()) { toast.error('Please enter specialty needed'); return; }
    if (!referralForm.reason.trim()) { toast.error('Please enter referral reason'); return; }
    setCreatingReferral(true);
    try {
      await referralsApi.create({
        patientId: referralForm.patientId,
        specialtyNeeded: referralForm.specialtyNeeded,
        reason: referralForm.reason,
        urgency: referralForm.urgency,
        notes: referralForm.notes || undefined,
      });
      setShowReferralDialog(false);
      setReferralForm({ patientId: '', specialtyNeeded: '', reason: '', urgency: 'ROUTINE', notes: '' });
      toast.success('Referral created successfully');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })
        ?.response?.data?.error?.message;
      toast.error(msg || 'Failed to create referral');
    } finally {
      setCreatingReferral(false);
    }
  };

  const openAptDialog = (apt: Appointment) => {
    setSelectedApt(apt);
    setShowAptDialog(true);
  };

  const detectConflicts = (medications: MedicationItem[], ehr: ApiHealthRecordDto): string[] => {
    const conflicts: string[] = [];
    let allergies: { allergen?: string; name?: string }[] = [];
    let existingMeds: { name?: string }[] = [];
    try { allergies = JSON.parse(ehr.allergies || '[]'); } catch { /* ignore */ }
    try { existingMeds = JSON.parse(ehr.medications || '[]'); } catch { /* ignore */ }
    medications.forEach(med => {
      const medName = med.name.toLowerCase();
      allergies.forEach(a => {
        const allergen = (a.allergen || a.name || '').toLowerCase();
        if (allergen && medName.includes(allergen))
          conflicts.push(`${med.name} conflicts with known allergy: ${a.allergen || a.name}`);
      });
      existingMeds.forEach(m => {
        if ((m.name || '').toLowerCase() === medName)
          conflicts.push(`${med.name} is already in patient's active medications`);
      });
    });
    return conflicts;
  };

  const handleRxPatientSelect = async (patientId: string, medications: MedicationItem[]) => {
    setRxForm(p => ({ ...p, patientId }));
    setRxConflicts([]);
    if (!patientId) return;
    setLoadingEhrForRx(true);
    try {
      const ehr = await providersApi.getPatientEhr(patientId);
      setRxConflicts(detectConflicts(medications, ehr));
    } catch { /* EHR unavailable — skip conflict check */ }
    finally { setLoadingEhrForRx(false); }
  };

  const handleViewEhr = async (patientId: string, patientName: string) => {
    setEhrPatientName(patientName);
    setEhrData(null);
    setShowEhrDialog(true);
    setEhrLoading(true);
    try {
      const data = await providersApi.getPatientEhr(patientId);
      setEhrData(data);
    } catch {
      toast.error('Could not load patient health records');
      setShowEhrDialog(false);
    } finally {
      setEhrLoading(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) return <DoctorPortalSkeleton />;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">{t("doctorPortal.title")}</h2>
        <p className="text-muted-foreground">{t('doctorPortal.subtitle')}</p>
      </div>

      {/* Quick Stats */}
      <div className="grid md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('doctorPortal.todayAppointments')}</p>
                <p className="text-2xl font-bold">
                  {loading ? <Loader2 className="h-5 w-5 animate-spin inline" /> : todayAppointments.length}
                </p>
                <p className="text-xs text-green-600">{loading ? '' : t('dashboard.completedToday', { count: completedToday })}</p>
              </div>
              <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center">
                <CalendarIcon className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('doctorPortal.patients_count')}</p>
                <p className="text-2xl font-bold">{statVal(stats?.totalPatients)}</p>
                <p className="text-xs text-blue-600">{t('dashboard.allTime')}</p>
              </div>
              <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center">
                <Users className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('doctorPortal.thisMonth')}</p>
                <p className="text-2xl font-bold">{statVal(stats?.appointmentsThisMonth)}</p>
                <p className="text-xs text-muted-foreground">{t('nav.consultation')}</p>
              </div>
              <div className="h-12 w-12 bg-purple-100 rounded-full flex items-center justify-center">
                <Video className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Patient Rating</p>
                <p className="text-2xl font-bold">
                  {loading
                    ? <Loader2 className="h-5 w-5 animate-spin inline" />
                    : (stats?.averageRating?.toFixed(1) ?? '—')}
                </p>
                <p className="text-xs text-yellow-600">★ Average rating</p>
              </div>
              <div className="h-12 w-12 bg-yellow-100 rounded-full flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-yellow-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Today's Schedule */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{t('doctorPortal.schedule')}</CardTitle>
              <Button size="sm" variant="outline" onClick={() => setShowSlotDialog(true)}>
                <Plus className="h-4 w-4 mr-1" />
                {t('doctorPortal.addSlot')}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/70" />
                </div>
              ) : todayAppointments.length > 0 ? (
                todayAppointments.map((apt) => (
                  <div key={apt.id} className="p-4 border rounded-lg hover:bg-muted/50">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center">
                          <User className="h-6 w-6 text-blue-600" />
                        </div>
                        <div>
                          <h4 className="font-medium">{apt.patientName}</h4>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                            <Clock className="h-3 w-3" />
                            <span>{apt.time}</span>
                            <span>•</span>
                            <span>{apt.duration} min</span>
                          </div>
                        </div>
                      </div>
                      <Badge variant={apt.status === 'completed' ? 'secondary' : 'default'}>
                        {apt.status}
                      </Badge>
                    </div>
                    <div className="bg-muted/50 rounded p-3 mb-3">
                      <p className="text-sm text-foreground/80">
                        <strong>Reason:</strong> {apt.reason || 'Not specified'}
                      </p>
                    </div>
                    {apt.status === 'scheduled' && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="flex-1"
                          onClick={() => handleStartConsultation(apt)}
                          disabled={startingId === apt.id}
                        >
                          {startingId === apt.id
                            ? <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                            : <Video className="h-4 w-4 mr-1" />}
                          Start Consultation
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => openAptDialog(apt)}>
                          <FileText className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => openAptDialog(apt)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                    {apt.status === 'in-progress' && (
                      <Button size="sm" className="w-full" variant="outline">
                        <CheckCircle className="h-4 w-4 mr-1 text-green-600" />
                        Consultation In Progress
                      </Button>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <CalendarIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>{t('doctorPortal.noAppointments')}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Availability Calendar */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{t('doctorPortal.availability')}</CardTitle>
              <Button size="sm" variant="outline" onClick={handleExportIcal} title="Export to iCal">
                <Download className="h-4 w-4 mr-1" /> iCal
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Legend */}
            <div className="flex gap-3 text-xs">
              <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-green-400 inline-block" />Available</span>
              <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-blue-400 inline-block" />Booked</span>
              <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-muted-foreground/40 inline-block" />Blocked</span>
            </div>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              className="rounded-md border"
              modifiers={{ available: availableDates, booked: bookedDates, blocked: blockedDates }}
              modifiersStyles={{
                available: { backgroundColor: '#bbf7d0', borderRadius: '50%', color: '#15803d' },
                booked:    { backgroundColor: '#bfdbfe', borderRadius: '50%', color: '#1d4ed8' },
                blocked:   { backgroundColor: '#e5e7eb', borderRadius: '50%', color: '#6b7280' },
              }}
            />

            {/* Slots for selected date */}
            {selectedDate && (() => {
              const daySlots = slotsForDate(selectedDate);
              if (daySlots.length === 0) return (
                <p className="text-xs text-muted-foreground/70 text-center py-2">No slots on this date</p>
              );
              return (
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {daySlots.map(s => {
                    const time = `${new Date(s.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – ${new Date(s.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
                    const statusColor = s.isBooked ? 'bg-blue-50 border-blue-200' : s.isBlocked ? 'bg-muted/50 border-border' : 'bg-green-50 border-green-200';
                    const label = s.isBooked ? 'Booked' : s.isBlocked ? 'Blocked' : 'Available';
                    return (
                      <div key={s.slotId} className={`flex items-center justify-between p-2 rounded border text-xs ${statusColor}`}>
                        <div>
                          <span className="font-medium">{time}</span>
                          <span className="ml-2 text-muted-foreground">{s.appointmentType}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Badge variant="outline" className="text-xs py-0">{label}</Badge>
                          {!s.isBooked && (
                            <Button size="sm" variant="ghost" className="h-6 px-1 text-xs"
                              onClick={() => handleBlockSlot(s.slotId)}>
                              {s.isBlocked ? 'Unblock' : 'Block'}
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            <div className="space-y-2 pt-1">
              <Button variant="outline" className="w-full justify-start" size="sm"
                onClick={() => setShowSlotDialog(true)}>
                <Plus className="h-4 w-4 mr-2" /> Add Slot
              </Button>
              <Button variant="outline" className="w-full justify-start" size="sm"
                onClick={() => setShowWeeklyDialog(true)}>
                <CalendarIcon className="h-4 w-4 mr-2" /> Set Weekly Schedule
              </Button>
              <Button variant="outline" className="w-full justify-start" size="sm"
                onClick={() => setShowReferralDialog(true)}>
                <ArrowRight className="h-4 w-4 mr-2" /> Create Referral
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Analytics */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart className="h-5 w-5" />
              Weekly Consultations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsBarChart data={weeklyConsultations}>
                  <CartesianGrid strokeDasharray="4 4" stroke="var(--border)" />
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={{ stroke: 'var(--border)' }} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '12px' }} />
                  <Bar dataKey="consultations" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
                </RechartsBarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Total Earnings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center h-[250px]">
              <div className="text-center">
                <p className="text-5xl font-bold text-green-600">
                  {loading
                    ? <Loader2 className="h-10 w-10 animate-spin mx-auto" />
                    : `RWF ${(stats?.totalEarnings ?? 0).toLocaleString()}`}
                </p>
                <p className="text-muted-foreground mt-2">{t('doctorPortal.totalEarnings')}</p>
                <p className="text-sm text-muted-foreground/70 mt-1">
                  {statVal(stats?.completedAppointments)} completed appointments
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Upcoming Appointments */}
      <Card>
        <CardHeader>
          <CardTitle>{t('doctorPortal.upcoming')}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/70" />
            </div>
          ) : upcomingAppointments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CalendarIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>{t('doctorPortal.noAppointments')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {upcomingAppointments.map((apt) => (
                <div key={apt.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 bg-muted rounded-full flex items-center justify-center">
                      <User className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <div>
                      <h4 className="font-medium">{apt.patientName}</h4>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                        <span className="flex items-center gap-1">
                          <CalendarIcon className="h-3 w-3" />
                          {apt.date}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {apt.time}
                        </span>
                        <Badge variant="outline" className="text-xs">{apt.type}</Badge>
                      </div>
                    </div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => openAptDialog(apt)}>
                    {t('doctorPortal.viewAll')}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Prescription Templates */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Quick Prescription Templates</CardTitle>
            <Button size="sm" onClick={handleOpenBlank} disabled={patientOptions.length === 0}>
              <FilePlus className="h-4 w-4 mr-1" /> Issue Prescription
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {patientOptions.length === 0 && !loading && (
            <p className="text-sm text-muted-foreground mb-3">
              No patients found. Prescriptions can be issued once you have appointments.
            </p>
          )}
          <div className="grid md:grid-cols-3 gap-3">
            {Object.keys(TEMPLATES).map((template) => (
              <Button
                key={template}
                variant="outline"
                className="justify-start h-auto py-3"
                onClick={() => handleOpenTemplate(template)}
                disabled={patientOptions.length === 0}
              >
                <div className="text-left">
                  <p className="font-medium">{template}</p>
                  <p className="text-xs text-muted-foreground">
                    {TEMPLATES[template].map(m => m.name).join(', ')}
                  </p>
                </div>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── Appointment Details Dialog ─────────────────────────────────────── */}
      <Dialog open={showAptDialog} onOpenChange={setShowAptDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Appointment Details</DialogTitle>
          </DialogHeader>
          {selectedApt && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Patient</p>
                  <p className="font-medium">{selectedApt.patientName}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <Badge>{selectedApt.status}</Badge>
                </div>
                <div>
                  <p className="text-muted-foreground">Date</p>
                  <p className="font-medium">{selectedApt.date}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Time</p>
                  <p className="font-medium">{selectedApt.time}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Type</p>
                  <p className="font-medium capitalize">{selectedApt.type}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Duration</p>
                  <p className="font-medium">{selectedApt.duration} min</p>
                </div>
              </div>
              {selectedApt.reason && (
                <div>
                  <p className="text-muted-foreground text-sm">Reason</p>
                  <p className="text-sm mt-1 bg-muted/50 rounded p-2">{selectedApt.reason}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter className="gap-2">
            {selectedApt && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setShowAptDialog(false); handleViewEhr(selectedApt.patientId, selectedApt.patientName); }}
              >
                <FileText className="h-4 w-4 mr-1" />
                View EHR
              </Button>
            )}
            {selectedApt?.status === 'scheduled' && (
              <>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => selectedApt && handleCancelAppointment(selectedApt.id)}
                  disabled={cancellingId === selectedApt?.id}
                >
                  {cancellingId === selectedApt?.id
                    ? <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    : <XCircle className="h-4 w-4 mr-1" />}
                  Cancel Appointment
                </Button>
                <Button
                  size="sm"
                  onClick={() => { setShowAptDialog(false); selectedApt && handleStartConsultation(selectedApt); }}
                  disabled={startingId === selectedApt?.id}
                >
                  <Video className="h-4 w-4 mr-1" />
                  Start Consultation
                </Button>
              </>
            )}
            <Button variant="outline" size="sm" onClick={() => setShowAptDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Add Slot Dialog ────────────────────────────────────────────────── */}
      <Dialog open={showSlotDialog} onOpenChange={setShowSlotDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Availability Slot</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Date</Label>
              <Input
                type="date"
                value={slotForm.date}
                min={new Date().toISOString().split('T')[0]}
                onChange={(e) => setSlotForm(p => ({ ...p, date: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Start Time</Label>
                <Input
                  type="time"
                  value={slotForm.startTime}
                  onChange={(e) => setSlotForm(p => ({ ...p, startTime: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>End Time</Label>
                <Input
                  type="time"
                  value={slotForm.endTime}
                  onChange={(e) => setSlotForm(p => ({ ...p, endTime: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Appointment Type</Label>
              <Select
                value={slotForm.type}
                onValueChange={(v) => setSlotForm(p => ({ ...p, type: v as typeof slotForm.type }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="VIDEO">Video Consultation</SelectItem>
                  <SelectItem value="FOLLOWUP">Follow-up</SelectItem>
                  <SelectItem value="URGENT">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSlotDialog(false)}>Cancel</Button>
            <Button onClick={handleAddSlot} disabled={addingSlot}>
              {addingSlot ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
              Add Slot
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Create Referral Dialog ────────────────────────────────────────── */}
      <Dialog open={showReferralDialog} onOpenChange={setShowReferralDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Patient Referral</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Patient</Label>
              <Select value={referralForm.patientId} onValueChange={(v) => setReferralForm(p => ({ ...p, patientId: v }))}>
                <SelectTrigger><SelectValue placeholder="Select patient" /></SelectTrigger>
                <SelectContent>
                  {patientOptions.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Specialty Needed</Label>
              <Input
                placeholder="e.g. Cardiology, Neurology, Orthopedics..."
                value={referralForm.specialtyNeeded}
                onChange={(e) => setReferralForm(p => ({ ...p, specialtyNeeded: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Urgency</Label>
              <Select value={referralForm.urgency} onValueChange={(v) => setReferralForm(p => ({ ...p, urgency: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ROUTINE">Routine</SelectItem>
                  <SelectItem value="URGENT">Urgent</SelectItem>
                  <SelectItem value="EMERGENCY">Emergency</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Reason for Referral</Label>
              <Textarea
                placeholder="Describe why this referral is needed..."
                rows={3}
                value={referralForm.reason}
                onChange={(e) => setReferralForm(p => ({ ...p, reason: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Additional Notes (optional)</Label>
              <Textarea
                placeholder="Any additional information for the specialist..."
                rows={2}
                value={referralForm.notes}
                onChange={(e) => setReferralForm(p => ({ ...p, notes: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReferralDialog(false)}>Cancel</Button>
            <Button onClick={handleCreateReferral} disabled={creatingReferral}>
              {creatingReferral ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ArrowRight className="h-4 w-4 mr-2" />}
              Create Referral
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Patient EHR Dialog ────────────────────────────────────────────── */}
      <Dialog open={showEhrDialog} onOpenChange={setShowEhrDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Health Records — {ehrPatientName}
            </DialogTitle>
          </DialogHeader>
          {ehrLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/70" />
            </div>
          ) : ehrData ? (
            <div className="space-y-4">
              {([
                { label: 'Diagnoses', key: 'diagnoses', color: 'bg-purple-100 text-purple-700' },
                { label: 'Medications', key: 'medications', color: 'bg-blue-100 text-blue-700' },
                { label: 'Allergies', key: 'allergies', color: 'bg-red-100 text-red-700' },
                { label: 'Immunizations', key: 'immunizations', color: 'bg-yellow-100 text-yellow-700' },
                { label: 'Lab Results', key: 'labResults', color: 'bg-green-100 text-green-700' },
              ] as { label: string; key: keyof ApiHealthRecordDto; color: string }[]).map(({ label, key, color }) => {
                let items: Record<string, string>[] = [];
                try { items = JSON.parse(ehrData[key] as string) ?? []; } catch { items = []; }
                return (
                  <div key={key}>
                    <div className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold mb-2 ${color}`}>
                      {label} ({items.length})
                    </div>
                    {items.length === 0 ? (
                      <p className="text-sm text-muted-foreground/70 pl-2">No records</p>
                    ) : (
                      <div className="space-y-2 pl-2">
                        {items.map((item, i) => {
                          const title = item.name || item.allergen || item.vaccine || item.testName || item.diagnosis || `Entry ${i + 1}`;
                          const notes = item.notes || item.description || item.result || item.reaction || '';
                          const detail = item.dosage ? `${item.dosage}${item.frequency ? ' · ' + item.frequency : ''}` : '';
                          return (
                            <div key={i} className="text-sm border rounded p-2 bg-muted/50">
                              <span className="font-medium">{title}</span>
                              {detail && <span className="text-muted-foreground ml-2 text-xs">{detail}</span>}
                              {notes && <p className="text-muted-foreground mt-0.5">{notes}</p>}
                              {item.date && <p className="text-xs text-muted-foreground/70 mt-0.5">{item.date}</p>}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEhrDialog(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Issue Prescription Dialog ──────────────────────────────────────── */}
      <Dialog open={showRxDialog} onOpenChange={setShowRxDialog}>
        <DialogContent className="max-w-2xl w-full">
          <DialogHeader>
            <DialogTitle>{selectedTemplate ? `Issue Prescription — ${selectedTemplate}` : 'Issue Prescription'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 overflow-y-auto max-h-[75vh] pr-1">
            <div className="space-y-2">
              <Label>Patient</Label>
              <Select
                value={rxForm.patientId}
                onValueChange={(v) => handleRxPatientSelect(v, rxForm.medications)}
              >
                <SelectTrigger><SelectValue placeholder="Select patient" /></SelectTrigger>
                <SelectContent>
                  {patientOptions.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {loadingEhrForRx && (
                <p className="text-xs text-muted-foreground/70 flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" /> Checking patient records...
                </p>
              )}
            </div>

            {/* Drug interaction / allergy conflict alert */}
            {rxConflicts.length > 0 && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-300 rounded p-3 text-sm text-red-800">
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0 text-red-600" />
                <div>
                  <p className="font-semibold">Drug Interaction / Allergy Alert</p>
                  <ul className="mt-1 space-y-0.5 list-disc list-inside">
                    {rxConflicts.map((c, i) => <li key={i}>{c}</li>)}
                  </ul>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Medications</Label>
              {rxForm.medications.length > 0 && (
                <div className="border rounded-lg divide-y text-sm">
                  {rxForm.medications.map((med, i) => (
                    <div key={i} className="p-3 flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium">{med.name} — {med.dosage}</p>
                        <p className="text-muted-foreground">{med.frequency} · {med.durationDays} days</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 shrink-0 text-muted-foreground hover:text-red-500"
                        onClick={() => {
                          const updated = rxForm.medications.filter((_, j) => j !== i);
                          setRxForm(p => ({ ...p, medications: updated }));
                          if (rxForm.patientId) handleRxPatientSelect(rxForm.patientId, updated);
                        }}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <div className="border rounded-lg p-3 space-y-2 bg-muted/30">
                <p className="text-xs font-medium text-muted-foreground">Add Medication</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Input
                    placeholder="Medication name"
                    value={newMed.name}
                    onChange={e => setNewMed(p => ({ ...p, name: e.target.value }))}
                  />
                  <Input
                    placeholder="Dosage (e.g. 500mg)"
                    value={newMed.dosage}
                    onChange={e => setNewMed(p => ({ ...p, dosage: e.target.value }))}
                  />
                  <Input
                    placeholder="Frequency (e.g. Twice daily)"
                    value={newMed.frequency}
                    onChange={e => setNewMed(p => ({ ...p, frequency: e.target.value }))}
                  />
                  <Input
                    type="number"
                    min={1}
                    placeholder="Duration (days)"
                    value={newMed.durationDays || ''}
                    onChange={e => setNewMed(p => ({ ...p, durationDays: Number(e.target.value) }))}
                  />
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!newMed.name.trim() || !newMed.dosage.trim() || !newMed.frequency.trim() || !newMed.durationDays}
                  onClick={() => {
                    const updated = [...rxForm.medications, { ...newMed }];
                    setRxForm(p => ({ ...p, medications: updated }));
                    setNewMed({ name: '', dosage: '', frequency: '', durationDays: 1 });
                    if (rxForm.patientId) handleRxPatientSelect(rxForm.patientId, updated);
                  }}
                >
                  <Plus className="h-3 w-3 mr-1" /> Add
                </Button>
              </div>
            </div>

            <div className="w-full sm:w-1/2 space-y-2">
              <Label>Valid for (days)</Label>
              <Input
                type="number"
                min={1}
                value={rxForm.validForDays}
                onChange={(e) => setRxForm(p => ({ ...p, validForDays: Number(e.target.value) }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Instructions (optional)</Label>
              <Textarea
                placeholder="Additional instructions for the patient..."
                rows={3}
                value={rxForm.instructions}
                onChange={(e) => setRxForm(p => ({ ...p, instructions: e.target.value }))}
              />
            </div>

            {/* Delivery location — used for automatic pharmacy matching */}
            <div className="space-y-2 border rounded-lg p-3 bg-blue-50">
              <p className="text-xs font-semibold text-blue-700">
                Patient Delivery Location (for nearest-pharmacy matching)
              </p>
              <div className="space-y-2">
                <Input
                  placeholder="Full delivery address / landmark"
                  value={rxForm.deliveryAddress}
                  onChange={e => setRxForm(p => ({ ...p, deliveryAddress: e.target.value }))}
                />
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <Input
                    placeholder="District"
                    value={rxForm.deliveryDistrict}
                    onChange={e => setRxForm(p => ({ ...p, deliveryDistrict: e.target.value }))}
                  />
                  <Input
                    placeholder="Sector"
                    value={rxForm.deliverySector}
                    onChange={e => setRxForm(p => ({ ...p, deliverySector: e.target.value }))}
                  />
                  <Input
                    placeholder="Cell"
                    value={rxForm.deliveryCell}
                    onChange={e => setRxForm(p => ({ ...p, deliveryCell: e.target.value }))}
                  />
                </div>
                <p className="text-xs text-blue-500">
                  Cell › Sector › District — the most specific location provided will be used first.
                </p>
                {/* GPS — search delivery location or use browser location */}
                <div className="rounded-md border border-green-200 bg-green-50 p-2 mt-1">
                  <LocationPicker
                    latitude={rxForm.deliveryLatitude ? Number(rxForm.deliveryLatitude) : undefined}
                    longitude={rxForm.deliveryLongitude ? Number(rxForm.deliveryLongitude) : undefined}
                    onSelect={(lat, lon) => setRxForm(p => ({
                      ...p,
                      deliveryLatitude:  String(lat),
                      deliveryLongitude: String(lon),
                    }))}
                    searchHint={[rxForm.deliveryCell, rxForm.deliverySector, rxForm.deliveryDistrict].filter(Boolean).join(', ')}
                    label="Delivery GPS (optional — improves pharmacy matching)"
                  />
                </div>
              </div>
            </div>

            {/* Digital signature panel */}
            <div className="space-y-2 border rounded-lg p-3 bg-muted/50">
              <div className="flex items-center gap-2 mb-1">
                <ShieldCheck className="h-4 w-4 text-blue-600" />
                <Label className="text-sm font-semibold">Provider Digital Signature</Label>
              </div>
              <p className="text-xs text-muted-foreground">Type your full name exactly as registered to authenticate this prescription</p>
              <Input
                placeholder={user?.name ?? 'Your full name'}
                value={rxSignature}
                onChange={(e) => setRxSignature(e.target.value)}
              />
              {rxSignature.trim() !== '' && rxSignature.trim() !== (user?.name ?? '').trim() && (
                <p className="text-xs text-red-500">Signature must match your registered name: {user?.name}</p>
              )}
              {rxSignature.trim() !== '' && rxSignature.trim() === (user?.name ?? '').trim() && (
                <p className="text-xs text-green-600 flex items-center gap-1">
                  <CheckCircle className="h-3 w-3" /> Signature verified
                </p>
              )}
            </div>

            {rxConflicts.length === 0 && (
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded p-3 text-sm text-amber-800">
                <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <p>Review dosages and check for contraindications before issuing.</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowRxDialog(false); setRxSignature(''); setRxConflicts([]); setNewMed({ name: '', dosage: '', frequency: '', durationDays: 1 }); }}>Cancel</Button>
            <Button
              onClick={handleIssuePrescription}
              disabled={issuingRx || !rxForm.patientId || rxSignature.trim() !== (user?.name ?? '').trim()}
            >
              {issuingRx ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileText className="h-4 w-4 mr-2" />}
              Issue Prescription
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Weekly Schedule Dialog ─────────────────────────────────────────── */}
      <Dialog open={showWeeklyDialog} onOpenChange={setShowWeeklyDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5" />
              Set Weekly Recurring Schedule
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Days of Week</Label>
              <div className="flex gap-2 flex-wrap">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setWeeklyForm(p => ({
                      ...p,
                      days: p.days.includes(i) ? p.days.filter(d => d !== i) : [...p.days, i],
                    }))}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                      weeklyForm.days.includes(i)
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-background text-foreground/80 border-border hover:border-primary/40'
                    }`}
                  >
                    {day}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Start Time</Label>
                <Input
                  type="time"
                  value={weeklyForm.startTime}
                  onChange={(e) => setWeeklyForm(p => ({ ...p, startTime: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>End Time</Label>
                <Input
                  type="time"
                  value={weeklyForm.endTime}
                  onChange={(e) => setWeeklyForm(p => ({ ...p, endTime: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Appointment Type</Label>
              <Select
                value={weeklyForm.type}
                onValueChange={(v) => setWeeklyForm(p => ({ ...p, type: v as typeof weeklyForm.type }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="VIDEO">Video Consultation</SelectItem>
                  <SelectItem value="FOLLOWUP">Follow-up</SelectItem>
                  <SelectItem value="URGENT">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Schedule for how many weeks ahead?</Label>
              <Select
                value={String(weeklyForm.weeksAhead)}
                onValueChange={(v) => setWeeklyForm(p => ({ ...p, weeksAhead: Number(v) }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 week</SelectItem>
                  <SelectItem value="2">2 weeks</SelectItem>
                  <SelectItem value="4">4 weeks</SelectItem>
                  <SelectItem value="8">8 weeks</SelectItem>
                  <SelectItem value="12">12 weeks</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded p-2 text-xs text-blue-700">
              <Clock className="h-4 w-4 flex-shrink-0" />
              <span>
                This will <strong>replace</strong> all future unbooked slots with the new schedule.
                Already-booked appointments are never affected.
              </span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowWeeklyDialog(false)}>Cancel</Button>
            <Button
              onClick={handleSetWeeklySchedule}
              disabled={settingWeekly || weeklyForm.days.length === 0}
            >
              {settingWeekly
                ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                : <CalendarIcon className="h-4 w-4 mr-2" />}
              Apply Schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
