import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/ui/tabs';
import { Button } from '@/app/components/ui/button';
import {
  Users, Calendar, AlertCircle,
  UserCheck, FileText, Loader2, Download,
  Building2, Pill, Bike,
} from 'lucide-react';
import { Skeleton } from '@/app/components/ui/skeleton';
import {
  LineChart, Line, PieChart, Pie, Cell,
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { analyticsApi, DailyCount } from '@/app/api/analytics';
import { downloadPlatformStatsPdf, downloadAppointmentsPdf, downloadRegistrationsPdf } from '@/app/lib/downloadReportPdf';
import { ApiPlatformStats } from '@/app/types';
import { useAuth } from '@/app/context/AuthContext';
import { useTranslation } from 'react-i18next';

const AnalyticsSkeleton: React.FC = () => (
  <div className="space-y-6">
    <div className="flex items-start justify-between">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-8 w-28" />
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-8 w-32" />
      </div>
    </div>
    <div className="grid md:grid-cols-4 gap-4">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="rounded-lg border bg-card p-6">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-7 w-16" />
              <Skeleton className="h-3 w-20" />
            </div>
            <Skeleton className="h-12 w-12 rounded-full" />
          </div>
        </div>
      ))}
    </div>
    <div className="space-y-2">
      <Skeleton className="h-10 w-80" />
      <div className="grid md:grid-cols-2 gap-6 mt-6">
        <div className="rounded-lg border bg-card p-6 space-y-3">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-[300px] w-full rounded-lg" />
        </div>
        <div className="rounded-lg border bg-card p-6 space-y-3">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-[300px] w-full rounded-lg" />
        </div>
      </div>
    </div>
  </div>
);

const CHART_TOOLTIP = {
  contentStyle: {
    backgroundColor: 'var(--card)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    fontSize: '12px',
    color: 'var(--foreground)',
    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.08)',
  },
  labelStyle: { fontWeight: 600, color: 'var(--foreground)', marginBottom: 4 },
  itemStyle: { color: 'var(--muted-foreground)' },
};

const CHART_AXIS = {
  tick: { fontSize: 11, fill: 'var(--muted-foreground)' },
  axisLine: { stroke: 'var(--border)' },
  tickLine: { stroke: 'var(--border)' },
};

