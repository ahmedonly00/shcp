import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { FileText, Download, Loader2, Mail, RefreshCw, AlertCircle, Send } from 'lucide-react';
import { analyticsApi, ReportData, ScheduledReportConfig, AdminConsultationRow } from '@/app/api/analytics';
import { downloadMohReportPdf, generateMohReportPdfBytes } from '@/app/lib/downloadReportPdf';
import { useAuth } from '@/app/context/AuthContext';
import { toast } from 'sonner';

const METRIC_KEYS = ['consultations', 'appointments', 'registrations', 'symptoms', 'prescriptions', 'providers'] as const;

export const AdminReports: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();

  const ALL_METRICS = [
    { key: 'consultations',  label: t('adminReports.metricConsultations') },
    { key: 'appointments',   label: t('adminReports.metricAppointments') },
    { key: 'registrations',  label: t('adminReports.metricRegistrations') },
    { key: 'symptoms',       label: t('adminReports.metricSymptoms') },
    { key: 'prescriptions',  label: t('adminReports.metricPrescriptions') },
    { key: 'providers',      label: t('adminReports.metricProviders') },
  ];

  const defaultFrom = `${new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)}T00:00`;
  const defaultTo   = `${new Date().toISOString().slice(0, 10)}T23:59`;

  const [reportFrom,       setReportFrom]       = useState(defaultFrom);
  const [reportTo,         setReportTo]         = useState(defaultTo);
  const [selectedMetrics,  setSelectedMetrics]  = useState<string[]>([...METRIC_KEYS]);
  const [reportData,        setReportData]        = useState<ReportData | null>(null);
  const [consultationRows,  setConsultationRows]  = useState<AdminConsultationRow[]>([]);
  const [loadingReport,     setLoadingReport]     = useState(false);
  const [exportingReport,   setExportingReport]   = useState<'csv' | 'xlsx' | 'pdf' | null>(null);

  const [scheduledConfig,  setScheduledConfig]  = useState<ScheduledReportConfig>({
    recipientEmails: [], schedule: 'WEEKLY', metrics: [...METRIC_KEYS], enabled: false,
  });
  const [recipientsInput,  setRecipientsInput]  = useState('');
  const [savingConfig,     setSavingConfig]     = useState(false);
  const [loadingConfig,    setLoadingConfig]    = useState(false);
  const [sendingNow,       setSendingNow]       = useState(false);

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
    if (!fromDate || !toDate) { toast.error(t('adminReports.toastSelectRange')); return; }
    if (fromDate > toDate)    { toast.error(t('adminReports.toastStartBeforeEnd')); return; }
    setLoadingReport(true);
    setReportData(null);
    setConsultationRows([]);
    try {
      const [data, rows] = await Promise.allSettled([
        analyticsApi.getMohReport(fromDate, toDate, selectedMetrics),
        analyticsApi.adminConsultationSummary(fromDate, toDate),
      ]);
      if (data.status === 'fulfilled')  setReportData(data.value);
      else                              toast.error(t('adminReports.toastFailedReport'));
      if (rows.status === 'fulfilled')  setConsultationRows(rows.value ?? []);
    } catch {
      toast.error(t('adminReports.toastFailedReport'));
    } finally {
      setLoadingReport(false);
    }
  };

  const handleExportReport = async (format: 'csv' | 'xlsx' | 'pdf') => {
    if (!fromDate || !toDate || !reportData) { toast.error(t('adminReports.toastGenerateFirst')); return; }
    setExportingReport(format);
    try {
      if (format === 'csv')       await analyticsApi.exportMohReportCsv(fromDate, toDate, selectedMetrics);
      else if (format === 'xlsx') await analyticsApi.exportMohReportExcel(fromDate, toDate, selectedMetrics);
      else                        await downloadMohReportPdf(reportData, user?.name ?? 'Administrator', consultationRows);
    } catch {
      toast.error(t('adminReports.toastExportFailed'));
    } finally {
      setExportingReport(null);
    }
  };

  const handleSendNow = async () => {
    if (!fromDate || !toDate) { toast.error(t('adminReports.toastSelectRangeFirst')); return; }
    const emails = recipientsInput.split(/[,\n]+/).map(e => e.trim()).filter(Boolean);
    if (emails.length === 0) { toast.error(t('adminReports.toastAddRecipient')); return; }
    setSendingNow(true);
    try {
      await analyticsApi.saveScheduledConfig({ ...scheduledConfig, recipientEmails: emails });

      let data = reportData;
      let rows = consultationRows;
      if (!data) {
        const [reportResult, rowsResult] = await Promise.allSettled([
          analyticsApi.getMohReport(fromDate, toDate, selectedMetrics),
          analyticsApi.adminConsultationSummary(fromDate, toDate),
        ]);
        if (reportResult.status === 'fulfilled') { data = reportResult.value; setReportData(data); }
        else throw new Error('Failed to load report data');
        if (rowsResult.status === 'fulfilled') { rows = rowsResult.value ?? []; setConsultationRows(rows); }
      }

      const pdfBytes = await generateMohReportPdfBytes(data!, user?.name ?? 'Administrator', rows);
      await analyticsApi.sendMohReportPdf(fromDate, toDate, selectedMetrics, pdfBytes);
      toast.success(t('adminReports.toastReportSent', { count: emails.length }));
      setScheduledConfig(prev => ({ ...prev, lastSentAt: new Date().toISOString(), recipientEmails: emails }));
    } catch {
      toast.error(t('adminReports.toastFailedSend'));
    } finally {
      setSendingNow(false);
    }
  };

  const handleSaveScheduledConfig = async () => {
    const emails = recipientsInput.split(/[,\n]+/).map(e => e.trim()).filter(Boolean);
    setSavingConfig(true);
    try {
      const saved = await analyticsApi.saveScheduledConfig({ ...scheduledConfig, recipientEmails: emails });
      setScheduledConfig(saved);
      setRecipientsInput(saved.recipientEmails.join(', '));
      toast.success(t('adminReports.toastConfigSaved'));
    } catch {
      toast.error(t('adminReports.toastFailedConfig'));
    } finally {
      setSavingConfig(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">{t('adminReports.title')}</h2>
        <p className="text-muted-foreground">{t('adminReports.subtitle')}</p>
      </div>

      {/* ── Report Configuration ──────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {t('adminReports.reportConfig')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Quick presets */}
          <div className="space-y-2">
            <Label>{t('adminReports.quickRange')}</Label>
            <div className="flex flex-wrap gap-2">
              {[
                { labelKey: 'common.today',              days: 0 },
                { labelKey: 'adminReports.last7Days',    days: 7 },
                { labelKey: 'adminReports.last30Days',   days: 30 },
                { labelKey: 'adminReports.last90Days',   days: 90 },
                { labelKey: 'adminReports.thisYear',     days: -1 },
              ].map(({ labelKey, days }) => (
                <button key={labelKey} type="button"
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
                  {t(labelKey)}
                </button>
              ))}
            </div>
          </div>

          {/* Custom datetime range */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t('analytics.from')}</Label>
              <Input type="datetime-local" value={reportFrom} onChange={e => setReportFrom(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{t('analytics.to')}</Label>
              <Input type="datetime-local" value={reportTo} onChange={e => setReportTo(e.target.value)} />
            </div>
          </div>
          {fromDate && toDate && fromDate > toDate && (
            <p className="text-xs text-red-600 flex items-center gap-1">
              <AlertCircle className="h-3.5 w-3.5" /> {t('adminReports.dateError')}
            </p>
          )}

          {/* Metrics */}
          <div className="space-y-2">
            <Label>{t('adminReports.metricsToInclude')}</Label>
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
              ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t('adminReports.generating')}</>
              : <><RefreshCw className="h-4 w-4 mr-2" />{t('adminReports.generatePreview')}</>}
          </Button>
        </CardContent>
      </Card>

      {/* ── Report Preview ────────────────────────────────────────────────── */}
      {(loadingReport || reportData) && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{t('adminReports.reportPreview')}</CardTitle>
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
                      {t('adminReports.period')} <strong className="text-foreground">
                        {new Date(reportFrom).toLocaleString('en-RW', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </strong> {t('adminReports.periodTo')} <strong className="text-foreground">
                        {new Date(reportTo).toLocaleString('en-RW', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </strong>
                    </span>
                    <span className="text-xs text-muted-foreground italic">
                      {t('adminReports.generatedOn')} {new Date().toLocaleString('en-RW', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })} {t('adminReports.generatedBy')} <strong>{user?.name ?? 'Administrator'}</strong>
                    </span>
                  </div>
                </div>

                {/* Summary table */}
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{t('adminReports.summaryMetrics')}</p>
                  <table className="w-full text-sm border-collapse rounded-lg overflow-hidden">
                    <thead>
                      <tr className="bg-primary text-primary-foreground">
                        <th className="text-left px-4 py-2.5 font-semibold">{t('adminReports.colMetric')}</th>
                        <th className="text-right px-4 py-2.5 font-semibold">{t('adminReports.colValue')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(
                        [
                          [t('adminReports.rowTotalConsultations'),             reportData.totalConsultations],
                          [t('adminReports.rowCompletedConsultations'),         reportData.completedConsultations],
                          [t('adminReports.rowAvgDuration'),                    reportData.avgConsultationDurationMinutes],
                          [t('adminReports.rowTotalAppointments'),              reportData.totalAppointments],
                          [t('adminReports.rowCompletedAppointments'),          reportData.completedAppointments],
                          [t('adminReports.rowCancelledAppointments'),          reportData.cancelledAppointments],
                          [t('adminReports.rowNewPatients'),                    reportData.newPatients],
                          [t('adminReports.rowNewProviders'),                   reportData.newProviders],
                          [t('adminReports.rowSymptomReports'),                 reportData.totalSymptomReports],
                          [t('adminReports.rowPrescriptionsIssued'),            reportData.totalPrescriptions],
                          [t('adminReports.rowActivePrescriptions'),            reportData.activePrescriptions],
                          [t('adminReports.rowActiveProviders'),                reportData.activeProviders],
                          [t('adminReports.rowTotalProviders'),                 reportData.totalProviders],
                        ] as [string, number | undefined | null][]
                      ).filter(([, v]) => v != null).map(([label, value], i) => (
                        <tr key={i} className={i % 2 === 0 ? 'bg-muted/40' : 'bg-background'}>
                          <td className="px-4 py-2.5 border-b text-foreground">{label}</td>
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
                      {t('adminReports.dailyAppointments', { count: reportData.dailyAppointments.length })}
                    </p>
                    <div className="max-h-56 overflow-y-auto rounded-lg border">
                      <table className="w-full text-sm border-collapse">
                        <thead className="sticky top-0">
                          <tr className="bg-primary text-primary-foreground">
                            <th className="text-left px-4 py-2 font-semibold">{t('adminReports.colDate')}</th>
                            <th className="text-right px-4 py-2 font-semibold">{t('adminReports.colAppointments')}</th>
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
                      {t('adminReports.dailyRegistrations', { count: reportData.dailyRegistrations.length })}
                    </p>
                    <div className="max-h-56 overflow-y-auto rounded-lg border">
                      <table className="w-full text-sm border-collapse">
                        <thead className="sticky top-0">
                          <tr className="bg-primary text-primary-foreground">
                            <th className="text-left px-4 py-2 font-semibold">{t('adminReports.colDate')}</th>
                            <th className="text-right px-4 py-2 font-semibold">{t('adminReports.colNewUsers')}</th>
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

                {/* Provider-Patient Consultation Table */}
                {consultationRows.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                      {t('adminReports.providerConsultations', { count: consultationRows.length })}
                    </p>
                    <div className="overflow-x-auto rounded-lg border max-h-96 overflow-y-auto">
                      <table className="w-full text-sm border-collapse">
                        <thead className="sticky top-0">
                          <tr className="bg-primary text-primary-foreground">
                            <th className="text-left px-3 py-2.5 font-semibold whitespace-nowrap">#</th>
                            <th className="text-left px-3 py-2.5 font-semibold whitespace-nowrap">{t('adminReports.colProvider')}</th>
                            <th className="text-left px-3 py-2.5 font-semibold whitespace-nowrap">{t('adminReports.colPatient')}</th>
                            <th className="text-left px-3 py-2.5 font-semibold whitespace-nowrap">{t('adminReports.colDiagnosis')}</th>
                            <th className="text-left px-3 py-2.5 font-semibold whitespace-nowrap">{t('adminReports.colMedications')}</th>
                            <th className="text-left px-3 py-2.5 font-semibold whitespace-nowrap">{t('adminReports.colUrgency')}</th>
                            <th className="text-left px-3 py-2.5 font-semibold whitespace-nowrap">{t('adminReports.colDateTime')}</th>
                            <th className="text-right px-3 py-2.5 font-semibold whitespace-nowrap">{t('adminReports.colDuration')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {consultationRows.map((row, i) => {
                            const urgencyColor =
                              row.urgencyLevel === 'EMERGENCY' ? 'bg-red-100 text-red-800 border-red-200' :
                              row.urgencyLevel === 'URGENT'    ? 'bg-orange-100 text-orange-800 border-orange-200' :
                              row.urgencyLevel === 'ROUTINE'   ? 'bg-yellow-100 text-yellow-800 border-yellow-200' :
                              row.urgencyLevel === 'SELF_CARE' ? 'bg-green-100 text-green-800 border-green-200' :
                                                                 'bg-gray-100 text-gray-600 border-gray-200';
                            return (
                              <tr key={row.consultationId} className={i % 2 === 0 ? 'bg-muted/30' : 'bg-background'}>
                                <td className="px-3 py-2 border-b text-muted-foreground">{i + 1}</td>
                                <td className="px-3 py-2 border-b font-medium whitespace-nowrap">Dr. {row.providerName}</td>
                                <td className="px-3 py-2 border-b whitespace-nowrap">{row.patientName}</td>
                                <td className="px-3 py-2 border-b text-muted-foreground max-w-[140px] truncate" title={row.diagnosis ?? ''}>{row.diagnosis ?? '—'}</td>
                                <td className="px-3 py-2 border-b text-muted-foreground max-w-[160px] truncate" title={row.medications ?? ''}>{row.medications ?? t('adminReports.nonePrescribed')}</td>
                                <td className="px-3 py-2 border-b">
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${urgencyColor}`}>
                                    {row.urgencyLevel ?? 'UNKNOWN'}
                                  </span>
                                </td>
                                <td className="px-3 py-2 border-b text-muted-foreground whitespace-nowrap">
                                  {row.startedAt
                                    ? new Date(row.startedAt).toLocaleString('en-RW', { dateStyle: 'medium', timeStyle: 'short' })
                                    : '—'}
                                </td>
                                <td className="px-3 py-2 border-b text-right text-muted-foreground whitespace-nowrap">
                                  {row.durationMinutes != null ? `${row.durationMinutes} min` : '—'}
                                </td>
                              </tr>
                            );
                          })}
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
            {t('adminReports.scheduledDelivery')}
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
                <span className="text-sm font-medium">
                  {scheduledConfig.enabled ? t('adminReports.enabled') : t('adminReports.disabled')}
                </span>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('adminReports.scheduleLabel')}</Label>
                  <Select value={scheduledConfig.schedule}
                    onValueChange={v => setScheduledConfig(p => ({ ...p, schedule: v as 'WEEKLY' | 'MONTHLY' }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="WEEKLY">{t('adminReports.weeklySchedule')}</SelectItem>
                      <SelectItem value="MONTHLY">{t('adminReports.monthlySchedule')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t('adminReports.metricsInReport')}</Label>
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
                <Label>{t('adminReports.recipientEmails')}</Label>
                <Input placeholder="moh@gov.rw, stats@minisante.gov.rw"
                  value={recipientsInput} onChange={e => setRecipientsInput(e.target.value)} />
                <p className="text-xs text-muted-foreground">{t('adminReports.emailHint')}</p>
              </div>

              {scheduledConfig.lastSentAt && (
                <p className="text-xs text-muted-foreground">
                  {t('adminReports.lastSent')} {new Date(scheduledConfig.lastSentAt).toLocaleString()}
                </p>
              )}

              <div className="flex flex-wrap gap-3 items-center">
                <Button onClick={handleSaveScheduledConfig} disabled={savingConfig || sendingNow} variant="outline">
                  {savingConfig ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Mail className="h-4 w-4 mr-2" />}
                  {t('adminReports.saveConfig')}
                </Button>
                <Button onClick={handleSendNow} disabled={sendingNow || savingConfig}>
                  {sendingNow ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                  {t('adminReports.sendNow')}
                </Button>
                <p className="text-xs text-muted-foreground">
                  {t('adminReports.sendNowHint')}
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
