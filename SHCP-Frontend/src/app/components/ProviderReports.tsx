import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Label } from '@/app/components/ui/label';
import { Textarea } from '@/app/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { FileText, Download, Loader2, User, Activity } from 'lucide-react';
import { useAuth } from '@/app/context/AuthContext';
import { providersApi } from '@/app/api/providers';
import { analyticsApi } from '@/app/api/analytics';
import { downloadProviderReportPdf, downloadPatientCheckUpPdf } from '@/app/lib/downloadReportPdf';
import { ProviderConsultationRow } from '@/app/types';
import { toast } from 'sonner';

interface PatientOption { id: string; name: string; }

export const ProviderReports: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();

  // ── Consultation Summary Report ───────────────────────────────────────────
  const defaultFrom = `${new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)}T00:00`;
  const defaultTo   = `${new Date().toISOString().slice(0, 10)}T23:59`;

  const [reportFrom,        setReportFrom]        = useState(defaultFrom);
  const [reportTo,          setReportTo]          = useState(defaultTo);
  const [reportFilter,      setReportFilter]      = useState('ALL');
  const [consultationRows,  setConsultationRows]  = useState<ProviderConsultationRow[]>([]);
  const [loadingReport,     setLoadingReport]     = useState(false);
  const [reportGenerated,   setReportGenerated]   = useState(false);
  const [exportingReport,   setExportingReport]   = useState(false);
  const [stats,             setStats]             = useState<import('@/app/types').ApiProviderStats | null>(null);

  // ── Check-Up Report ───────────────────────────────────────────────────────
  const [patients,          setPatients]          = useState<PatientOption[]>([]);
  const [checkUpPatientId,  setCheckUpPatientId]  = useState('');
  const [observations,      setObservations]      = useState('');
  const [nextSteps,         setNextSteps]         = useState('');
  const [generatingCheckUp, setGeneratingCheckUp] = useState(false);

  useEffect(() => {
    analyticsApi.providerStats().then(s => setStats(s)).catch(() => {});
    providersApi.getMyPatients().then(list => {
      setPatients(
        list
          .map(p => ({ id: p.patientId, name: p.name }))
          .filter(p => p.id && p.name)
      );
    }).catch(() => {});
  }, []);

  const handleGenerateReport = async () => {
    const from = reportFrom.slice(0, 10);
    const to   = reportTo.slice(0, 10);
    if (!from || !to || from > to) { toast.error(t('providerReports.invalidDateRange')); return; }
    setLoadingReport(true);
    setReportGenerated(false);
    try {
      const rows = await analyticsApi.providerConsultationSummary(from, to, reportFilter);
      setConsultationRows(rows ?? []);
      setReportGenerated(true);
      if ((rows ?? []).length === 0) toast.info(t('providerReports.noConsultationsRange'));
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? t('providerReports.failedReport'));
    } finally {
      setLoadingReport(false);
    }
  };

  const handleExportReport = async () => {
    if (!stats) { toast.error(t('providerReports.statsNotLoaded')); return; }
    setExportingReport(true);
    try {
      await downloadProviderReportPdf(
        stats, user?.name ?? 'Provider',
        consultationRows, reportFilter,
        reportFrom.slice(0, 10), reportTo.slice(0, 10),
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(t('providerReports.pdfExportFailed', { msg }));
    } finally {
      setExportingReport(false);
    }
  };

  const handleGenerateCheckUpReport = async () => {
    if (!checkUpPatientId) { toast.error(t('providerReports.selectPatientFirst')); return; }
    setGeneratingCheckUp(true);
    try {
      const [patientData, ehrData, symptomData] = await Promise.allSettled([
        providersApi.getPatientCheckUpSummary(checkUpPatientId),
        providersApi.getPatientEhr(checkUpPatientId),
        providersApi.getPatientLatestSymptomReport(checkUpPatientId),
      ]);
      if (patientData.status === 'rejected' || ehrData.status === 'rejected') {
        toast.error(t('providerReports.couldNotLoadPatient')); return;
      }
      await downloadPatientCheckUpPdf({
        patient:       patientData.value,
        ehr:           ehrData.value,
        symptomReport: symptomData.status === 'fulfilled' ? symptomData.value : null,
        providerName:  user?.name ?? 'Provider',
        observations,
        nextSteps,
        reportDate:    new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }),
      });
      toast.success(t('providerReports.checkUpDownloaded'));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(t('providerReports.failedCheckUp', { msg }));
    } finally {
      setGeneratingCheckUp(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">{t('providerReports.title')}</h2>
        <p className="text-muted-foreground">{t('providerReports.subtitle')}</p>
      </div>

      {/* ── Patient Consultation Report ───────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {t('providerReports.consultationReport')}
            </CardTitle>
            <Button
              variant="outline" size="sm"
              onClick={handleExportReport}
              disabled={exportingReport || !reportGenerated || !stats}
              className="gap-1.5"
            >
              {exportingReport ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {t('providerReports.exportPdf')}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t('analytics.from')}</label>
              <input type="datetime-local" value={reportFrom} onChange={e => setReportFrom(e.target.value)}
                className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary bg-background" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t('analytics.to')}</label>
              <input type="datetime-local" value={reportTo} onChange={e => setReportTo(e.target.value)}
                className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary bg-background" />
            </div>
          </div>

          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t('providerReports.quickRange')}</p>
            <div className="flex flex-wrap gap-2">
              {([
                { labelKey: 'common.today',               days: 0  },
                { labelKey: 'providerReports.last7Days',  days: 7  },
                { labelKey: 'providerReports.last30Days', days: 30 },
                { labelKey: 'providerReports.last90Days', days: 90 },
                { labelKey: 'providerReports.thisYear',   days: -1 },
              ] as { labelKey: string; days: number }[]).map(({ labelKey, days }) => (
                <button
                  key={labelKey}
                  type="button"
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

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t('providerReports.filterByStatus')}</label>
            <Select value={reportFilter} onValueChange={setReportFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder={t('providerReports.selectStatus')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{t('common.all')}</SelectItem>
                <SelectItem value="CURED">{t('providerReports.cured')}</SelectItem>
                <SelectItem value="NOT_CURED">{t('providerReports.notCured')}</SelectItem>
                <SelectItem value="SEVERE">{t('providerReports.severe')}</SelectItem>
                <SelectItem value="MODERATE">{t('providerReports.moderate')}</SelectItem>
                <SelectItem value="URGENT">{t('providerReports.urgent')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button onClick={handleGenerateReport} disabled={loadingReport} className="w-full sm:w-auto">
            {loadingReport
              ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t('providerReports.generating')}</>
              : <><FileText className="h-4 w-4 mr-2" />{t('analytics.generateReport')}</>}
          </Button>

          {loadingReport ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : reportGenerated ? (
            consultationRows.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <User className="h-10 w-10 mx-auto mb-2 opacity-40" />
                <p className="text-sm font-medium">{t('providerReports.noConsultationsFound')}</p>
                <p className="text-xs mt-1">{t('providerReports.noConsultationsHint')}</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-primary text-primary-foreground">
                      <th className="text-left px-4 py-2.5 font-semibold">#</th>
                      <th className="text-left px-4 py-2.5 font-semibold">{t('providerReports.colPatientName')}</th>
                      <th className="text-left px-4 py-2.5 font-semibold">{t('providerReports.colDiagnosis')}</th>
                      <th className="text-left px-4 py-2.5 font-semibold">{t('common.status')}</th>
                      <th className="text-left px-4 py-2.5 font-semibold">{t('providerReports.colUrgency')}</th>
                      <th className="text-left px-4 py-2.5 font-semibold">{t('providerReports.colPrescription')}</th>
                      <th className="text-left px-4 py-2.5 font-semibold">{t('providerReports.colDateTime')}</th>
                      <th className="text-right px-4 py-2.5 font-semibold">{t('providerReports.colDuration')}</th>
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
                      const rxColor =
                        row.prescriptionStatus === 'DELIVERED'  ? 'text-green-700' :
                        row.prescriptionStatus === 'CANCELLED' || row.prescriptionStatus === 'FAILED'
                          ? 'text-red-600' : row.prescriptionStatus ? 'text-blue-700' : 'text-muted-foreground';

                      const healthStatus: { label: string; cls: string } =
                        row.urgencyLevel === 'EMERGENCY' ? { label: t('providerReports.severe'),   cls: 'bg-red-100 text-red-900 border-red-300' } :
                        row.urgencyLevel === 'URGENT'    ? { label: t('providerReports.urgent'),   cls: 'bg-orange-100 text-orange-800 border-orange-300' } :
                        row.urgencyLevel === 'ROUTINE'   ? { label: t('providerReports.moderate'), cls: 'bg-yellow-100 text-yellow-800 border-yellow-300' } :
                        row.prescriptionStatus === 'DELIVERED' ? { label: t('providerReports.cured'),    cls: 'bg-green-100 text-green-800 border-green-300' } :
                                                                 { label: t('providerReports.notCured'), cls: 'bg-gray-100 text-gray-700 border-gray-300' };

                      return (
                        <tr key={row.consultationId} className={i % 2 === 0 ? 'bg-muted/30' : 'bg-background'}>
                          <td className="px-4 py-2.5 border-b text-muted-foreground">{i + 1}</td>
                          <td className="px-4 py-2.5 border-b font-medium">{row.patientName}</td>
                          <td className="px-4 py-2.5 border-b text-muted-foreground">{row.diagnosis ?? '—'}</td>
                          <td className="px-4 py-2.5 border-b">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${healthStatus.cls}`}>
                              {healthStatus.label}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 border-b">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${urgencyColor}`}>
                              {row.urgencyLevel ?? 'UNKNOWN'}
                            </span>
                          </td>
                          <td className={`px-4 py-2.5 border-b text-xs font-medium ${rxColor}`}>
                            {row.prescriptionStatus ? row.prescriptionStatus.replace(/_/g, ' ') : t('common.none')}
                          </td>
                          <td className="px-4 py-2.5 border-b text-muted-foreground whitespace-nowrap">
                            {row.startedAt ? new Date(row.startedAt).toLocaleString('en-RW', { dateStyle: 'medium', timeStyle: 'short' }) : '—'}
                          </td>
                          <td className="px-4 py-2.5 border-b text-right text-muted-foreground">
                            {row.durationMinutes != null ? `${row.durationMinutes} min` : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div className="px-4 py-2 border-t bg-muted/20 text-xs text-muted-foreground">
                  {t('providerReports.consultationCount', { count: consultationRows.length, filter: reportFilter })}
                </div>
              </div>
            )
          ) : null}
        </CardContent>
      </Card>

      {/* ── General Check-Up Report ───────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            {t('providerReports.checkUpReport')}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {t('providerReports.checkUpSubtitle')}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t('providerReports.selectPatient')}</Label>
            <Select value={checkUpPatientId} onValueChange={setCheckUpPatientId}>
              <SelectTrigger>
                <SelectValue placeholder={t('providerReports.patientPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {patients.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t('providerReports.doctorObservations')}</Label>
            <Textarea rows={4}
              placeholder={t('providerReports.observationsPlaceholder')}
              value={observations} onChange={e => setObservations(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t('providerReports.notesNextSteps')}</Label>
            <Textarea rows={3}
              placeholder={t('providerReports.nextStepsPlaceholder')}
              value={nextSteps} onChange={e => setNextSteps(e.target.value)} />
          </div>

          <Button onClick={handleGenerateCheckUpReport} disabled={generatingCheckUp || !checkUpPatientId} className="w-full sm:w-auto">
            {generatingCheckUp
              ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t('providerReports.generating')}</>
              : <><FileText className="h-4 w-4 mr-2" />{t('providerReports.generateCheckUp')}</>}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};
