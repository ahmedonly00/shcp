import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/app/components/ui/dialog';
import {
  Activity, Calendar, FileText, Clock, TrendingUp,
  Heart, Thermometer, Droplet, Scale, AlertCircle,
  Plus, Download, Eye, Pill, MapPin, Navigation, Bike, Loader2
} from 'lucide-react';
import { Skeleton } from '@/app/components/ui/skeleton';
import { useAuth } from '@/app/context/AuthContext';
import { patientsApi } from '@/app/api/patients';
import { prescriptionsApi } from '@/app/api/prescriptions';
import { analyticsApi } from '@/app/api/analytics';
import { getActiveDelivery, DeliveryDto } from '@/app/api/deliveries';
import {
  Appointment, HealthRecord, VitalSign,
  ApiPatientHealthSummary, ApiPrescriptionDto, mapApiAppointment, mapApiPrescription
} from '@/app/types';
import { downloadPrescriptionPdf } from '@/app/lib/downloadPrescriptionPdf';
type VitalSignType = VitalSign;
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

// Static chart data (no backend endpoint for vitals history yet)
const vitalSignsChartData = [
  { date: 'Week 1', heartRate: 73, bloodPressure: 118 },
  { date: 'Week 2', heartRate: 75, bloodPressure: 120 },
  { date: 'Week 3', heartRate: 72, bloodPressure: 119 },
  { date: 'Week 4', heartRate: 74, bloodPressure: 121 },
];

const defaultVitals: VitalSign[] = [
  { type: 'heart-rate', value: '72', unit: 'bpm', date: '' },
  { type: 'blood-pressure', value: '120/80', unit: 'mmHg', date: '' },
  { type: 'temperature', value: '36.6', unit: '°C', date: '' },
  { type: 'oxygen', value: '98', unit: '%', date: '' },
];

const DashboardSkeleton: React.FC = () => (
  <div className="space-y-6">
    <div className="space-y-2">
      <Skeleton className="h-8 w-72" />
      <Skeleton className="h-4 w-48" />
    </div>

    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {[...Array(4)].map((_, i) => (
        <Card key={i}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="h-7 w-12" />
                <Skeleton className="h-3 w-20" />
              </div>
              <Skeleton className="h-12 w-12 rounded-full" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>

    <div className="grid md:grid-cols-3 gap-6">
      <Card className="md:col-span-2">
        <CardHeader>
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-8 w-28 rounded-md" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-lg" />
            ))}
          </div>
          <Skeleton className="h-48 w-full rounded-lg" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-[72px] w-full rounded-lg" />
          ))}
        </CardContent>
      </Card>
    </div>
  </div>
);

