import React, { useState, useEffect } from 'react';
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
    if (!from || !to || from > to) { toast.error('Select a valid date range'); return; }
    setLoadingReport(true);
    setReportGenerated(false);
    try {
      const rows = await analyticsApi.providerConsultationSummary(from, to, reportFilter);
      setConsultationRows(rows ?? []);
      setReportGenerated(true);
      if ((rows ?? []).length === 0) toast.info('No completed consultations found in this date range.');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? 'Failed to generate report');
    } finally {
      setLoadingReport(false);
    }
  };

  const handleExportReport = async () => {
    if (!stats) { toast.error('Stats not loaded yet'); return; }
    setExportingReport(true);
    try {
      await downloadProviderReportPdf(
        stats, user?.name ?? 'Provider',
        consultationRows, reportFilter,
        reportFrom.slice(0, 10), reportTo.slice(0, 10),
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`PDF export failed: ${msg}`);
    } finally {
      setExportingReport(false);
    }
  };

  const handleGenerateCheckUpReport = async () => {
    if (!checkUpPatientId) { toast.error('Please select a patient'); return; }
    setGeneratingCheckUp(true);
    try {
      const [patientData, ehrData, symptomData] = await Promise.allSettled([
        providersApi.getPatientCheckUpSummary(checkUpPatientId),
        providersApi.getPatientEhr(checkUpPatientId),
        providersApi.getPatientLatestSymptomReport(checkUpPatientId),
      ]);
      if (patientData.status === 'rejected' || ehrData.status === 'rejected') {
        toast.error('Could not load patient data'); return;
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
      toast.success('Check-up report downloaded');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Failed to generate report: ${msg}`);
    } finally {
      setGeneratingCheckUp(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Reports</h2>
        <p className="text-muted-foreground">Generate consultation summaries and patient check-up reports.</p>
      </div>

      {/* ── Patient Consultation Report ───────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Patient Consultation Report
            </CardTitle>
            <Button
              variant="outline" size="sm"
              onClick={handleExportReport}
              disabled={exportingReport || !reportGenerated || !stats}
              className="gap-1.5"
            >
              {exportingReport ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Export PDF
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">From</label>
              <input type="datetime-local" value={reportFrom} onChange={e => setReportFrom(e.target.value)}
                className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary bg-background" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">To</label>
              <input type="datetime-local" value={reportTo} onChange={e => setReportTo(e.target.value)}
                className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary bg-background" />
            </div>
          </div>

          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Quick Range</p>
            <div className="flex flex-wrap gap-2">
              {([
                { label: 'Today',        days: 0  },
                { label: 'Last 7 days',  days: 7  },
                { label: 'Last 30 days', days: 30 },
                { label: 'Last 90 days', days: 90 },
                { label: 'This year',    days: -1 },
              ] as { label: string; days: number }[]).map(({ label, days }) => (
                <button
                  key={label}
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
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Filter by Status</p>
            <div className="flex flex-wrap gap-2">
              {[
                { key: 'ALL',       label: 'All',       color: 'bg-primary text-primary-foreground',  inactive: 'border-border hover:bg-muted' },
                { key: 'CURED',     label: 'Cured',     color: 'bg-green-600 text-white',              inactive: 'border-green-300 text-green-700 hover:bg-green-50' },
                { key: 'NOT_CURED', label: 'Not Cured', color: 'bg-red-600 text-white',                inactive: 'border-red-300 text-red-700 hover:bg-red-50' },
                { key: 'SEVERE',    label: 'Severe',    color: 'bg-red-900 text-white',                inactive: 'border-red-400 text-red-900 hover:bg-red-50' },
                { key: 'MODERATE',  label: 'Moderate',  color: 'bg-yellow-500 text-white',             inactive: 'border-yellow-400 text-yellow-700 hover:bg-yellow-50' },
                { key: 'URGENT',    label: 'Urgent',    color: 'bg-orange-500 text-white',             inactive: 'border-orange-400 text-orange-700 hover:bg-orange-50' },
              ].map(({ key, label, color, inactive }) => (
                <button key={key} type="button" onClick={() => setReportFilter(key)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                    reportFilter === key ? color : `bg-background ${inactive}`
                  }`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          <Button onClick={handleGenerateReport} disabled={loadingReport} className="w-full sm:w-auto">
            {loadingReport
              ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Generating…</>
              : <><FileText className="h-4 w-4 mr-2" />Generate Report</>}
          </Button>

          {loadingReport ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : reportGenerated ? (
            consultationRows.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <User className="h-10 w-10 mx-auto mb-2 opacity-40" />
                <p className="text-sm font-medium">No completed consultations found</p>
                <p className="text-xs mt-1">Try expanding the date range or changing the filter.</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-primary text-primary-foreground">
                      <th className="text-left px-4 py-2.5 font-semibold">#</th>
                      <th className="text-left px-4 py-2.5 font-semibold">Patient Name</th>
                      <th className="text-left px-4 py-2.5 font-semibold">Diagnosis / Condition</th>
                      <th className="text-left px-4 py-2.5 font-semibold">Urgency</th>
                      <th className="text-left px-4 py-2.5 font-semibold">Prescription</th>
                      <th className="text-left px-4 py-2.5 font-semibold">Date & Time</th>
                      <th className="text-right px-4 py-2.5 font-semibold">Duration</th>
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
                      return (
                        <tr key={row.consultationId} className={i % 2 === 0 ? 'bg-muted/30' : 'bg-background'}>
                          <td className="px-4 py-2.5 border-b text-muted-foreground">{i + 1}</td>
                          <td className="px-4 py-2.5 border-b font-medium">{row.patientName}</td>
                          <td className="px-4 py-2.5 border-b text-muted-foreground">{row.diagnosis ?? '—'}</td>
                          <td className="px-4 py-2.5 border-b">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${urgencyColor}`}>
                              {row.urgencyLevel ?? 'UNKNOWN'}
                            </span>
                          </td>
                          <td className={`px-4 py-2.5 border-b text-xs font-medium ${rxColor}`}>
                            {row.prescriptionStatus ? row.prescriptionStatus.replace(/_/g, ' ') : 'None'}
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
                  {consultationRows.length} consultation{consultationRows.length !== 1 ? 's' : ''} · Filter: {reportFilter}
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
            General Check-Up Report
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Generate a full patient check-up report including medical history, vitals, AI screening, and your observations.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Select Patient</Label>
            <Select value={checkUpPatientId} onValueChange={setCheckUpPatientId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a patient from your appointments…" />
              </SelectTrigger>
              <SelectContent>
                {patients.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Doctor's Observations</Label>
            <Textarea rows={4}
              placeholder="Enter your clinical observations, physical examination findings, patient condition…"
              value={observations} onChange={e => setObservations(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Notes and Next Steps</Label>
            <Textarea rows={3}
              placeholder="Follow-up appointments, referrals, lifestyle recommendations, next tests…"
              value={nextSteps} onChange={e => setNextSteps(e.target.value)} />
          </div>

          <Button onClick={handleGenerateCheckUpReport} disabled={generatingCheckUp || !checkUpPatientId} className="w-full sm:w-auto">
            {generatingCheckUp
              ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Generating…</>
              : <><FileText className="h-4 w-4 mr-2" />Generate Check-Up Report PDF</>}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};
