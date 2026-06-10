import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Progress } from '@/app/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/app/components/ui/dialog';
import {
  Smartphone, Watch, Activity, Heart, Footprints,
  Droplets, Moon, Pill, Target, Plus,
  Bluetooth, CheckCircle, AlertCircle, Loader2, Thermometer, Wind,
  Save, Edit2, RefreshCw, Wifi, WifiOff, Zap,
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { toast } from 'sonner';
import { patientsApi } from '@/app/api/patients';
import { prescriptionsApi } from '@/app/api/prescriptions';
import { HealthGoal, ActivityLog, Medication } from '@/app/types';
import { bluetoothHealth, BleDevice, VitalsUpdate } from '@/app/services/bluetoothService';
import { googleFit, FitDaySummary } from '@/app/services/googleFitService';

// ── Types ──────────────────────────────────────────────────────────────────────

interface VitalsData {
  heartRate?: string;
  bloodPressure?: string;
  temperature?: string;
  oxygenSaturation?: string;
  weight?: string;
  glucose?: string;
}

interface MedReminder {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  taken: boolean;
}

interface ConnectedBleDevice extends BleDevice {
  /** Latest vitals streamed live from this device (not yet persisted) */
  liveVitals: VitalsUpdate;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const DEFAULT_GOALS: HealthGoal[] = [
  { id: '1', title: 'Daily Steps',   target: 10000, current: 0, unit: 'steps'   },
  { id: '2', title: 'Water Intake',  target: 8,     current: 0, unit: 'glasses' },
  { id: '3', title: 'Sleep Hours',   target: 8,     current: 0, unit: 'hours'   },
  { id: '4', title: 'Exercise Time', target: 60,    current: 0, unit: 'minutes' },
];

/** How long (ms) after the last BLE reading before we stop showing the "live" pulse */
const LIVE_TIMEOUT_MS = 10_000;

// ── Helpers ────────────────────────────────────────────────────────────────────

function goalIcon(id: string) {
  if (id === '1') return <Footprints className="h-5 w-5" />;
  if (id === '2') return <Droplets   className="h-5 w-5" />;
  if (id === '3') return <Moon       className="h-5 w-5" />;
  return <Activity className="h-5 w-5" />;
}

function deviceIcon(services: string[]) {
  const s = services.join(' ');
  if (s.includes('180d') || s.includes('heart_rate'))     return <Heart    className="h-6 w-6" />;
  if (s.includes('1810') || s.includes('blood_pressure')) return <Activity className="h-6 w-6" />;
  if (s.includes('181d') || s.includes('weight'))         return <Activity className="h-6 w-6" />;
  return <Watch className="h-6 w-6" />;
}

function batteryColor(pct: number) {
  if (pct > 60) return 'text-green-600';
  if (pct > 25) return 'text-amber-500';
  return 'text-red-500';
}

// ── Component ──────────────────────────────────────────────────────────────────

export const MobileHealth: React.FC = () => {
  const { t } = useTranslation();

  // ── Data state ──────────────────────────────────────────────────────────────
  const [vitals,       setVitals]       = useState<VitalsData>({});
  const [medReminders, setMedReminders] = useState<MedReminder[]>([]);
  const [healthGoals,  setHealthGoals]  = useState<HealthGoal[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);

  const [loadingVitals,   setLoadingVitals]   = useState(true);
  const [loadingMeds,     setLoadingMeds]     = useState(true);
  const [loadingGoals,    setLoadingGoals]    = useState(true);
  const [loadingActivity, setLoadingActivity] = useState(true);

  // ── BLE device state ────────────────────────────────────────────────────────
  const [bleDevices,  setBleDevices]  = useState<ConnectedBleDevice[]>([]);
  const [scanning,    setScanning]    = useState(false);
  /** Vitals keys currently being streamed live from a BLE device */
  const [liveFields,  setLiveFields]  = useState<Set<string>>(new Set());

  // ── Google Fit state ────────────────────────────────────────────────────────
  const [fitSyncing,  setFitSyncing]  = useState(false);
  const [fitLastSync, setFitLastSync] = useState<Date | null>(null);

  // ── Dialog state ────────────────────────────────────────────────────────────
  const [showVitalsDialog,   setShowVitalsDialog]   = useState(false);
  const [editVitals,         setEditVitals]         = useState<VitalsData>({});
  const [savingVitals,       setSavingVitals]       = useState(false);

  const [showGoalDialog,  setShowGoalDialog]  = useState(false);
  const [showUpdateGoal,  setShowUpdateGoal]  = useState<HealthGoal | null>(null);
  const [newGoal,         setNewGoal]         = useState({ title: '', target: '', unit: '' });
  const [savingGoal,      setSavingGoal]      = useState(false);

  const [showActivityDialog, setShowActivityDialog] = useState(false);
  const [activityForm,       setActivityForm]       = useState<Omit<ActivityLog,'date'>>({ steps: 0, calories: 0, exerciseMinutes: 0, waterGlasses: 0, sleepHours: 0 });
  const [savingActivity,     setSavingActivity]     = useState(false);

  // ── Refs ────────────────────────────────────────────────────────────────────
  /** Holds the most recent merged vitals for the debounced BLE save */
  const latestVitals    = useRef<VitalsData>({});
  /** Debounce timer — auto-saves vitals to backend 5 s after last BLE reading */
  const saveBleTimer    = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Timers that clear the "live" indicator per vitals field */
  const liveFieldTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // ── Load backend data ───────────────────────────────────────────────────────

  useEffect(() => {
    patientsApi.getMyEhr()
      .then(ehr => {
        if (ehr?.vitals) {
          try {
            const parsed = typeof ehr.vitals === 'string' ? JSON.parse(ehr.vitals) : ehr.vitals;
            setVitals(parsed);
            latestVitals.current = parsed;
          } catch { /* ignore */ }
        }
      })
      .catch(() => {})
      .finally(() => setLoadingVitals(false));
  }, []);

  useEffect(() => {
    prescriptionsApi.getMine()
      .then(prescriptions => {
        const reminders: MedReminder[] = [];
        for (const p of prescriptions ?? []) {
          if (!['PENDING', 'PROCESSING', 'READY_FOR_DELIVERY'].includes(p.status)) continue;
          try {
            const meds: Medication[] = typeof p.medications === 'string'
              ? JSON.parse(p.medications) : p.medications;
            for (const med of meds ?? []) {
              reminders.push({ id: `${p.prescriptionId}-${med.name}`, name: med.name, dosage: med.dosage, frequency: med.frequency, taken: false });
            }
          } catch { /* skip */ }
        }
        setMedReminders(reminders);
      })
      .catch(() => {})
      .finally(() => setLoadingMeds(false));
  }, []);

  useEffect(() => {
    patientsApi.getHealthGoals()
      .then(goals => setHealthGoals(goals.length ? goals : DEFAULT_GOALS))
      .catch(() => setHealthGoals(DEFAULT_GOALS))
      .finally(() => setLoadingGoals(false));
  }, []);

  useEffect(() => {
    patientsApi.getActivityLogs()
      .then(logs => setActivityLogs(logs.slice(-7)))
      .catch(() => {})
      .finally(() => setLoadingActivity(false));
  }, []);

  // ── BLE event subscriptions ─────────────────────────────────────────────────

  useEffect(() => {
    const unsubVitals = bluetoothHealth.onVitalsUpdate((update, deviceId) => {
      // Merge into vitals state immediately (live display)
      setVitals(prev => {
        const merged = { ...prev, ...update };
        latestVitals.current = merged;

        // Debounce backend save — 5 s after last reading
        if (saveBleTimer.current) clearTimeout(saveBleTimer.current);
        saveBleTimer.current = setTimeout(() => {
          patientsApi.updateVitals(latestVitals.current as Record<string, string>)
            .catch(() => { /* best-effort */ });
        }, 5000);

        return merged;
      });

      // Mark fields as "live" and schedule auto-clear
      setLiveFields(prev => new Set([...prev, ...Object.keys(update)]));
      for (const key of Object.keys(update)) {
        const existing = liveFieldTimers.current.get(key);
        if (existing) clearTimeout(existing);
        const t = setTimeout(() => {
          setLiveFields(prev => { const s = new Set(prev); s.delete(key); return s; });
          liveFieldTimers.current.delete(key);
        }, LIVE_TIMEOUT_MS);
        liveFieldTimers.current.set(key, t);
      }

      // Update per-device live vitals for the device card
      setBleDevices(prev => prev.map(d =>
        d.id === deviceId
          ? { ...d, liveVitals: { ...d.liveVitals, ...update } }
          : d,
      ));
    });

    const unsubDisconnect = bluetoothHealth.onDisconnect((deviceId) => {
      setBleDevices(prev => prev.filter(d => d.id !== deviceId));
      toast.info(t('mobileHealth.toastDeviceDisconnected'));
    });

    return () => {
      unsubVitals();
      unsubDisconnect();
      if (saveBleTimer.current) clearTimeout(saveBleTimer.current);
      // eslint-disable-next-line react-hooks/exhaustive-deps
      liveFieldTimers.current.forEach(t => clearTimeout(t));
    };
  }, []);

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleScanBluetooth = async () => {
    if (!bluetoothHealth.isSupported()) {
      toast.error(t('mobileHealth.toastBluetoothNotSupported'));
      return;
    }
    setScanning(true);
    try {
      const device = await bluetoothHealth.scan();
      setBleDevices(prev => {
        // Avoid duplicates if user re-selects the same device
        const filtered = prev.filter(d => d.id !== device.id);
        return [...filtered, { ...device, liveVitals: {} }];
      });
      toast.success(t('mobileHealth.toastConnectedTo', { name: device.name }));
    } catch (err) {
      const msg = (err as Error).message ?? '';
      // "User cancelled" is not an error we need to surface
      if (!msg.toLowerCase().includes('cancel') && !msg.toLowerCase().includes('chosen')) {
        toast.error(msg || t('mobileHealth.toastCouldNotConnect'));
      }
    } finally {
      setScanning(false);
    }
  };

  const handleDisconnect = useCallback(async (device: ConnectedBleDevice) => {
    await bluetoothHealth.disconnect(device.id);
    setBleDevices(prev => prev.filter(d => d.id !== device.id));
    toast.info(t('mobileHealth.toastDisconnectedFrom', { name: device.name }));
  }, []);

  const handleGoogleFitSync = async () => {
    if (!googleFit.isConfigured()) {
      toast.error(t('mobileHealth.toastFitEnvHint'), { duration: 6000 });
      return;
    }
    setFitSyncing(true);
    try {
      const days: FitDaySummary[] = await googleFit.fetchLastNDays(7);

      const entries = days
        .filter(d => d.steps > 0 || d.calories > 0 || d.sleepHours > 0)
        .map(d => ({
          date:            d.date,
          steps:           d.steps,
          calories:        d.calories,
          exerciseMinutes: d.activeMinutes,
          waterGlasses:    0,
          sleepHours:      d.sleepHours,
        }));

      if (entries.length === 0) {
        toast.info(t('mobileHealth.toastFitNoData'));
        return;
      }

      // Log the most recent 3 days (to avoid flooding the history)
      for (const entry of entries.slice(-3)) {
        await patientsApi.logActivity(entry).catch(() => { /* skip failures */ });
      }
      setActivityLogs(entries.slice(-7));

      // Import weight if available — skip if a BLE device is currently streaming weight live
      const latestWeight = [...days].reverse().find(d => d.weightKg);
      if (latestWeight?.weightKg && !liveFields.has('weight')) {
        const weightStr = `${latestWeight.weightKg.toFixed(1)} kg`;
        await patientsApi.updateVitals({ weight: weightStr }).catch(() => {});
        setVitals(prev => ({ ...prev, weight: weightStr }));
      }

      // Import latest avg heart rate if available — skip if a BLE device is currently streaming live
      const latestHR = [...days].reverse().find(d => d.heartRateBpm);
      if (latestHR?.heartRateBpm && !liveFields.has('heartRate')) {
        const hrStr = `${latestHR.heartRateBpm} bpm`;
        await patientsApi.updateVitals({ heartRate: hrStr }).catch(() => {});
        setVitals(prev => ({ ...prev, heartRate: hrStr }));
      }

      // Auto-update goals from the latest day's data
      const lastEntry = entries[entries.length - 1];
      if (lastEntry) {
        const updated = healthGoals.map(g => {
          if (g.id === '1') return { ...g, current: lastEntry.steps };
          if (g.id === '4') return { ...g, current: lastEntry.exerciseMinutes };
          if (g.id === '3') return { ...g, current: lastEntry.sleepHours };
          return g;
        });
        await patientsApi.updateHealthGoals(updated).catch(() => {});
        setHealthGoals(updated);
      }

      setFitLastSync(new Date());
      toast.success(t('mobileHealth.toastFitSynced', { count: entries.length }));
    } catch (err) {
      const msg = (err as Error).message ?? '';
      if (!msg.includes('popup_closed')) {
        toast.error(msg || t('mobileHealth.toastFitFailed'));
      }
    } finally {
      setFitSyncing(false);
    }
  };

  const handleSaveVitals = async () => {
    setSavingVitals(true);
    try {
      // Filter out blank entries — blank means "keep the current value"
      const updates = Object.fromEntries(
        Object.entries(editVitals).filter(([, v]) => typeof v === 'string' && v.trim() !== '')
      ) as VitalsData;
      const merged = { ...vitals, ...updates };
      await patientsApi.updateVitals(merged as Record<string, string>);
      setVitals(merged);
      latestVitals.current = merged;
      toast.success(t('mobileHealth.toastVitalsUpdated'));
      setShowVitalsDialog(false);
    } catch { toast.error(t('mobileHealth.toastVitalsFailed')); }
    finally { setSavingVitals(false); }
  };

  const handleAddGoal = async () => {
    if (!newGoal.title.trim() || !newGoal.target || !newGoal.unit.trim()) {
      toast.error(t('mobileHealth.toastGoalFieldsRequired')); return;
    }
    setSavingGoal(true);
    try {
      const goal: HealthGoal = { id: Date.now().toString(), title: newGoal.title, target: Number(newGoal.target), current: 0, unit: newGoal.unit };
      const updated = [...healthGoals, goal];
      await patientsApi.updateHealthGoals(updated);
      setHealthGoals(updated);
      toast.success(t('mobileHealth.toastGoalAdded'));
      setShowGoalDialog(false);
      setNewGoal({ title: '', target: '', unit: '' });
    } catch { toast.error(t('mobileHealth.toastGoalFailed')); }
    finally { setSavingGoal(false); }
  };

  const handleUpdateGoalProgress = async (goal: HealthGoal, newCurrent: number) => {
    const updated = healthGoals.map(g => g.id === goal.id ? { ...g, current: newCurrent } : g);
    try {
      await patientsApi.updateHealthGoals(updated);
      setHealthGoals(updated);
      if (newCurrent >= goal.target) toast.success(t('mobileHealth.toastGoalAchieved', { title: goal.title }));
      else toast.success(t('mobileHealth.toastProgressUpdated'));
    } catch { toast.error(t('mobileHealth.toastProgressFailed')); }
    setShowUpdateGoal(null);
  };

  const handleLogActivity = async () => {
    setSavingActivity(true);
    try {
      const entry: ActivityLog = { date: new Date().toISOString().slice(0, 10), ...activityForm };
      const updated = await patientsApi.logActivity(entry);
      try { setActivityLogs(JSON.parse(updated.activityLogs || '[]').slice(-7)); } catch { /* */ }
      const goalsToUpdate = healthGoals.map(g => {
        if (g.id === '1') return { ...g, current: entry.steps };
        if (g.id === '2') return { ...g, current: entry.waterGlasses };
        if (g.id === '3') return { ...g, current: entry.sleepHours };
        if (g.id === '4') return { ...g, current: entry.exerciseMinutes };
        return g;
      });
      await patientsApi.updateHealthGoals(goalsToUpdate);
      setHealthGoals(goalsToUpdate);
      toast.success(t('mobileHealth.toastActivityLogged'));
      setShowActivityDialog(false);
      setActivityForm({ steps: 0, calories: 0, exerciseMinutes: 0, waterGlasses: 0, sleepHours: 0 });
    } catch { toast.error(t('mobileHealth.toastActivityFailed')); }
    finally { setSavingActivity(false); }
  };

  const markMedTaken = (id: string) => {
    setMedReminders(prev => prev.map(m => m.id === id ? { ...m, taken: true } : m));
    toast.success(t('mobileHealth.toastMarkedTaken'));
  };

  const vStat = (v?: string) =>
    loadingVitals
      ? <Loader2 className="h-4 w-4 animate-spin inline" />
      : (v || '—');

  const chartData = (() => {
    const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    if (activityLogs.length === 0) return labels.map(day => ({ day, steps: 0, calories: 0 }));
    return activityLogs.slice(-7).map((log, i) => ({
      day:      labels[i % 7],
      steps:    log.steps,
      calories: log.calories,
    }));
  })();

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">{t('mobileHealth.title')}</h2>
          <p className="text-muted-foreground">{t('mobileHealth.subtitle')}</p>
        </div>
        <Button variant="outline" onClick={() => setShowActivityDialog(true)}>
          <Plus className="h-4 w-4 mr-2" /> {t('mobileHealth.logActivity')}
        </Button>
      </div>

      {/* ── Vitals cards ── */}
      <div className="grid md:grid-cols-4 gap-4">
        {([
          { key: 'heartRate',        label: t('mobileHealth.vitalHeartRate'),     unit: 'bpm',  icon: <Heart       className="h-6 w-6 text-red-600"    />, bg: 'bg-red-100'    },
          { key: 'bloodPressure',    label: t('mobileHealth.vitalBloodPressure'), unit: 'mmHg', icon: <Activity    className="h-6 w-6 text-blue-600"   />, bg: 'bg-blue-100'   },
          { key: 'temperature',      label: t('mobileHealth.vitalTemperature'),   unit: '°C',   icon: <Thermometer className="h-6 w-6 text-orange-600" />, bg: 'bg-orange-100' },
          { key: 'oxygenSaturation', label: t('mobileHealth.vitalOxygen'),        unit: 'SpO₂', icon: <Wind        className="h-6 w-6 text-purple-600" />, bg: 'bg-purple-100' },
        ] as { key: keyof VitalsData; label: string; unit: string; icon: React.ReactNode; bg: string }[]).map(v => (
          <Card key={v.key} className="relative overflow-hidden">
            {liveFields.has(v.key) && (
              <span className="absolute top-2 right-2 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
              </span>
            )}
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{v.label}</p>
                  <p className="text-2xl font-bold">{vStat(vitals[v.key])}</p>
                  <p className="text-xs text-muted-foreground/70">{v.unit}</p>
                </div>
                <div className={`h-12 w-12 ${v.bg} rounded-full flex items-center justify-center`}>{v.icon}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={() => { setEditVitals({ ...vitals }); setShowVitalsDialog(true); }}>
          <Edit2 className="h-4 w-4 mr-2" /> {t('mobileHealth.updateVitals')}
        </Button>
      </div>

      {!loadingVitals && Object.values(vitals).filter(Boolean).length === 0 && bleDevices.length === 0 && (
        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="pt-5">
            <div className="flex gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-amber-800">
                {t('mobileHealth.noVitalsHint')}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid lg:grid-cols-3 gap-6">

        {/* ── Connected Devices + Google Fit ── */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Bluetooth className="h-5 w-5 text-blue-600" />
                {t('mobileHealth.connectedDevices')}
              </CardTitle>
              <Button
                size="sm"
                onClick={handleScanBluetooth}
                disabled={scanning}
              >
                {scanning
                  ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" />{t('mobileHealth.scanning')}</>
                  : <><Bluetooth className="h-4 w-4 mr-1" />{t('mobileHealth.scanForDevice')}</>}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">

            {/* Device list */}
            {bleDevices.length === 0 ? (
              <div className="border-2 border-dashed border-border rounded-lg p-6 text-center text-muted-foreground">
                <Bluetooth className="h-10 w-10 mx-auto mb-3 text-muted-foreground/70" />
                <p className="font-medium text-sm">{t('mobileHealth.noDevicesConnected')}</p>
                <p className="text-xs mt-1 text-muted-foreground/70">
                  {t('mobileHealth.noDevicesHint')}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {bleDevices.map(device => (
                  <div key={device.id} className="p-4 border rounded-lg bg-green-50 border-green-200">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded-full bg-green-100 text-green-700 flex items-center justify-center">
                          {deviceIcon(device.services)}
                        </div>
                        <div>
                          <h4 className="font-semibold text-sm">{device.name}</h4>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <Badge variant="default" className="text-xs bg-green-600">
                              <Wifi className="h-3 w-3 mr-1" />{t('mobileHealth.live')}
                            </Badge>
                            {device.battery !== undefined && (
                              <span className={`text-xs font-medium ${batteryColor(device.battery)}`}>
                                {t('mobileHealth.battery', { pct: device.battery })}
                              </span>
                            )}
                            <span className="text-xs text-muted-foreground/70">
                              {t('mobileHealth.connected')} {device.connectedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>

                          {/* Live readings streamed from this device */}
                          {Object.keys(device.liveVitals).length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-2">
                              {device.liveVitals.heartRate && (
                                <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                                  <Heart className="h-3 w-3" />{device.liveVitals.heartRate}
                                </span>
                              )}
                              {device.liveVitals.bloodPressure && (
                                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                                  <Activity className="h-3 w-3" />{device.liveVitals.bloodPressure}
                                </span>
                              )}
                              {device.liveVitals.temperature && (
                                <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                                  <Thermometer className="h-3 w-3" />{device.liveVitals.temperature}
                                </span>
                              )}
                              {device.liveVitals.oxygenSaturation && (
                                <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                                  <Wind className="h-3 w-3" />{device.liveVitals.oxygenSaturation}
                                </span>
                              )}
                              {device.liveVitals.weight && (
                                <span className="text-xs bg-muted text-foreground/80 px-2 py-0.5 rounded-full">
                                  ⚖️ {device.liveVitals.weight}
                                </span>
                              )}
                              {device.liveVitals.glucose && (
                                <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">
                                  🩸 {device.liveVitals.glucose}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-600 border-red-200 hover:bg-red-50"
                        onClick={() => handleDisconnect(device)}
                      >
                        <WifiOff className="h-3 w-3 mr-1" />{t('mobileHealth.disconnect')}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Google Fit sync card */}
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-full bg-white border border-blue-200 flex items-center justify-center flex-shrink-0">
                    {/* Google "G" logo using inline SVG */}
                    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-blue-900">{t('mobileHealth.googleFitTitle')}</p>
                    <p className="text-xs text-blue-700 mt-0.5">
                      {t('mobileHealth.googleFitDescription')}
                    </p>
                    {fitLastSync && (
                      <p className="text-xs text-blue-500 mt-1">
                        {t('mobileHealth.googleFitLastSync')} {fitLastSync.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    )}
                    {!googleFit.isConfigured() && (
                      <p className="text-xs text-amber-700 mt-1">
                        Set <code className="bg-amber-100 px-1 rounded">VITE_GOOGLE_FIT_CLIENT_ID</code> in <code className="bg-amber-100 px-1 rounded">.env</code> {t('mobileHealth.googleFitEnvHint')}
                      </p>
                    )}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="bg-white border-blue-300 text-blue-700 hover:bg-blue-100 flex-shrink-0"
                  onClick={handleGoogleFitSync}
                  disabled={fitSyncing}
                >
                  {fitSyncing
                    ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" />{t('mobileHealth.syncing')}</>
                    : <><RefreshCw className="h-3 w-3 mr-1" />{t('mobileHealth.syncNow')}</>}
                </Button>
              </div>
            </div>

            {/* Browser compatibility note */}
            <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
              <Zap className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-amber-500" />
              <span>
                <strong>Bluetooth</strong> {t('mobileHealth.bluetoothNote')}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* ── Medication Reminders ── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Pill className="h-5 w-5" />{t('mobileHealth.medReminders')}</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingMeds ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground/70" /></div>
            ) : medReminders.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground/70">
                <Pill className="h-10 w-10 mx-auto mb-2 opacity-40" />
                <p className="text-sm">{t('mobileHealth.noActivePrescriptions')}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {medReminders.map(med => (
                  <div key={med.id} className={`p-3 border rounded-lg ${med.taken ? 'bg-green-50 border-green-200' : ''}`}>
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h4 className="font-medium text-sm">{med.name}</h4>
                        <p className="text-xs text-muted-foreground">{med.dosage}</p>
                      </div>
                      {med.taken && <CheckCircle className="h-4 w-4 text-green-600" />}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">{med.frequency}</span>
                      {!med.taken && (
                        <Button size="sm" variant="outline" onClick={() => markMedTaken(med.id)}>
                          {t('mobileHealth.markTaken')}
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Activity Chart ── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{t('mobileHealth.weeklyActivity')}</CardTitle>
            {loadingActivity && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground/70" />}
          </div>
        </CardHeader>
        <CardContent>
          {!loadingActivity && activityLogs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground/70">
              <Activity className="h-12 w-12 mx-auto mb-3 opacity-40" />
              <p className="font-medium">{t('mobileHealth.noActivityYet')}</p>
              <p className="text-sm mt-1">{t('mobileHealth.noActivityHint')}</p>
            </div>
          ) : (
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="4 4" stroke="var(--border)" />
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={{ stroke: 'var(--border)' }} tickLine={false} />
                  <YAxis yAxisId="left" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '12px' }} />
                  <Line yAxisId="left"  type="monotone" dataKey="steps"    stroke="var(--chart-1)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} name="Steps" />
                  <Line yAxisId="right" type="monotone" dataKey="calories" stroke="var(--chart-3)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} name="Calories" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Health Goals ── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2"><Target className="h-5 w-5" />{t('mobileHealth.healthGoals')}</CardTitle>
            <Button size="sm" variant="outline" onClick={() => setShowGoalDialog(true)}>
              <Plus className="h-4 w-4 mr-1" /> {t('mobileHealth.addGoal')}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loadingGoals ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground/70" /></div>
          ) : (
            <div className="grid md:grid-cols-2 gap-6">
              {healthGoals.map(goal => {
                const pct = Math.min(100, Math.round((goal.current / goal.target) * 100));
                return (
                  <div key={goal.id} className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
                          {goalIcon(goal.id)}
                        </div>
                        <div>
                          <h4 className="font-medium">{goal.title}</h4>
                          <p className="text-sm text-muted-foreground">{goal.current} / {goal.target} {goal.unit}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={pct >= 100 ? 'default' : 'outline'}>{pct}%</Badge>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setShowUpdateGoal(goal)}>
                          <Edit2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    <Progress value={pct} className="h-2" />
                    {pct >= 100 && (
                      <p className="text-xs text-green-600 flex items-center gap-1">
                        <CheckCircle className="h-3 w-3" /> {t('mobileHealth.goalAchieved')}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Emergency ── */}
      <Card className="bg-red-50 border-red-200">
        <CardHeader><CardTitle className="text-red-900">{t('mobileHealth.emergencyTitle')}</CardTitle></CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-4">
            <Button
              variant="destructive"
              size="lg"
              className="w-full h-auto py-4"
              onClick={() => { toast.error(t('mobileHealth.callingEmergency')); window.open('tel:912'); }}
            >
              <div className="text-center">
                <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                <p className="font-semibold">{t('mobileHealth.emergencySOS')}</p>
                <p className="text-xs opacity-90">{t('mobileHealth.callEmergency')}</p>
              </div>
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="w-full h-auto py-4"
              onClick={() => {
                navigator.geolocation?.getCurrentPosition(
                  pos => toast.success(t('mobileHealth.locationShared', { lat: pos.coords.latitude.toFixed(4), lng: pos.coords.longitude.toFixed(4) })),
                  () => toast.error(t('mobileHealth.locationDenied')),
                );
              }}
            >
              <div className="text-center">
                <Heart className="h-8 w-8 mx-auto mb-2" />
                <p className="font-semibold">{t('mobileHealth.shareLocation')}</p>
                <p className="text-xs text-muted-foreground">{t('mobileHealth.withContacts')}</p>
              </div>
            </Button>
          </div>
          <div className="mt-4 text-sm text-red-800">
            <p className="font-medium">{t('mobileHealth.emergencyContacts')}</p>
            <p>Police: 112 &nbsp;|&nbsp; Ambulance: 912 &nbsp;|&nbsp; Hospital: +250 788 123 456</p>
          </div>
        </CardContent>
      </Card>

      {/* ══════════════ DIALOGS ══════════════ */}

      {/* Update Vitals */}
      <Dialog open={showVitalsDialog} onOpenChange={setShowVitalsDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('mobileHealth.dialogVitalsTitle')}</DialogTitle>
            <DialogDescription>{t('mobileHealth.dialogVitalsHint')}</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            {([
              { key: 'heartRate',        label: t('mobileHealth.fieldHeartRate'),     placeholder: 'e.g. 72 bpm'   },
              { key: 'bloodPressure',    label: t('mobileHealth.fieldBloodPressure'), placeholder: 'e.g. 120/80'   },
              { key: 'temperature',      label: t('mobileHealth.fieldTemperature'),   placeholder: 'e.g. 36.6 °C'  },
              { key: 'oxygenSaturation', label: t('mobileHealth.fieldOxygen'),        placeholder: 'e.g. 98%'      },
              { key: 'weight',           label: t('mobileHealth.fieldWeight'),        placeholder: 'e.g. 70 kg'    },
              { key: 'glucose',          label: t('mobileHealth.fieldGlucose'),       placeholder: 'e.g. 5.5 mmol' },
            ] as { key: keyof VitalsData; label: string; placeholder: string }[]).map(f => (
              <div key={f.key} className="space-y-1">
                <Label className="text-xs">{f.label}</Label>
                <Input
                  placeholder={f.placeholder}
                  value={editVitals[f.key] ?? ''}
                  onChange={e => setEditVitals(v => ({ ...v, [f.key]: e.target.value }))}
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowVitalsDialog(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleSaveVitals} disabled={savingVitals}>
              {savingVitals ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t('mobileHealth.saving')}</> : <><Save className="h-4 w-4 mr-2" />{t('mobileHealth.saveVitals')}</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Log Activity */}
      <Dialog open={showActivityDialog} onOpenChange={setShowActivityDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('mobileHealth.dialogActivityTitle')}</DialogTitle>
            <DialogDescription>{t('mobileHealth.dialogActivityHint')}</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            {([
              { key: 'steps',           label: t('mobileHealth.fieldSteps'),    placeholder: '0' },
              { key: 'calories',        label: t('mobileHealth.fieldCalories'), placeholder: '0' },
              { key: 'exerciseMinutes', label: t('mobileHealth.fieldExercise'), placeholder: '0' },
              { key: 'waterGlasses',    label: t('mobileHealth.fieldWater'),    placeholder: '0' },
              { key: 'sleepHours',      label: t('mobileHealth.fieldSleep'),    placeholder: '0' },
            ] as { key: keyof typeof activityForm; label: string; placeholder: string }[]).map(f => (
              <div key={f.key} className="space-y-1">
                <Label className="text-xs">{f.label}</Label>
                <Input
                  type="number" min={0}
                  placeholder={f.placeholder}
                  value={activityForm[f.key] || ''}
                  onChange={e => setActivityForm(a => ({ ...a, [f.key]: Number(e.target.value) }))}
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowActivityDialog(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleLogActivity} disabled={savingActivity}>
              {savingActivity ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t('mobileHealth.saving')}</> : t('mobileHealth.logActivityBtn')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Goal */}
      <Dialog open={showGoalDialog} onOpenChange={setShowGoalDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{t('mobileHealth.dialogGoalTitle')}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>{t('mobileHealth.goalTitle')}</Label>
              <Input placeholder={t('mobileHealth.goalTitlePlaceholder')} value={newGoal.title} onChange={e => setNewGoal(g => ({ ...g, title: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>{t('mobileHealth.goalTarget')}</Label>
              <Input type="number" min={1} placeholder={t('mobileHealth.goalTargetPlaceholder')} value={newGoal.target} onChange={e => setNewGoal(g => ({ ...g, target: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>{t('mobileHealth.goalUnit')}</Label>
              <Input placeholder={t('mobileHealth.goalUnitPlaceholder')} value={newGoal.unit} onChange={e => setNewGoal(g => ({ ...g, unit: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGoalDialog(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleAddGoal} disabled={savingGoal}>
              {savingGoal ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t('mobileHealth.saving')}</> : t('mobileHealth.addGoalBtn')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Update Goal Progress */}
      {showUpdateGoal && (
        <Dialog open={!!showUpdateGoal} onOpenChange={() => setShowUpdateGoal(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>{t('mobileHealth.dialogUpdateProgress', { title: showUpdateGoal.title })}</DialogTitle>
              <DialogDescription>{t('mobileHealth.currentProgress', { current: showUpdateGoal.current, target: showUpdateGoal.target, unit: showUpdateGoal.unit })}</DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label>{t('mobileHealth.newCurrentValue', { unit: showUpdateGoal.unit })}</Label>
              <Input
                type="number" min={0} max={showUpdateGoal.target * 2}
                defaultValue={showUpdateGoal.current}
                id="goal-progress-input"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowUpdateGoal(null)}>{t('common.cancel')}</Button>
              <Button onClick={() => {
                const val = Number((document.getElementById('goal-progress-input') as HTMLInputElement).value);
                handleUpdateGoalProgress(showUpdateGoal, val);
              }}>{t('common.save')}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

    </div>
  );
};
