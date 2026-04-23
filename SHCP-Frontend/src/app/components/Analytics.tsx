import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/ui/tabs';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import {
  Users, Activity, Calendar, TrendingUp, AlertCircle,
  UserCheck, Video, FileText, Loader2, Download, Mail, RefreshCw,
} from 'lucide-react';
import { Skeleton } from '@/app/components/ui/skeleton';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend
} from 'recharts';
import { analyticsApi, DailyCount, ReportData, ScheduledReportConfig } from '@/app/api/analytics';
import { ApiPlatformStats } from '@/app/types';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

const STATIC_CONSULTATION_TYPES = [
  { name: 'Video', value: 0, color: 'var(--chart-1)' },
  { name: 'Follow-up', value: 0, color: 'var(--chart-3)' },
];

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

const ALL_METRICS = [
  { key: 'consultations',  label: 'Consultations' },
  { key: 'appointments',   label: 'Appointments' },
  { key: 'registrations',  label: 'Registrations' },
  { key: 'symptoms',       label: 'Symptom Reports' },
  { key: 'prescriptions',  label: 'Prescriptions' },
  { key: 'providers',      label: 'Providers' },
];

export const Analytics: React.FC = () => {
  const [stats, setStats] = useState<ApiPlatformStats | null>(null);
  const { t } = useTranslation();
  const [registrations, setRegistrations] = useState<DailyCount[]>([]);
  const [appointments, setAppointments] = useState<DailyCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  // ── MOH Report Generator state ────────────────────────────────────────────
  const defaultFrom = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const defaultTo   = new Date().toISOString().slice(0, 10);
  const [reportFrom, setReportFrom] = useState(defaultFrom);
  const [reportTo, setReportTo]     = useState(defaultTo);
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>(ALL_METRICS.map(m => m.key));
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [exportingReport, setExportingReport] = useState<'csv' | 'xlsx' | null>(null);
  const [scheduledConfig, setScheduledConfig] = useState<ScheduledReportConfig>({
    recipientEmails: [],
    schedule: 'WEEKLY',
    metrics: ALL_METRICS.map(m => m.key),
    enabled: false,
  });
  const [recipientsInput, setRecipientsInput] = useState('');
  const [savingConfig, setSavingConfig] = useState(false);
  const [loadingConfig, setLoadingConfig] = useState(false);

  const toggleMetric = (key: string) =>
    setSelectedMetrics(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );

  const handleGenerateReport = async () => {
    if (!reportFrom || !reportTo) { toast.error('Select a date range'); return; }
    setLoadingReport(true);
    setReportData(null);
    try {
      const data = await analyticsApi.getMohReport(reportFrom, reportTo, selectedMetrics);
      setReportData(data);
    } catch {
      toast.error('Failed to generate report');
    } finally {
      setLoadingReport(false);
    }
  };

  const handleExportReport = async (format: 'csv' | 'xlsx' | 'pdf') => {
    if (!reportFrom || !reportTo) { toast.error('Generate a report first'); return; }
    if (format === 'pdf') {
      if (!reportData) { toast.error('Generate a report first'); return; }
      handlePrintPdf();
      return;
    }
    setExportingReport(format);
    try {
      if (format === 'csv') await analyticsApi.exportMohReportCsv(reportFrom, reportTo, selectedMetrics);
      else await analyticsApi.exportMohReportExcel(reportFrom, reportTo, selectedMetrics);
    } catch {
      toast.error('Export failed');
    } finally {
      setExportingReport(null);
    }
  };

  const handlePrintPdf = () => {
    if (!reportData) return;
    const rows = [
      ['Metric', 'Value'],
      ...[
        ['Period', `${reportData.fromDate} to ${reportData.toDate}`],
        reportData.totalConsultations    != null ? ['Total Consultations',           reportData.totalConsultations]             : null,
        reportData.completedConsultations!= null ? ['Completed Consultations',        reportData.completedConsultations]         : null,
        reportData.avgConsultationDurationMinutes != null ? ['Avg Consultation Duration (min)', reportData.avgConsultationDurationMinutes] : null,
        reportData.totalAppointments     != null ? ['Total Appointments',             reportData.totalAppointments]              : null,
        reportData.completedAppointments != null ? ['Completed Appointments',         reportData.completedAppointments]          : null,
        reportData.cancelledAppointments != null ? ['Cancelled Appointments',         reportData.cancelledAppointments]          : null,
        reportData.newPatients           != null ? ['New Patient Registrations',      reportData.newPatients]                    : null,
        reportData.newProviders          != null ? ['New Provider Registrations',     reportData.newProviders]                   : null,
        reportData.totalSymptomReports   != null ? ['Symptom Reports',                reportData.totalSymptomReports]            : null,
        reportData.totalPrescriptions    != null ? ['Prescriptions Issued',           reportData.totalPrescriptions]             : null,
        reportData.activePrescriptions   != null ? ['Active Prescriptions',           reportData.activePrescriptions]            : null,
        reportData.activeProviders       != null ? ['Active Providers',               reportData.activeProviders]                : null,
        reportData.totalProviders        != null ? ['Total Providers',                reportData.totalProviders]                 : null,
      ].filter(Boolean) as [string, unknown][],
    ];
    const tableRows = rows.map(([k, v]) =>
      `<tr><td style="padding:6px 12px;border:1px solid #ddd;">${k}</td><td style="padding:6px 12px;border:1px solid #ddd;font-weight:600;">${v}</td></tr>`
    ).join('');
    const html = `<!DOCTYPE html><html><head><title>{t("analytics.mohReport")}</title>
      <style>body{font-family:Arial,sans-serif;padding:32px;}h1{font-size:18px;}table{border-collapse:collapse;width:100%;}th{background:#1d4ed8;color:#fff;padding:8px 12px;}</style>
      </head><body>
      <h1>SHCP Ministry of Health Report</h1>
      <p>Period: <strong>${reportData.fromDate} to ${reportData.toDate}</strong></p>
      <table><thead><tr><th>Metric</th><th>Value</th></tr></thead><tbody>${tableRows}</tbody></table>
      <script>window.onload=()=>{window.print();}</script>
      </body></html>`;
    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); }
  };

  const loadScheduledConfig = async () => {
    setLoadingConfig(true);
    try {
      const cfg = await analyticsApi.getScheduledConfig();
      setScheduledConfig(cfg);
      setRecipientsInput(cfg.recipientEmails.join(', '));
    } catch { /* ignore */ }
    finally { setLoadingConfig(false); }
  };

  const handleSaveScheduledConfig = async () => {
    const emails = recipientsInput.split(/[,\n]+/).map(e => e.trim()).filter(Boolean);
    setSavingConfig(true);
    try {
      const saved = await analyticsApi.saveScheduledConfig({
        ...scheduledConfig,
        recipientEmails: emails,
      });
      setScheduledConfig(saved);
      setRecipientsInput(saved.recipientEmails.join(', '));
      toast.success('Scheduled report configuration saved');
    } catch {
      toast.error('Failed to save configuration');
    } finally {
      setSavingConfig(false);
    }
  };

  const handleExport = async (type: 'platform' | 'appointments' | 'registrations') => {
    setExporting(true);
    try {
      if (type === 'platform') await analyticsApi.exportPlatformCsv();
      else if (type === 'appointments') await analyticsApi.exportAppointmentsCsv(30);
      else await analyticsApi.exportRegistrationsCsv(30);
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
    loadScheduledConfig();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const statValue = (n: number | undefined) =>
    loading ? <Skeleton className="h-7 w-14 inline-block align-middle" /> : (n ?? 0).toLocaleString();

  const consultationTypePie = [
    { name: 'Completed', value: stats?.completedAppointments ?? 0, color: '#10b981' },
    { name: 'Pending', value: stats?.pendingAppointments ?? 0, color: '#f59e0b' },
  ];

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
            {t('analytics.exportStats')}
          </Button>
          <Button variant="outline" size="sm" disabled={exporting} onClick={() => handleExport('appointments')}>
            <Download className="h-4 w-4 mr-1" /> {t('analytics.appointmentsCsv')}
          </Button>
          <Button variant="outline" size="sm" disabled={exporting} onClick={() => handleExport('registrations')}>
            <Download className="h-4 w-4 mr-1" /> {t('analytics.registrationsCsv')}
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
                <p className="text-2xl font-bold">{statValue(stats?.totalUsers)}</p>
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
                <p className="text-sm text-muted-foreground">Active Patients</p>
                <p className="text-2xl font-bold">{statValue(stats?.activePatients)}</p>
                <p className="text-xs text-primary">{statValue(stats?.activeProviders)} providers</p>
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
                <p className="text-2xl font-bold">{statValue(stats?.totalAppointments)}</p>
                <p className="text-xs text-muted-foreground">Total</p>
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

      <Tabs defaultValue="overview" className="w-full">
        <TabsList>
          <TabsTrigger value="overview">{t('analytics.overview')}</TabsTrigger>
          <TabsTrigger value="consultations">{t('analytics.consultations')}</TabsTrigger>
          <TabsTrigger value="health">{t('analytics.healthTrends')}</TabsTrigger>
          <TabsTrigger value="moh">{t("analytics.mohReport")}</TabsTrigger>
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
                <p className="text-3xl font-bold">{statValue(stats?.totalAppointments)}</p>
                <p className="text-xs text-muted-foreground mt-1">All time</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <p className="text-sm text-muted-foreground mb-1">Completed</p>
                <p className="text-3xl font-bold">{statValue(stats?.completedAppointments)}</p>
                <p className="text-xs text-green-600 mt-1">Successfully done</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <p className="text-sm text-muted-foreground mb-1">Pending</p>
                <p className="text-3xl font-bold">{statValue(stats?.pendingAppointments)}</p>
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
        {/* ── MOH Report Generator ── */}
        <TabsContent value="moh" className="space-y-6 mt-6">

          {/* Date range + metrics selector */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Report Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>From Date</Label>
                  <Input type="date" value={reportFrom}
                    onChange={e => setReportFrom(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>To Date</Label>
                  <Input type="date" value={reportTo}
                    onChange={e => setReportTo(e.target.value)} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Metrics to Include</Label>
                <div className="flex flex-wrap gap-2">
                  {ALL_METRICS.map(({ key, label }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => toggleMetric(key)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                        selectedMetrics.includes(key)
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-background text-foreground border-border hover:border-primary/60'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <Button onClick={handleGenerateReport} disabled={loadingReport}>
                {loadingReport
                  ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  : <RefreshCw className="h-4 w-4 mr-2" />}
                Generate Preview
              </Button>
            </CardContent>
          </Card>

          {/* Preview panel */}
          {(loadingReport || reportData) && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Report Preview</CardTitle>
                  {reportData && (
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline"
                        disabled={exportingReport === 'csv'}
                        onClick={() => handleExportReport('csv')}>
                        {exportingReport === 'csv'
                          ? <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                          : <Download className="h-4 w-4 mr-1" />}
                        CSV
                      </Button>
                      <Button size="sm" variant="outline"
                        disabled={exportingReport === 'xlsx'}
                        onClick={() => handleExportReport('xlsx')}>
                        {exportingReport === 'xlsx'
                          ? <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                          : <Download className="h-4 w-4 mr-1" />}
                        Excel
                      </Button>
                      <Button size="sm" variant="outline"
                        onClick={() => handleExportReport('pdf')}>
                        <Download className="h-4 w-4 mr-1" />
                        PDF
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {loadingReport ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : reportData ? (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Period: <strong>{reportData.fromDate}</strong> → <strong>{reportData.toDate}</strong>
                    </p>
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="bg-primary text-primary-foreground">
                          <th className="text-left px-4 py-2 font-semibold">Metric</th>
                          <th className="text-right px-4 py-2 font-semibold">Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          ['Total Consultations',           reportData.totalConsultations],
                          ['Completed Consultations',       reportData.completedConsultations],
                          ['Avg Consultation Duration (min)', reportData.avgConsultationDurationMinutes],
                          ['Total Appointments',            reportData.totalAppointments],
                          ['Completed Appointments',        reportData.completedAppointments],
                          ['Cancelled Appointments',        reportData.cancelledAppointments],
                          ['New Patient Registrations',     reportData.newPatients],
                          ['New Provider Registrations',    reportData.newProviders],
                          ['Symptom Reports',               reportData.totalSymptomReports],
                          ['Prescriptions Issued',          reportData.totalPrescriptions],
                          ['Active Prescriptions',          reportData.activePrescriptions],
                          ['Active Providers',              reportData.activeProviders],
                          ['Total Providers',               reportData.totalProviders],
                        ].filter(([, v]) => v != null).map(([label, value], i) => (
                          <tr key={i} className={i % 2 === 0 ? 'bg-muted/40' : 'bg-background'}>
                            <td className="px-4 py-2 border-b">{label as string}</td>
                            <td className="px-4 py-2 border-b text-right font-semibold">{String(value)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          )}

          {/* Scheduled delivery */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Scheduled Delivery to MOH
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {loadingConfig ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setScheduledConfig(p => ({ ...p, enabled: !p.enabled }))}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        scheduledConfig.enabled ? 'bg-primary' : 'bg-border'
                      }`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        scheduledConfig.enabled ? 'translate-x-6' : 'translate-x-1'
                      }`} />
                    </button>
                    <span className="text-sm font-medium">
                      {scheduledConfig.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Schedule</Label>
                      <Select
                        value={scheduledConfig.schedule}
                        onValueChange={v => setScheduledConfig(p => ({
                          ...p, schedule: v as 'WEEKLY' | 'MONTHLY'
                        }))}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="WEEKLY">Weekly (every Monday)</SelectItem>
                          <SelectItem value="MONTHLY">Monthly (1st of month)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Metrics in report</Label>
                      <div className="flex flex-wrap gap-1">
                        {ALL_METRICS.map(({ key, label }) => (
                          <button
                            key={key}
                            type="button"
                            onClick={() => setScheduledConfig(p => ({
                              ...p,
                              metrics: p.metrics.includes(key)
                                ? p.metrics.filter(k => k !== key)
                                : [...p.metrics, key],
                            }))}
                            className={`px-2 py-1 rounded text-xs font-medium border transition-colors ${
                              scheduledConfig.metrics.includes(key)
                                ? 'bg-primary text-primary-foreground border-primary'
                                : 'bg-background text-foreground border-border'
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Recipient Emails (comma-separated)</Label>
                    <Input
                      placeholder="moh@gov.rw, stats@minisante.gov.rw"
                      value={recipientsInput}
                      onChange={e => setRecipientsInput(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Reports are sent automatically as CSV + Excel attachments.
                    </p>
                  </div>

                  {scheduledConfig.lastSentAt && (
                    <p className="text-xs text-muted-foreground">
                      Last sent: {new Date(scheduledConfig.lastSentAt).toLocaleString()}
                    </p>
                  )}

                  <Button onClick={handleSaveScheduledConfig} disabled={savingConfig}>
                    {savingConfig
                      ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      : <Mail className="h-4 w-4 mr-2" />}
                    Save Configuration
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>


      </Tabs>
    </div>
  );
};