export const PatientDashboard: React.FC = () => {
  const { user } = useAuth();
  const { t } = useTranslation();

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [prescriptions, setPrescriptions] = useState<HealthRecord[]>([]);
  const [rawPrescriptions, setRawPrescriptions] = useState<ApiPrescriptionDto[]>([]);
  const [downloadingRxId, setDownloadingRxId] = useState<string | null>(null);
  const [summary, setSummary] = useState<ApiPatientHealthSummary | null>(null);
  const [vitals, setVitals] = useState<VitalSign[]>(defaultVitals);
  const [loading, setLoading] = useState(true);

  const [activeDelivery, setActiveDelivery] = useState<DeliveryDto | null>(null);

  const [showAddVitalDialog, setShowAddVitalDialog] = useState(false);
  const [showAllRecordsDialog, setShowAllRecordsDialog] = useState(false);
  const [newVital, setNewVital] = useState({ type: 'heart-rate', value: '', unit: 'bpm' });

  useEffect(() => {
    if (user?.role !== 'patient') { setLoading(false); return; }
    const load = async () => {
      setLoading(true);
      try {
        const [apptRes, prescRes, summaryRes] = await Promise.allSettled([
          patientsApi.getMyAppointments(0, 5),
          prescriptionsApi.getMine(),
          analyticsApi.patientSummary(),
        ]);

        if (apptRes.status === 'fulfilled') {
          setAppointments((apptRes.value ?? []).map(mapApiAppointment));
        }
        if (prescRes.status === 'fulfilled') {
          const raw = prescRes.value ?? [];
          setRawPrescriptions(raw);
          setPrescriptions(raw.map(mapApiPrescription));
        }
        if (summaryRes.status === 'fulfilled') {
          setSummary(summaryRes.value);
        }
      } catch {
        // silently fall back to empty state
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleDownloadRx = async (recordId: string) => {
    const rx = rawPrescriptions.find(r => r.prescriptionId === recordId);
    if (!rx) { toast.error('Prescription data not available'); return; }
    setDownloadingRxId(recordId);
    try {
      await downloadPrescriptionPdf(rx);
    } catch {
      toast.error('Could not generate PDF — please try again');
    } finally {
      setDownloadingRxId(null);
    }
  };

  // Poll for active delivery tracking every 15 s while the component is mounted
  useEffect(() => {
    if (user?.role !== 'patient') return;
    const fetchTracking = () => {
      getActiveDelivery()
        .then(data => setActiveDelivery(data ?? null))
        .catch(() => { /* silently ignore — delivery tracking is non-critical */ });
    };
    fetchTracking();
    const interval = setInterval(fetchTracking, 15_000);
    return () => clearInterval(interval);
  }, [user?.role]);

  const upcomingAppointments = appointments.filter(a => a.status === 'scheduled');

  const getVitalIcon = (type: string) => {
    switch (type) {
      case 'heart-rate': return <Heart className="h-4 w-4" />;
      case 'blood-pressure': return <Activity className="h-4 w-4" />;
      case 'temperature': return <Thermometer className="h-4 w-4" />;
      case 'oxygen': return <Droplet className="h-4 w-4" />;
      case 'weight': return <Scale className="h-4 w-4" />;
      default: return <Activity className="h-4 w-4" />;
    }
  };

  const getVitalColor = (type: string) => {
    switch (type) {
      case 'heart-rate': return 'text-red-600 bg-red-50';
      case 'blood-pressure': return 'text-blue-600 bg-blue-50';
      case 'temperature': return 'text-orange-600 bg-orange-50';
      case 'oxygen': return 'text-cyan-600 bg-cyan-50';
      case 'weight': return 'text-purple-600 bg-purple-50';
      default: return 'text-muted-foreground bg-muted/50';
    }
  };

  const handleAddVital = () => {
    if (!newVital.value) { toast.error('Please enter a value'); return; }
    setVitals(prev => {
      const updated = prev.filter(v => v.type !== newVital.type);
      return [...updated, { type: newVital.type as VitalSignType['type'], value: newVital.value, unit: newVital.unit, date: new Date().toISOString().split('T')[0] }];
    });
    toast.success('Vital sign saved locally');
    setShowAddVitalDialog(false);
    setNewVital({ type: 'heart-rate', value: '', unit: 'bpm' });
  };

  const recentRecords = prescriptions.slice(0, 3);

  // Haversine distance in km between two GPS points
  const haversineKm = (lat1: number, lng1: number, lat2: number, lng2: number) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const trackingStatuses = new Set(['ASSIGNED', 'ACCEPTED', 'PICKED_UP', 'ON_THE_WAY']);
  const showTracking = activeDelivery != null && trackingStatuses.has(activeDelivery.status);
  const showFailure = activeDelivery != null && (activeDelivery.status === 'FAILED' || activeDelivery.status === 'DECLINED');
  const showReadyBanner = !showTracking && !showFailure && rawPrescriptions.some(rx => rx.status === 'READY_FOR_DELIVERY');

  if (loading) return <DashboardSkeleton />;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">{t('dashboard.welcome', { name: user?.name })}</h2>
        <p className="text-muted-foreground">{t('dashboard.welcomeSubtitle')}</p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('dashboard.upcoming')}</p>
                <p className="text-2xl font-bold">
                  {summary?.upcomingAppointments ?? upcomingAppointments.length}
                </p>
                <p className="text-xs text-muted-foreground">{t('dashboard.appointments')}</p>
              </div>
              <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center">
                <Calendar className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('dashboard.prescriptions')}</p>
                <p className="text-2xl font-bold">
                  {summary?.activePrescriptions ?? prescriptions.length}
                </p>
                <p className="text-xs text-muted-foreground">{t('dashboard.active')}</p>
              </div>
              <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center">
                <FileText className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('dashboard.totalAppointments')}</p>
                <p className="text-2xl font-bold">
                  {summary?.totalAppointments ?? 0}
                </p>
                <p className="text-xs text-muted-foreground">{t('dashboard.allTime')}</p>
              </div>
              <div className="h-12 w-12 bg-purple-100 rounded-full flex items-center justify-center">
                <Clock className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('dashboard.symptomReports')}</p>
                <p className="text-2xl font-bold">
                  {summary?.totalSymptomReports ?? 0}
                </p>
                <p className="text-xs text-muted-foreground">{t('dashboard.submitted')}</p>
              </div>
              <div className="h-12 w-12 bg-yellow-100 rounded-full flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-yellow-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Vital Signs */}
        <Card className="md:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{t('dashboard.vitalSigns')}</CardTitle>
              <Button size="sm" variant="outline" onClick={() => setShowAddVitalDialog(true)}>
                <Plus className="h-4 w-4 mr-1" /> {t('dashboard.addReading')}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
              {vitals.slice(0, 6).map((vital) => (
                <div key={vital.type} className={`p-3 rounded-lg border ${getVitalColor(vital.type)}`}>
                  <div className="flex items-center gap-2 mb-1">
                    {getVitalIcon(vital.type)}
                    <span className="text-xs font-medium capitalize">{vital.type.replace('-', ' ')}</span>
                  </div>
                  <p className="text-lg font-bold">{vital.value}</p>
                  <p className="text-xs opacity-80">{vital.unit}</p>
                </div>
              ))}
            </div>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={vitalSignsChartData}>
                  <CartesianGrid strokeDasharray="4 4" stroke="var(--border)" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} axisLine={{ stroke: 'var(--border)' }} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '12px' }} />
                  <Line type="monotone" dataKey="heartRate" stroke="var(--destructive)" strokeWidth={2} dot={false} name="Heart Rate" />
                  <Line type="monotone" dataKey="bloodPressure" stroke="var(--chart-1)" strokeWidth={2} dot={false} name="Blood Pressure" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Upcoming Appointments */}
        <Card>
          <CardHeader><CardTitle>{t("dashboard.upcomingAppointments")}</CardTitle></CardHeader>
          <CardContent>
            {upcomingAppointments.length > 0 ? (
              <div className="space-y-3">
                {upcomingAppointments.map((apt) => (
                  <div key={apt.id} className="p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h4 className="font-medium text-sm">{apt.doctorName}</h4>
                        <p className="text-xs text-muted-foreground">{apt.doctorSpecialization}</p>
                      </div>
                      <Badge variant="outline" className="text-xs capitalize">{apt.type}</Badge>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" /><span>{apt.date}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                      <Clock className="h-3 w-3" /><span>{apt.time}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Calendar className="h-12 w-12 mx-auto mb-2 opacity-40" />
                <p className="text-sm">{t('dashboard.noAppointments')}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Live Delivery Tracking */}
      {showTracking && activeDelivery && (
        <Card className="border-2 border-cyan-400 bg-cyan-50/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-cyan-800">
              <Bike className="h-5 w-5 text-cyan-600 animate-pulse" />
              Your medication is on its way!
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Status row */}
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Biker:</span>
                <span className="font-medium text-sm text-foreground">{activeDelivery.bikerName ?? "—"}</span>
              </div>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                ${activeDelivery.status === 'ON_THE_WAY' ? 'bg-cyan-100 text-cyan-800' :
                  activeDelivery.status === 'PICKED_UP' ? 'bg-indigo-100 text-indigo-800' :
                  'bg-blue-100 text-blue-800'}`}>
                {activeDelivery.status.replace(/_/g, ' ')}
              </span>
            </div>

            {/* Last GPS update time */}
            {activeDelivery.locationUpdatedAt && (
              <p className="text-xs text-muted-foreground/70">
                Biker location last updated:{' '}
                {new Date(activeDelivery.locationUpdatedAt).toLocaleTimeString()}
              </p>
            )}

            {/* Distance remaining */}
            {activeDelivery.bikerLatitude != null &&
             activeDelivery.bikerLongitude != null &&
             activeDelivery.destinationLatitude != null &&
             activeDelivery.destinationLongitude != null && (
              <div className="inline-flex items-center gap-1.5 bg-card border border-cyan-200 rounded-lg px-3 py-1.5 text-sm font-medium text-cyan-700">
                <Navigation className="h-4 w-4" />
                {haversineKm(
                  activeDelivery.bikerLatitude,
                  activeDelivery.bikerLongitude,
                  activeDelivery.destinationLatitude,
                  activeDelivery.destinationLongitude,
                ).toFixed(1)}{' '}km away
              </div>
            )}

            {/* Maps */}
            <div className="grid sm:grid-cols-2 gap-3">
              {/* Biker's current location */}
              {activeDelivery.bikerLatitude != null && activeDelivery.bikerLongitude != null ? (
                <div className="rounded-lg overflow-hidden border border-cyan-200 bg-card">
                  <p className="text-xs font-medium text-cyan-700 px-3 py-1.5 border-b border-cyan-100 flex items-center gap-1.5">
                    <Bike className="h-3.5 w-3.5" /> Biker's current location
                  </p>
                  <iframe
                    title="Biker location"
                    src={`https://www.openstreetmap.org/export/embed.html?bbox=${activeDelivery.bikerLongitude - 0.018},${activeDelivery.bikerLatitude - 0.018},${activeDelivery.bikerLongitude + 0.018},${activeDelivery.bikerLatitude + 0.018}&layer=mapnik&marker=${activeDelivery.bikerLatitude},${activeDelivery.bikerLongitude}`}
                    className="w-full h-40 sm:h-48"
                    style={{ border: 0, display: 'block' }}
                    loading="lazy"
                  />
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-cyan-200 h-48 flex flex-col items-center justify-center gap-1 text-xs text-muted-foreground/70">
                  <Bike className="h-6 w-6 opacity-40" />
                  <span>Waiting for biker's GPS…</span>
                </div>
              )}

              {/* Your delivery address */}
              {activeDelivery.destinationLatitude != null && activeDelivery.destinationLongitude != null ? (
                <div className="rounded-lg overflow-hidden border border-border bg-card">
                  <p className="text-xs font-medium text-muted-foreground px-3 py-1.5 border-b border-border flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5" /> Your delivery address
                  </p>
                  <iframe
                    title="Delivery address"
                    src={`https://www.openstreetmap.org/export/embed.html?bbox=${activeDelivery.destinationLongitude - 0.018},${activeDelivery.destinationLatitude - 0.018},${activeDelivery.destinationLongitude + 0.018},${activeDelivery.destinationLatitude + 0.018}&layer=mapnik&marker=${activeDelivery.destinationLatitude},${activeDelivery.destinationLongitude}`}
                    className="w-full h-40 sm:h-48"
                    style={{ border: 0, display: 'block' }}
                    loading="lazy"
                  />
                </div>
              ) : activeDelivery.deliveryAddress ? (
                <div className="rounded-lg border border-border bg-card p-4">
                  <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5" /> Your delivery address
                  </p>
                  <p className="text-sm text-foreground">{activeDelivery.deliveryAddress}</p>
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Ready at Pharmacy Banner */}
      {showReadyBanner && (
        <Card className="border-2 border-indigo-300 bg-indigo-50/30">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                <Pill className="h-5 w-5 text-indigo-600" />
              </div>
              <div>
                <p className="font-semibold text-indigo-800">Your medication is ready at the pharmacy</p>
                <p className="text-sm text-indigo-700 mt-0.5">
                  The pharmacist has prepared your prescription. A delivery agent will be assigned shortly.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Delivery Failure Notice */}
      {showFailure && activeDelivery && (
        <Card className="border-2 border-red-300 bg-red-50/30">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-red-800 text-base">
              <AlertCircle className="h-5 w-5 text-red-600" />
              Delivery could not be completed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-red-700">
              {activeDelivery.status === 'DECLINED'
                ? 'The assigned delivery agent declined this order. Your pharmacy is arranging a replacement.'
                : activeDelivery.failureReason
                  ? `Reason: ${activeDelivery.failureReason}`
                  : 'The delivery attempt was unsuccessful. Your pharmacy will arrange a new delivery.'}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Recent Prescriptions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{t('dashboard.recentPrescriptions')}</CardTitle>
            <Button variant="outline" size="sm" onClick={() => setShowAllRecordsDialog(true)}>{t('dashboard.viewAll')}</Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/70" />
            </div>
          ) : recentRecords.length > 0 ? (
            <div className="space-y-3">
              {recentRecords.map((record) => {
                const raw = rawPrescriptions.find(r => r.prescriptionId === record.id);
                const statusColor =
                  raw?.status === 'DELIVERED'           ? 'bg-green-100 text-green-800' :
                  raw?.status === 'CANCELLED' || raw?.status === 'FAILED' ? 'bg-red-100 text-red-800' :
                  raw?.status === 'READY_FOR_DELIVERY' || raw?.status === 'PICKED_UP' || raw?.status === 'ON_THE_WAY'
                                                        ? 'bg-blue-100 text-blue-800' :
                  'bg-yellow-100 text-yellow-800';
                return (
                  <div key={record.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
                        <Pill className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <h4 className="font-medium">{record.title}</h4>
                        <div className="flex items-center gap-2 flex-wrap mt-1">
                          {raw && (
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusColor}`}>
                              {raw.status.replace(/_/g, ' ')}
                            </span>
                          )}
                          <span className="text-xs text-muted-foreground">{record.date}</span>
                          {record.doctor && <span className="text-xs text-muted-foreground">{record.doctor}</span>}
                          {raw?.pharmacyName && (
                            <span className="text-xs text-muted-foreground">· {raw.pharmacyName}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="shrink-0 gap-1.5"
                      onClick={() => handleDownloadRx(record.id)}
                      disabled={downloadingRxId === record.id}
                    >
                      {downloadingRxId === record.id
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : <Download className="h-4 w-4" />
                      }
                      <span className="hidden sm:inline text-xs">PDF</span>
                    </Button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p className="text-sm">{t('dashboard.noPrescriptions')}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Health tip */}
      <Card className="bg-gradient-to-r from-blue-50 to-cyan-50 border-blue-200">
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="h-12 w-12 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
              <Activity className="h-6 w-6 text-white" />
            </div>
            <div>
              <h4 className="font-semibold text-blue-900 mb-1">{t('dashboard.healthTipTitle')}</h4>
              <p className="text-sm text-blue-800">
                {t('dashboard.healthTipText')}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Add Vital Dialog */}
      <Dialog open={showAddVitalDialog} onOpenChange={setShowAddVitalDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('dashboard.addVitalSign')}</DialogTitle>
            <DialogDescription>{t('dashboard.addVitalDesc')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={newVital.type} onValueChange={v => setNewVital({ ...newVital, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="heart-rate">Heart Rate</SelectItem>
                  <SelectItem value="blood-pressure">Blood Pressure</SelectItem>
                  <SelectItem value="temperature">Temperature</SelectItem>
                  <SelectItem value="oxygen">Oxygen Saturation</SelectItem>
                  <SelectItem value="weight">Weight</SelectItem>
                  <SelectItem value="glucose">Blood Glucose</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Value</Label>
              <Input type="text" placeholder="e.g. 72" value={newVital.value}
                onChange={e => setNewVital({ ...newVital, value: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Unit</Label>
              <Input type="text" placeholder="e.g. bpm" value={newVital.unit}
                onChange={e => setNewVital({ ...newVital, unit: e.target.value })} />
            </div>
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowAddVitalDialog(false)}>Cancel</Button>
            <Button onClick={handleAddVital}>Add Vital</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* All Prescriptions Dialog */}
      <Dialog open={showAllRecordsDialog} onOpenChange={setShowAllRecordsDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>All Prescriptions</DialogTitle>
            <DialogDescription>Your complete prescription history.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {prescriptions.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">No prescriptions found.</p>
            ) : prescriptions.map((record) => {
              const raw = rawPrescriptions.find(r => r.prescriptionId === record.id);
              let medCount = 0;
              try { medCount = JSON.parse(raw?.medications ?? '[]').length; } catch { medCount = 0; }
              const statusColor =
                raw?.status === 'DELIVERED'           ? 'bg-green-100 text-green-800' :
                raw?.status === 'CANCELLED' || raw?.status === 'FAILED' ? 'bg-red-100 text-red-800' :
                raw?.status === 'READY_FOR_DELIVERY' || raw?.status === 'PICKED_UP' || raw?.status === 'ON_THE_WAY'
                                                      ? 'bg-blue-100 text-blue-800' :
                'bg-yellow-100 text-yellow-800';
              return (
                <div key={record.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/30">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                      <Pill className="h-4 w-4 text-blue-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-medium text-sm">{record.title}</h4>
                        {raw && (
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusColor}`}>
                            {raw.status.replace(/_/g, ' ')}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {record.date}
                        {record.doctor && ` · Dr. ${record.doctor}`}
                        {medCount > 0 && ` · ${medCount} medication${medCount !== 1 ? 's' : ''}`}
                        {raw?.pharmacyName && ` · ${raw.pharmacyName}`}
                      </p>
                      {raw?.validUntil && (
                        <p className="text-xs text-muted-foreground/70">Valid until: {raw.validUntil}</p>
                      )}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0 gap-1.5 ml-2"
                    onClick={() => handleDownloadRx(record.id)}
                    disabled={downloadingRxId === record.id}
                  >
                    {downloadingRxId === record.id
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <Download className="h-3.5 w-3.5" />
                    }
                    <span className="text-xs">PDF</span>
                  </Button>
                </div>
              );
            })}
          </div>
          <div className="mt-4 flex justify-end">
            <Button variant="outline" onClick={() => setShowAllRecordsDialog(false)}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