export const Analytics: React.FC = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<ApiPlatformStats | null>(null);
  const { t } = useTranslation();
  const [registrations, setRegistrations] = useState<DailyCount[]>([]);
  const [appointments, setAppointments] = useState<DailyCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);


  const handleExport = async (type: 'platform' | 'appointments' | 'registrations') => {
    setExporting(true);
    try {
      if (type === 'platform' && stats)       await downloadPlatformStatsPdf(stats, user?.name ?? 'Administrator');
      else if (type === 'appointments')       await downloadAppointmentsPdf(appointments, user?.name ?? 'Administrator');
      else if (type === 'registrations')      await downloadRegistrationsPdf(registrations, user?.name ?? 'Administrator');
    } catch {
      // silent
    } finally {
      setExporting(false);
    }
  };

  useEffect(() => {
    const load = async () => {
      const [s, r, a] = await Promise.allSettled([
        analyticsApi.adminOverview(),
        analyticsApi.adminRegistrations(30),
        analyticsApi.adminAppointments(30),
      ]);
      if (s.status === 'fulfilled') setStats(s.value);
      if (r.status === 'fulfilled') setRegistrations(r.value ?? []);
      if (a.status === 'fulfilled') setAppointments(a.value ?? []);
      setLoading(false);
    };
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const statValue = (n: number | undefined) =>
    loading ? <Skeleton className="h-7 w-14 inline-block align-middle" /> : (n ?? 0).toLocaleString();

  const consultationTypePie = [
    { name: 'Completed',   value: stats?.appointments?.completed  ?? 0, color: '#10b981' },
    { name: 'Confirmed',   value: stats?.appointments?.confirmed  ?? 0, color: '#3b82f6' },
    { name: 'Pending',     value: stats?.appointments?.pending    ?? 0, color: '#f59e0b' },
    { name: 'In Progress', value: stats?.appointments?.inProgress ?? 0, color: '#8b5cf6' },
    { name: 'Cancelled',   value: stats?.appointments?.cancelled  ?? 0, color: '#ef4444' },
    { name: 'No Show',     value: stats?.appointments?.noShow     ?? 0, color: '#6b7280' },
  ].filter(d => d.value > 0);

  if (loading) return <AnalyticsSkeleton />;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold">{t("analytics.title")}</h2>
          <p className="text-muted-foreground">{t('analytics.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={exporting} onClick={() => handleExport('platform')}>
            {exporting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Download className="h-4 w-4 mr-1" />}
            Export Stats PDF
          </Button>
          <Button variant="outline" size="sm" disabled={exporting} onClick={() => handleExport('appointments')}>
            <Download className="h-4 w-4 mr-1" /> Appointments PDF
          </Button>
          <Button variant="outline" size="sm" disabled={exporting} onClick={() => handleExport('registrations')}>
            <Download className="h-4 w-4 mr-1" /> Registrations PDF
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('analytics.totalUsers')}</p>
                <p className="text-2xl font-bold">{loading ? <Skeleton className="h-7 w-14 inline-block align-middle" /> : ((stats?.totalPatients ?? 0) + (stats?.totalProviders ?? 0) + (stats?.totalAdmins ?? 0)).toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">{t('analytics.allRegistered')}</p>
              </div>
              <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Patients</p>
                <p className="text-2xl font-bold">{statValue(stats?.totalPatients)}</p>
                <p className="text-xs text-primary">{statValue(stats?.activeProviders)} active providers</p>
              </div>
              <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center">
                <UserCheck className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Appointments</p>
                <p className="text-2xl font-bold">{statValue(stats?.appointments?.total)}</p>
                <p className="text-xs text-muted-foreground">{statValue(stats?.appointments?.completed)} completed</p>
              </div>
              <div className="h-12 w-12 bg-purple-100 rounded-full flex items-center justify-center">
                <Calendar className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Prescriptions</p>
                <p className="text-2xl font-bold">{statValue(stats?.totalPrescriptions)}</p>
                <p className="text-xs text-muted-foreground">Issued</p>
              </div>
              <div className="h-12 w-12 bg-yellow-100 rounded-full flex items-center justify-center">
                <FileText className="h-6 w-6 text-yellow-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pharmacy Network */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Pharmacy Network</p>
        <div className="grid md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Registered Pharmacies</p>
                  <p className="text-2xl font-bold">{statValue(stats?.totalPharmacies)}</p>
                  <p className="text-xs text-muted-foreground">Active</p>
                </div>
                <div className="h-12 w-12 bg-teal-100 rounded-full flex items-center justify-center">
                  <Building2 className="h-6 w-6 text-teal-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pharmacists</p>
                  <p className="text-2xl font-bold">{statValue(stats?.totalPharmacists)}</p>
                  <p className="text-xs text-muted-foreground">Registered staff</p>
                </div>
                <div className="h-12 w-12 bg-cyan-100 rounded-full flex items-center justify-center">
                  <Pill className="h-6 w-6 text-cyan-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Delivery Bikers</p>
                  <p className="text-2xl font-bold">{statValue(stats?.totalBikers)}</p>
                  <p className="text-xs text-muted-foreground">Registered riders</p>
                </div>
                <div className="h-12 w-12 bg-orange-100 rounded-full flex items-center justify-center">
                  <Bike className="h-6 w-6 text-orange-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList>
          <TabsTrigger value="overview">{t('analytics.overview')}</TabsTrigger>
          <TabsTrigger value="consultations">{t('analytics.consultations')}</TabsTrigger>
          <TabsTrigger value="health">{t('analytics.healthTrends')}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 mt-6">
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle>New Registrations (30 days)</CardTitle></CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  {registrations.length === 0 ? (
                    <div className="flex items-center justify-center h-full">
                      <p className="text-sm text-muted-foreground">No data available</p>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={registrations}>
                        <CartesianGrid strokeDasharray="4 4" stroke="var(--border)" />
                        <XAxis dataKey="date" {...CHART_AXIS} />
                        <YAxis {...CHART_AXIS} />
                        <Tooltip {...CHART_TOOLTIP} />
                        <Line type="monotone" dataKey="count" stroke="var(--chart-1)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} name="Registrations" />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Appointment Status</CardTitle></CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={consultationTypePie} cx="50%" cy="50%" outerRadius={100}
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        labelLine={{ stroke: 'var(--border)' }}
                        dataKey="value">
                        {consultationTypePie.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                      </Pie>
                      <Tooltip {...CHART_TOOLTIP} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle>Daily Appointment Bookings (30 days)</CardTitle></CardHeader>
            <CardContent>
              {appointments.length === 0 ? (
                <div className="flex items-center justify-center h-48">
                  <p className="text-sm text-muted-foreground">No data available</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={appointments}>
                    <CartesianGrid strokeDasharray="4 4" stroke="var(--border)" />
                    <XAxis dataKey="date" {...CHART_AXIS} />
                    <YAxis {...CHART_AXIS} />
                    <Tooltip {...CHART_TOOLTIP} />
                    <Area type="monotone" dataKey="count" stroke="var(--chart-1)" fill="var(--chart-1)" fillOpacity={0.12} strokeWidth={2} name="Appointments" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="consultations" className="space-y-6 mt-6">
          <div className="grid md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6 text-center">
                <p className="text-sm text-muted-foreground mb-1">Total Appointments</p>
                <p className="text-3xl font-bold">{statValue(stats?.appointments?.total)}</p>
                <p className="text-xs text-muted-foreground mt-1">All time</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <p className="text-sm text-muted-foreground mb-1">Completed</p>
                <p className="text-3xl font-bold">{statValue(stats?.appointments?.completed)}</p>
                <p className="text-xs text-green-600 mt-1">Successfully done</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <p className="text-sm text-muted-foreground mb-1">Pending</p>
                <p className="text-3xl font-bold">{statValue(stats?.appointments?.pending)}</p>
                <p className="text-xs text-yellow-600 mt-1">Awaiting consultation</p>
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader><CardTitle>Symptom Reports</CardTitle></CardHeader>
            <CardContent>
              <div className="flex items-center justify-center p-6">
                <div className="text-center">
                  <p className="text-4xl font-bold text-primary">{statValue(stats?.totalSymptomReports)}</p>
                  <p className="text-muted-foreground mt-2">Total AI symptom analyses submitted</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="health" className="space-y-6 mt-6">
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle>Public Health Alerts</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    { alert: 'Seasonal Flu Increase', severity: 'moderate', date: 'Monitor' },
                    { alert: 'Malaria Cases Rising', severity: 'high', date: 'Alert' },
                    { alert: 'COVID-19 Monitoring', severity: 'low', date: 'Active' },
                  ].map((item, idx) => (
                    <div key={idx} className="p-3 border rounded-lg">
                      <div className="flex items-start gap-3">
                        <AlertCircle className={`h-5 w-5 flex-shrink-0 ${item.severity === 'high' ? 'text-red-600' : item.severity === 'moderate' ? 'text-yellow-600' : 'text-green-600'}`} />
                        <div className="flex-1">
                          <div className="flex items-start justify-between mb-1">
                            <h4 className="font-medium">{item.alert}</h4>
                            <Badge variant={item.severity === 'high' ? 'destructive' : item.severity === 'moderate' ? 'default' : 'secondary'}>
                              {item.severity}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">{item.date}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Top Health Concerns</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    { concern: 'Respiratory Issues', trend: 'Monitored' },
                    { concern: 'Cardiovascular', trend: 'Monitored' },
                    { concern: 'Digestive Problems', trend: 'Stable' },
                    { concern: 'Mental Health', trend: 'Rising' },
                    { concern: 'Skin Conditions', trend: 'Stable' },
                  ].map((item) => (
                    <div key={item.concern} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <p className="font-medium">{item.concern}</p>
                      <Badge variant="secondary">{item.trend}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

      </Tabs>
    </div>
  );
};
