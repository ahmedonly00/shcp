import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { FileText, Download, Loader2, Mail, RefreshCw, AlertCircle } from 'lucide-react';
import { analyticsApi, ReportData, ScheduledReportConfig } from '@/app/api/analytics';
import { downloadMohReportPdf } from '@/app/lib/downloadReportPdf';
import { useAuth } from '@/app/context/AuthContext';
import { toast } from 'sonner';

const ALL_METRICS = [
  { key: 'consultations',  label: 'Consultations' },
  { key: 'appointments',   label: 'Appointments' },
  { key: 'registrations',  label: 'Registrations' },
  { key: 'symptoms',       label: 'Symptom Reports' },
  { key: 'prescriptions',  label: 'Prescriptions' },
  { key: 'providers',      label: 'Providers' },
];

export const AdminReports: React.FC = () => {
  const { user } = useAuth();

  const defaultFrom = `${new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)}T00:00`;
  const defaultTo   = `${new Date().toISOString().slice(0, 10)}T23:59`;

  const [reportFrom,       setReportFrom]       = useState(defaultFrom);
  const [reportTo,         setReportTo]         = useState(defaultTo);
  const [selectedMetrics,  setSelectedMetrics]  = useState<string[]>(ALL_METRICS.map(m => m.key));
  const [reportData,       setReportData]       = useState<ReportData | null>(null);
  const [loadingReport,    setLoadingReport]    = useState(false);
  const [exportingReport,  setExportingReport]  = useState<'csv' | 'xlsx' | 'pdf' | null>(null);

  const [scheduledConfig,  setScheduledConfig]  = useState<ScheduledReportConfig>({
    recipientEmails: [], schedule: 'WEEKLY', metrics: ALL_METRICS.map(m => m.key), enabled: false,
  });
  const [recipientsInput,  setRecipientsInput]  = useState('');
  const [savingConfig,     setSavingConfig]     = useState(false);
  const [loadingConfig,    setLoadingConfig]    = useState(false);

  const fromDate = reportFrom.slice(0, 10);
  const toDate   = reportTo.slice(0, 10);

  const toggleMetric = (key: string) =>
    setSelectedMetrics(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);

  useEffect(() => {
    setLoadingConfig(true);
    analyticsApi.getScheduledConfig()
      .then(cfg => { setScheduledConfig(cfg); setRecipientsInput(cfg.recipientEmails.join(', ')); })
      .catch(() => {})
      .finally(() => setLoadingConfig(false));
  }, []);

  const handleGenerateReport = async () => {
    if (!fromDate || !toDate) { toast.error('Select a date range'); return; }
    if (fromDate > toDate)    { toast.error('Start date must be before end date'); return; }
    setLoadingReport(true);
    setReportData(null);
    try {
      const data = await analyticsApi.getMohReport(fromDate, toDate, selectedMetrics);
      setReportData(data);
    } catch {
      toast.error('Failed to generate report');
    } finally {
      setLoadingReport(false);
    }
  };

  const handleExportReport = async (format: 'csv' | 'xlsx' | 'pdf') => {
    if (!fromDate || !toDate || !reportData) { toast.error('Generate a report first'); return; }
    setExportingReport(format);
    try {
      if (format === 'csv')       await analyticsApi.exportMohReportCsv(fromDate, toDate, selectedMetrics);
      else if (format === 'xlsx') await analyticsApi.exportMohReportExcel(fromDate, toDate, selectedMetrics);
      else                        await downloadMohReportPdf(reportData, user?.name ?? 'Administrator');
    } catch {
      toast.error('Export failed');
    } finally {
      setExportingReport(null);
    }
  };

  const handleSaveScheduledConfig = async () => {
    const emails = recipientsInput.split(/[,\n]+/).map(e => e.trim()).filter(Boolean);
    setSavingConfig(true);
    try {
      const saved = await analyticsApi.saveScheduledConfig({ ...scheduledConfig, recipientEmails: emails });
      setScheduledConfig(saved);
      setRecipientsInput(saved.recipientEmails.join(', '));
      toast.success('Scheduled report configuration saved');
    } catch {
      toast.error('Failed to save configuration');
    } finally {
      setSavingConfig(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Reports</h2>
        <p className="text-muted-foreground">Generate and export Ministry of Health platform reports.</p>
      </div>

      {/* ── Report Configuration ──────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Report Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Quick presets */}
          <div className="space-y-2">
            <Label>Quick Range</Label>
            <div className="flex flex-wrap gap-2">
              {[
                { label: 'Today',        days: 0 },
                { label: 'Last 7 days',  days: 7 },
                { label: 'Last 30 days', days: 30 },
                { label: 'Last 90 days', days: 90 },
                { label: 'This year',    days: -1 },
              ].map(({ label, days }) => (
                <button key={label} type="button"
                  onClick={() => {
                    const now = new Date();
                    const toVal = `${now.toISOString().slice(0, 10)}T23:59`;
                    const fromVal = days === -1
                      ? `${now.getFullYear()}-01-01T00:00`
                      : days === 0
                        ? `${now.toISOString().slice(0, 10)}T00:00`
                        : `${new Date(Date.now() - days * 86400000).toISOString().slice(0, 10)}T00:00`;
                    setReportFrom(fromVal);
                    setReportTo(toVal);
                  }}
                  className="px-3 py-1.5 rounded-full text-xs font-medium border border-border bg-background hover:bg-muted transition-colors"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Custom datetime range */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>From</Label>
              <Input type="datetime-local" value={reportFrom} onChange={e => setReportFrom(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>To</Label>
              <Input type="datetime-local" value={reportTo} onChange={e => setReportTo(e.target.value)} />
            </div>
          </div>
          {fromDate && toDate && fromDate > toDate && (
            <p className="text-xs text-red-600 flex items-center gap-1">
              <AlertCircle className="h-3.5 w-3.5" /> Start date must be before end date
            </p>
          )}

          {/* Metrics */}
          <div className="space-y-2">
            <Label>Metrics to Include</Label>
            <div className="flex flex-wrap gap-2">
              {ALL_METRICS.map(({ key, label }) => (
                <button key={key} type="button" onClick={() => toggleMetric(key)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                    selectedMetrics.includes(key)
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background text-foreground border-border hover:border-primary/60'
                  }`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          <Button onClick={handleGenerateReport} disabled={loadingReport}>
            {loadingReport
              ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Generating…</>
              : <><RefreshCw className="h-4 w-4 mr-2" />Generate Preview</>}
          </Button>
        </CardContent>
      </Card>

      {/* ── Report Preview ────────────────────────────────────────────────── */}
      {(loadingReport || reportData) && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Report Preview</CardTitle>
              {reportData && (
                <div className="flex gap-2">
                  {(['csv', 'xlsx', 'pdf'] as const).map(fmt => (
                    <Button key={fmt} size="sm" variant="outline"
                      disabled={exportingReport === fmt}
                      onClick={() => handleExportReport(fmt)}>
                      {exportingReport === fmt
                        ? <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                        : <Download className="h-4 w-4 mr-1" />}
                      {fmt.toUpperCase()}
                    </Button>
                  ))}
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
              <div className="space-y-6">
                {/* Period meta */}
                <div className="rounded-lg border bg-muted/30 px-4 py-3 space-y-1 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-muted-foreground">
                      Period: <strong className="text-foreground">
                        {new Date(reportFrom).toLocaleString('en-RW', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </strong> to <strong className="text-foreground">
                        {new Date(reportTo).toLocaleString('en-RW', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </strong>
                    </span>
                    <span className="text-xs text-muted-foreground italic">
                      Generated on {new Date().toLocaleString('en-RW', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })} by <strong>{user?.name ?? 'Administrator'}</strong>
                    </span>
                  </div>
                </div>

                {/* Summary table */}
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Summary Metrics</p>
                  <table className="w-full text-sm border-collapse rounded-lg overflow-hidden">
                    <thead>
                      <tr className="bg-primary text-primary-foreground">
                        <th className="text-left px-4 py-2.5 font-semibold">Metric</th>
                        <th className="text-right px-4 py-2.5 font-semibold">Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        ['Total Consultations',             reportData.totalConsultations],
                        ['Completed Consultations',         reportData.completedConsultations],
                        ['Avg Consultation Duration (min)', reportData.avgConsultationDurationMinutes],
                        ['Total Appointments',              reportData.totalAppointments],
                        ['Completed Appointments',          reportData.completedAppointments],
                        ['Cancelled Appointments',          reportData.cancelledAppointments],
                        ['New Patient Registrations',       reportData.newPatients],
                        ['New Provider Registrations',      reportData.newProviders],
                        ['Symptom Reports',                 reportData.totalSymptomReports],
                        ['Prescriptions Issued',            reportData.totalPrescriptions],
                        ['Active Prescriptions',            reportData.activePrescriptions],
                        ['Active Providers',                reportData.activeProviders],
                        ['Total Providers',                 reportData.totalProviders],
                      ].filter(([, v]) => v != null).map(([label, value], i) => (
                        <tr key={i} className={i % 2 === 0 ? 'bg-muted/40' : 'bg-background'}>
                          <td className="px-4 py-2.5 border-b text-foreground">{label as string}</td>
                          <td className="px-4 py-2.5 border-b text-right font-semibold">
                            {typeof value === 'number' && !Number.isInteger(value)
                              ? (value as number).toFixed(1)
                              : String(value)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Daily Appointments */}
                {reportData.dailyAppointments?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                      Daily Appointments ({reportData.dailyAppointments.length} days)
                    </p>
                    <div className="max-h-56 overflow-y-auto rounded-lg border">
                      <table className="w-full text-sm border-collapse">
                        <thead className="sticky top-0">
                          <tr className="bg-primary text-primary-foreground">
                            <th className="text-left px-4 py-2 font-semibold">Date</th>
                            <th className="text-right px-4 py-2 font-semibold">Appointments</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reportData.dailyAppointments.map((d, i) => (
                            <tr key={d.date} className={i % 2 === 0 ? 'bg-muted/40' : 'bg-background'}>
                              <td className="px-4 py-2 border-b">{d.date}</td>
                              <td className="px-4 py-2 border-b text-right font-semibold">{d.count.toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Daily Registrations */}
                {reportData.dailyRegistrations?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                      Daily Registrations ({reportData.dailyRegistrations.length} days)
                    </p>
                    <div className="max-h-56 overflow-y-auto rounded-lg border">
                      <table className="w-full text-sm border-collapse">
                        <thead className="sticky top-0">
                          <tr className="bg-primary text-primary-foreground">
                            <th className="text-left px-4 py-2 font-semibold">Date</th>
                            <th className="text-right px-4 py-2 font-semibold">New Users</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reportData.dailyRegistrations.map((d, i) => (
                            <tr key={d.date} className={i % 2 === 0 ? 'bg-muted/40' : 'bg-background'}>
                              <td className="px-4 py-2 border-b">{d.date}</td>
                              <td className="px-4 py-2 border-b text-right font-semibold">{d.count.toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}

      {/* ── Scheduled Delivery ────────────────────────────────────────────── */}
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
                <button type="button"
                  onClick={() => setScheduledConfig(p => ({ ...p, enabled: !p.enabled }))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${scheduledConfig.enabled ? 'bg-primary' : 'bg-border'}`}>
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${scheduledConfig.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
                <span className="text-sm font-medium">{scheduledConfig.enabled ? 'Enabled' : 'Disabled'}</span>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Schedule</Label>
                  <Select value={scheduledConfig.schedule}
                    onValueChange={v => setScheduledConfig(p => ({ ...p, schedule: v as 'WEEKLY' | 'MONTHLY' }))}>
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
                      <button key={key} type="button"
                        onClick={() => setScheduledConfig(p => ({
                          ...p,
                          metrics: p.metrics.includes(key) ? p.metrics.filter(k => k !== key) : [...p.metrics, key],
                        }))}
                        className={`px-2 py-1 rounded text-xs font-medium border transition-colors ${
                          scheduledConfig.metrics.includes(key)
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-background text-foreground border-border'
                        }`}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Recipient Emails (comma-separated)</Label>
                <Input placeholder="moh@gov.rw, stats@minisante.gov.rw"
                  value={recipientsInput} onChange={e => setRecipientsInput(e.target.value)} />
                <p className="text-xs text-muted-foreground">Reports are sent automatically as CSV + Excel attachments.</p>
              </div>

              {scheduledConfig.lastSentAt && (
                <p className="text-xs text-muted-foreground">
                  Last sent: {new Date(scheduledConfig.lastSentAt).toLocaleString()}
                </p>
              )}

              <Button onClick={handleSaveScheduledConfig} disabled={savingConfig}>
                {savingConfig ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Mail className="h-4 w-4 mr-2" />}
                Save Configuration
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
