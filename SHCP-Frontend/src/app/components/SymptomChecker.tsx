import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { Progress } from '@/app/components/ui/progress';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/app/components/ui/dialog';
import {
  Activity, AlertCircle, Search, MapPin, Calendar,
  CheckCircle, XCircle, AlertTriangle, FileText, Plus, Loader2,
  Stethoscope, ClipboardList, Clock, Download, Phone, ChevronDown, ChevronUp, Brain,
  ThumbsUp, ThumbsDown, HelpCircle
} from 'lucide-react';
import { symptomsApi, FeedbackInput } from '@/app/api/symptoms';
import { downloadSymptomAssessmentPdf } from '@/app/lib/downloadReportPdf';
import { patientsApi } from '@/app/api/patients';
import { SymptomCheck, ExplainingFactor, mapApiSymptomReport, mapApiSymptomReportSummary } from '@/app/types';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

const COMMON_SYMPTOMS = [
  'Headache', 'Fever', 'Cough', 'Sore throat', 'Fatigue',
  'Nausea', 'Vomiting', 'Diarrhea', 'Chest pain', 'Shortness of breath',
  'Abdominal pain', 'Back pain', 'Joint pain', 'Muscle aches', 'Dizziness',
  'Rash', 'Itching', 'Runny nose', 'Sneezing', 'Loss of appetite',
  'Insomnia', 'Anxiety', 'Depression', 'Blurred vision', 'Ear pain',
];

/** Format a canonical symptom name (e.g. "high_fever") into human-readable form ("High Fever"). */
function formatSymptomName(name: string): string {
  return name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

/** Download a styled PDF report for a symptom assessment. */
async function downloadAssessmentReport(check: SymptomCheck) {
  try {
    await downloadSymptomAssessmentPdf(check);
  } catch {
    // fallback: silently ignore
  }
}

interface BodyMapProps { onLocationSelect: (l: string) => void; selectedLocations: string[]; }

const BODY_PARTS: { name: string; cx: number; cy: number; rx: number; ry: number }[] = [
  { name: 'Head',       cx: 100, cy: 38,  rx: 22,  ry: 26  },
  { name: 'Neck',       cx: 100, cy: 72,  rx: 12,  ry: 10  },
  { name: 'Chest',      cx: 100, cy: 110, rx: 34,  ry: 28  },
  { name: 'Abdomen',    cx: 100, cy: 155, rx: 30,  ry: 22  },
  { name: 'Left Arm',   cx: 53,  cy: 118, rx: 12,  ry: 30  },
  { name: 'Right Arm',  cx: 147, cy: 118, rx: 12,  ry: 30  },
  { name: 'Left Leg',   cx: 80,  cy: 220, rx: 16,  ry: 40  },
  { name: 'Right Leg',  cx: 120, cy: 220, rx: 16,  ry: 40  },
  { name: 'Back',       cx: 100, cy: 135, rx: 34,  ry: 32  },
];

const BodyMap: React.FC<BodyMapProps> = ({ onLocationSelect, selectedLocations }) => {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col sm:flex-row gap-4 items-center">
      {/* SVG figure */}
      <div className="flex-shrink-0">
        <svg viewBox="0 0 200 280" width="160" height="224" aria-label="Body map">
          {/* silhouette */}
          <ellipse cx="100" cy="38"  rx="22" ry="26" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground/30" />
          <rect    x="88"  y="63"  width="24" height="18" rx="6"  fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground/30" />
          <rect    x="66"  y="82"  width="68" height="56" rx="8"  fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground/30" />
          <rect    x="70"  y="136" width="60" height="44" rx="6"  fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground/30" />
          <rect    x="41"  y="84"  width="23" height="60" rx="10" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground/30" />
          <rect    x="136" y="84"  width="23" height="60" rx="10" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground/30" />
          <rect    x="64"  y="182" width="32" height="80" rx="12" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground/30" />
          <rect    x="104" y="182" width="32" height="80" rx="12" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground/30" />
          {/* clickable zones */}
          {BODY_PARTS.map(p => (
            <ellipse key={p.name} cx={p.cx} cy={p.cy} rx={p.rx} ry={p.ry}
              className="cursor-pointer transition-all"
              fill={selectedLocations.includes(p.name) ? 'hsl(var(--primary))' : 'transparent'}
              fillOpacity={selectedLocations.includes(p.name) ? 0.25 : 0}
              stroke={selectedLocations.includes(p.name) ? 'hsl(var(--primary))' : 'transparent'}
              strokeWidth="2"
              onClick={() => onLocationSelect(p.name)}>
              <title>{t(`symptoms.step2.parts.${p.name}`, p.name)}</title>
            </ellipse>
          ))}
        </svg>
      </div>
      {/* label buttons */}
      <div className="flex flex-wrap sm:flex-col gap-2 justify-center">
        {BODY_PARTS.map(p => (
          <button key={p.name} onClick={() => onLocationSelect(p.name)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
              selectedLocations.includes(p.name)
                ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                : 'bg-card text-foreground/70 border-border hover:bg-primary/10 hover:border-primary/40'
            }`}>
            {t(`symptoms.step2.parts.${p.name}`, p.name)}
          </button>
        ))}
      </div>
    </div>
  );
};

export const SymptomChecker: React.FC<{ onNavigateToAppointments: () => void }> = ({ onNavigateToAppointments }) => {
  const [step, setStep] = useState(1);
  const { t, i18n } = useTranslation();
  const appLang = React.useRef(i18n.language);
  // Restore the app language when the patient leaves the symptom checker
  React.useEffect(() => {
    return () => { i18n.changeLanguage(appLang.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [customSymptom, setCustomSymptom] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [bodyLocations, setBodyLocations] = useState<string[]>([]);
  const [severity, setSeverity] = useState<'mild' | 'moderate' | 'severe'>('mild');
  const [duration, setDuration] = useState('');
  const [assessment, setAssessment] = useState<SymptomCheck | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [previousReports, setPreviousReports] = useState<SymptomCheck[]>([]);
  const [showPreviousDialog, setShowPreviousDialog] = useState(false);
  const [selectedPrevious, setSelectedPrevious] = useState<SymptomCheck | null>(null);
  const [showFactors, setShowFactors] = useState(false);
  const [feedbackChoice, setFeedbackChoice] = useState<'yes' | 'no' | null>(null);
  const [doctorDiagnosis, setDoctorDiagnosis] = useState('');
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [feedbackDone, setFeedbackDone] = useState<string | null>(null); // report id that has feedback

  useEffect(() => {
    patientsApi.getMySymptomReports(0, 10)
      .then(reports => setPreviousReports((reports ?? []).map(mapApiSymptomReportSummary)))
      .catch(() => {/* silently ignore */});
  }, []);

  const filteredSymptoms = COMMON_SYMPTOMS.filter(s => s.toLowerCase().includes(searchTerm.toLowerCase()));

  const toggleSymptom = (s: string) =>
    setSelectedSymptoms(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);

  const toggleBodyLocation = (loc: string) =>
    setBodyLocations(prev => prev.includes(loc) ? prev.filter(x => x !== loc) : [...prev, loc]);

  const addCustomSymptom = () => {
    const sym = customSymptom.trim();
    if (!sym) { toast.error(t('symptoms.step1.errorEnter')); return; }
    if (selectedSymptoms.includes(sym)) { toast.error(t('symptoms.step1.errorDuplicate')); return; }
    setSelectedSymptoms(prev => [...prev, sym]);
    setCustomSymptom('');
    toast.success(t('symptoms.step1.addedToast', { name: sym }));
  };

  const analyzeSymptoms = async () => {
    setIsAnalyzing(true);
    setStep(4);
    setProgress(20);

    const symptomText = [
      ...selectedSymptoms,
      bodyLocations.length ? `located in ${bodyLocations.join(', ')}` : '',
      `severity: ${severity}`,
      duration ? `duration: ${duration}` : '',
    ].filter(Boolean).join(', ');

    try {
      setProgress(50);
      const bodyMapData = bodyLocations.length
        ? Object.fromEntries(bodyLocations.map(l => [l.toLowerCase().replace(/^(left|right)\s+/, ''), true]))
        : undefined;
      const result = await symptomsApi.analyze({
        symptomText,
        symptoms: selectedSymptoms,
        severity,
        duration: duration || undefined,
        language: i18n.language as 'en' | 'fr' | 'rw',
        bodyMapData,
      });
      setProgress(100);
      const mapped = mapApiSymptomReport(result);
      setAssessment(mapped);
      setPreviousReports(prev => [mapped, ...prev]);
      toast.success(t('symptoms.result.toastCompleted'));
    } catch {
      const mapped: SymptomCheck = {
        id: `local-${Date.now()}`,
        userId: '',
        date: new Date().toISOString().split('T')[0],
        symptoms: selectedSymptoms,
        severity,
        duration,
        bodyLocation: bodyLocations.join(', '),
        aiAssessment: {
          possibleConditions: [],
          confidence: 0,
          recommendation: severity === 'severe' ? 'urgent' : severity === 'moderate' ? 'routine' : 'self-care',
          details: t('symptoms.result.toastUnavailable'),
          isDegraded: true,
        },
      };
      setAssessment(mapped);
      toast.warning(t('symptoms.result.toastUnavailable'));
    } finally {
      setIsAnalyzing(false);
    }
  };

  const resetChecker = () => {
    setStep(1); setSelectedSymptoms([]); setBodyLocations([]);
    setSeverity('mild'); setDuration(''); setAssessment(null); setProgress(0);
  };

  const getRecommendationIcon = (rec: string) => {
    if (rec === 'emergency') return <AlertCircle className="h-8 w-8 text-red-500" />;
    if (rec === 'urgent') return <AlertTriangle className="h-8 w-8 text-orange-500" />;
    if (rec === 'routine') return <AlertTriangle className="h-8 w-8 text-yellow-500" />;
    return <CheckCircle className="h-8 w-8 text-green-500" />;
  };

  const getRecommendationColor = (rec: string) => {
    if (rec === 'emergency') return 'bg-red-50 border-red-200';
    if (rec === 'urgent') return 'bg-orange-50 border-orange-200';
    if (rec === 'routine') return 'bg-yellow-50 border-yellow-200';
    return 'bg-green-50 border-green-200';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">{t('symptoms.title')}</h2>
          <p className="text-muted-foreground">{t('symptoms.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={i18n.language}
            onValueChange={(v) => i18n.changeLanguage(v)}
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="en">English</SelectItem>
              <SelectItem value="fr">Français</SelectItem>
              <SelectItem value="rw">Kinyarwanda</SelectItem>
            </SelectContent>
          </Select>
          {assessment && (
            <Button variant="outline" onClick={resetChecker}>
              {t('symptoms.newAssessment')}
            </Button>
          )}
        </div>
      </div>

      {!assessment ? (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>
                  {step === 1 && t('symptoms.steps.selectSymptoms')}
                  {step === 2 && t('symptoms.steps.bodyLocation')}
                  {step === 3 && t('symptoms.steps.additionalDetails')}
                  {step === 4 && t('symptoms.steps.analyzing')}
                </CardTitle>
                <CardDescription>
                  {step === 1 && t('symptoms.steps.selectSymptomsDesc')}
                  {step === 2 && t('symptoms.steps.bodyLocationDesc')}
                  {step === 3 && t('symptoms.steps.additionalDetailsDesc')}
                  {step === 4 && t('symptoms.steps.analyzingDesc')}
                </CardDescription>
              </div>
              {step < 4 && (
                <Badge variant="outline">
                  {t('symptoms.steps.stepOf', { step })}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-6">

            {/* Step 1: Select symptoms */}
            {step === 1 && (
              <>
                <div className="space-y-2">
                  <Label>{t('symptoms.step1.searchLabel')}</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground/70" />
                    <Input
                      placeholder={t('symptoms.step1.searchPlaceholder')}
                      className="pl-10"
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                    />
                  </div>
                </div>

                {selectedSymptoms.length > 0 && (
                  <div className="space-y-2">
                    <Label>{t('symptoms.step1.selected', { count: selectedSymptoms.length })}</Label>
                    <div className="flex flex-wrap gap-2">
                      {selectedSymptoms.map(s => (
                        <Badge key={s} variant="secondary" className="cursor-pointer hover:bg-red-100"
                          onClick={() => toggleSymptom(s)}>
                          {t(`symptoms.commonList.${s}`, formatSymptomName(s))} <XCircle className="ml-1 h-3 w-3" />
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>{t('symptoms.step1.commonSymptoms')}</Label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-64 overflow-y-auto p-2 border rounded-lg">
                    {filteredSymptoms.map(s => (
                      <Button key={s} type="button" size="sm" className="justify-start"
                        variant={selectedSymptoms.includes(s) ? 'default' : 'outline'}
                        onClick={() => toggleSymptom(s)}>
                        {t(`symptoms.commonList.${s}`, s)}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>{t('symptoms.step1.addCustom')}</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder={t('symptoms.step1.customPlaceholder')}
                      value={customSymptom}
                      onChange={e => setCustomSymptom(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && addCustomSymptom()}
                    />
                    <Button type="button" onClick={addCustomSymptom}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <Button className="w-full" onClick={() => setStep(2)} disabled={selectedSymptoms.length === 0}>
                  {t('symptoms.step1.continue')}
                </Button>
              </>
            )}

            {/* Step 2: Body location */}
            {step === 2 && (
              <>
                <div className="space-y-2">
                  <Label>{t('symptoms.step2.selectLocation')}</Label>
                  <BodyMap selectedLocations={bodyLocations} onLocationSelect={toggleBodyLocation} />
                  {bodyLocations.length > 0 && (
                    <div className="flex items-center gap-2 text-sm text-primary mt-2">
                      <MapPin className="h-4 w-4" />
                      <span>{bodyLocations.map(l => t(`symptoms.step2.parts.${l}`, l)).join(', ')}</span>
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setStep(1)}>
                    {t('symptoms.step2.back')}
                  </Button>
                  <Button className="flex-1" onClick={() => setStep(3)}>
                    {t('symptoms.step2.continue')}
                  </Button>
                </div>
              </>
            )}

            {/* Step 3: Severity + duration */}
            {step === 3 && (
              <>
                <div className="space-y-2">
                  <Label>{t('symptoms.step3.severityLabel')}</Label>
                  <Select value={severity} onValueChange={(v: typeof severity) => setSeverity(v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mild">{t('symptoms.step3.mild')}</SelectItem>
                      <SelectItem value="moderate">{t('symptoms.step3.moderate')}</SelectItem>
                      <SelectItem value="severe">{t('symptoms.step3.severe')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>{t('symptoms.step3.durationLabel')}</Label>
                    <span className="text-xs text-muted-foreground/70">{t('symptoms.step3.durationHint')}</span>
                  </div>
                  <Select value={duration} onValueChange={setDuration}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('symptoms.step3.durationPlaceholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="less-than-1-day">{t('symptoms.step3.dur_lt1d')}</SelectItem>
                      <SelectItem value="1-3-days">{t('symptoms.step3.dur_1_3')}</SelectItem>
                      <SelectItem value="3-7-days">{t('symptoms.step3.dur_3_7')}</SelectItem>
                      <SelectItem value="1-2-weeks">{t('symptoms.step3.dur_1_2w')}</SelectItem>
                      <SelectItem value="more-than-2-weeks">{t('symptoms.step3.dur_gt2w')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                  <h4 className="font-medium text-foreground mb-2">{t('symptoms.step3.summaryTitle')}</h4>
                  <ul className="space-y-1 text-sm text-foreground/80">
                    <li>• {t('symptoms.step3.summarySymptoms')}: {selectedSymptoms.map(s => t(`symptoms.commonList.${s}`, formatSymptomName(s))).join(', ')}</li>
                    {bodyLocations.length > 0 && (
                      <li>• {t('symptoms.step3.summaryLocation')}: {bodyLocations.map(l => t(`symptoms.step2.parts.${l}`, l)).join(', ')}</li>
                    )}
                    <li>• {t('symptoms.step3.summarySeverity')}: {severity.charAt(0).toUpperCase() + severity.slice(1)}</li>
                    {duration && (
                      <li>• {t('symptoms.step3.summaryDuration')}: {duration.replace(/-/g, ' ')}</li>
                    )}
                  </ul>
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setStep(2)}>
                    {t('symptoms.step3.back')}
                  </Button>
                  <Button className="flex-1" onClick={analyzeSymptoms}>
                    {t('symptoms.step3.getAssessment')}
                  </Button>
                </div>
              </>
            )}

            {/* Step 4: Loading */}
            {step === 4 && isAnalyzing && (
              <div className="py-12 text-center space-y-4">
                <div className="flex justify-center">
                  <Loader2 className="h-16 w-16 animate-spin text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg mb-2">{t('symptoms.loading.title')}</h3>
                  <p className="text-muted-foreground text-sm">{t('symptoms.loading.desc')}</p>
                </div>
                <Progress value={progress} className="w-full max-w-xs mx-auto" />
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Assessment result */}
          <Card className={`border-2 ${getRecommendationColor(assessment.aiAssessment.recommendation)}`}>
            <CardHeader>
              <div className="flex items-start gap-4">
                {getRecommendationIcon(assessment.aiAssessment.recommendation)}
                <div className="flex-1 min-w-0">
                  <CardTitle>{t('symptoms.result.title')}</CardTitle>
                  <CardDescription>{t('symptoms.result.subtitle')}</CardDescription>
                </div>
                <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                  <Badge variant="outline" className="text-xs capitalize font-semibold">
                    {assessment.aiAssessment.recommendation}
                  </Badge>
                  {assessment.aiAssessment.confidence > 0 && (
                    <span className="text-xs text-muted-foreground font-mono" title={t('symptoms.result.screeningNote')}>
                      {Math.round(assessment.aiAssessment.confidence)}% {t('symptoms.result.confidence', 'match')}
                    </span>
                  )}
                  {assessment.aiAssessment.modelVersion && (
                    <span className="text-[10px] text-muted-foreground/50">
                      {assessment.aiAssessment.modelVersion}
                    </span>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">

              {/* ── Differential diagnosis panel ── */}
              {(assessment.aiAssessment.topPredictions?.length ?? 0) > 0 ? (
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm text-foreground/80">{t('symptoms.result.differential')}</h4>
                  {assessment.aiAssessment.topPredictions!.map((p, i) => (
                    <div key={i} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className={`flex items-center gap-1.5 ${i === 0 ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>
                          {i === 0 && <span className="text-primary">●</span>}
                          {p.disease}
                          {i === 0 && assessment.aiAssessment.icd10 && (
                            <span className="font-mono text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded border">
                              ICD-10: {assessment.aiAssessment.icd10}
                            </span>
                          )}
                        </span>
                        <span className={`font-mono text-xs px-2 py-0.5 rounded-full ${
                          i === 0 ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                        }`}>
                          {Math.round(p.probability)}%
                        </span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full transition-all ${
                            i === 0 ? 'bg-primary' : i === 1 ? 'bg-primary/40' : 'bg-muted'
                          }`}
                          style={{ width: `${Math.round(p.probability)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                  {assessment.aiAssessment.isDegraded && (
                    <p className="text-xs text-amber-600 mt-1">{t('symptoms.result.lowConfidenceNote')}</p>
                  )}
                  <p className="text-xs text-muted-foreground/70 mt-2 italic">
                    {t('symptoms.result.screeningNote')}
                  </p>
                </div>
              ) : assessment.aiAssessment.isDegraded ? (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm">
                    <p className="font-medium text-amber-900">{t('symptoms.result.aiUnavailableTitle', 'AI analysis unavailable')}</p>
                    <p className="text-xs text-amber-700 mt-0.5">{t('symptoms.result.aiUnavailableDesc', 'Your symptoms have been recorded. A healthcare provider can review them during your appointment.')}</p>
                  </div>
                </div>
              ) : assessment.aiAssessment.possibleConditions.length > 0 && (
                <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                  <p className="text-sm text-foreground">
                    {t('symptoms.previous.possibleCondition')}:{' '}
                    <span className="font-bold">{assessment.aiAssessment.possibleConditions[0]}</span>.
                  </p>
                  <p className="text-xs text-primary mt-1">
                    {Math.round(assessment.aiAssessment.confidence)}%
                  </p>
                </div>
              )}

              {/* ── Low confidence notice ── */}
              {assessment.aiAssessment.isLowConfidence && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm">
                    <p className="font-medium text-amber-900">Low AI confidence</p>
                    <p className="text-xs text-amber-700 mt-0.5">
                      The AI could not reach a confident diagnosis from the symptoms provided.
                      Add more specific symptoms or describe them in more detail for a better result.
                    </p>
                  </div>
                </div>
              )}

              {/* ── SHAP explaining factors ── */}
              {(assessment.aiAssessment.explainingFactors?.length ?? 0) > 0 && (
                <div className="border rounded-lg overflow-hidden">
                  <button
                    className="w-full flex items-center justify-between px-4 py-3 bg-muted/40 hover:bg-muted/60 transition-colors text-sm font-medium"
                    onClick={() => setShowFactors(f => !f)}
                  >
                    <div className="flex items-center gap-2">
                      <Brain className="h-4 w-4 text-primary" />
                      Why this diagnosis?
                    </div>
                    {showFactors ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  </button>
                  {showFactors && (
                    <div className="px-4 py-3 space-y-2.5">
                      <p className="text-xs text-muted-foreground mb-1">
                        Top symptoms influencing this prediction (SHAP values):
                      </p>
                      {assessment.aiAssessment.explainingFactors!.map((f: ExplainingFactor, i: number) => (
                        <div key={i} className="space-y-0.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="flex items-center gap-1.5">
                              <span className={`inline-block w-2 h-2 rounded-full ${f.direction === 'positive' ? 'bg-green-500' : 'bg-red-400'}`} />
                              <span className={f.present ? 'font-medium text-foreground' : 'text-muted-foreground'}>
                                {f.symptom.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                              </span>
                              {!f.present && (
                                <span className="text-[10px] text-muted-foreground/60 italic">(not reported)</span>
                              )}
                            </span>
                            <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded ${f.direction === 'positive' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                              {f.direction === 'positive' ? '+' : ''}{f.contribution.toFixed(3)}
                            </span>
                          </div>
                          <div className="w-full bg-muted rounded-full h-1">
                            <div
                              className={`h-1 rounded-full ${f.direction === 'positive' ? 'bg-green-500' : 'bg-red-400'}`}
                              style={{ width: `${Math.min(100, Math.abs(f.contribution) * 300)}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── What to do ── */}
              <div>
                <h4 className="font-semibold mb-2">{t('symptoms.result.whatToDo')}</h4>
                <div className="bg-card rounded-lg p-4 border space-y-2">
                  <p className="text-sm">{assessment.aiAssessment.details}</p>
                  {assessment.aiAssessment.followUpDays != null && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1 border-t">
                      <Clock className="h-3.5 w-3.5" />
                      <span>
                        {t(`symptoms.result.followUp_${assessment.aiAssessment.followUpDays === 1 ? 'one' : 'other'}`, { count: assessment.aiAssessment.followUpDays })}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* ── Specialist recommendation ── */}
              {assessment.aiAssessment.specialistType && (
                <div className="flex items-start gap-3 bg-indigo-50 border border-indigo-200 rounded-lg p-3">
                  <Stethoscope className="h-4 w-4 text-indigo-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm">
                    <span className="font-medium text-indigo-900">{t('symptoms.result.specialist')}: </span>
                    <span className="text-indigo-800">{assessment.aiAssessment.specialistType}</span>
                  </div>
                </div>
              )}

              {/* ── Self-care tips ── */}
              {(assessment.aiAssessment.selfCareTips?.length ?? 0) > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <ClipboardList className="h-4 w-4 text-green-600" />
                    <h4 className="font-semibold text-sm">{t('symptoms.result.selfCare')}</h4>
                  </div>
                  <ul className="space-y-1.5 pl-1">
                    {assessment.aiAssessment.selfCareTips!.map((tip, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-foreground/80">
                        <CheckCircle className="h-3.5 w-3.5 text-green-500 mt-0.5 flex-shrink-0" />
                        {tip}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* ── Reported symptoms ── */}
              <div>
                <h4 className="font-semibold mb-2 text-sm">{t('symptoms.result.yourSymptoms')}</h4>
                <div className="flex flex-wrap gap-2">
                  {assessment.symptoms.map((s, i) => (
                    <Badge key={i} variant="outline">{formatSymptomName(s)}</Badge>
                  ))}
                </div>
              </div>

              {/* ── Actions ── */}
              <div className="flex flex-col gap-2">
                {assessment.aiAssessment.recommendation === 'emergency' && (
                  <a href="tel:912" className="w-full">
                    <Button className="w-full bg-red-600 hover:bg-red-700 text-white">
                      <Phone className="mr-2 h-4 w-4" />
                      Call Emergency Services — 912
                    </Button>
                  </a>
                )}
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => downloadAssessmentReport(assessment)}>
                    <Download className="mr-2 h-4 w-4" />{t('symptoms.result.downloadReport')}
                  </Button>
                  {assessment.aiAssessment.recommendation === 'urgent' || assessment.aiAssessment.recommendation === 'routine' ? (
                    <Button className="flex-1" onClick={onNavigateToAppointments}>
                      <Calendar className="mr-2 h-4 w-4" />{t('symptoms.result.bookAppointment')}
                    </Button>
                  ) : null}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Previous assessments */}
          {previousReports.length > 0 && (
            <Card>
              <CardHeader><CardTitle>{t('symptoms.previous.title')}</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {previousReports.map(r => (
                    <div key={r.id}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer"
                      onClick={() => {
                        setSelectedPrevious(r);
                        setShowPreviousDialog(true);
                        setFeedbackChoice(null);
                        setDoctorDiagnosis('');
                        setFeedbackDone(r.feedbackSubmitted ? r.id : null);
                      }}>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className="text-xs capitalize">{r.severity}</Badge>
                          <span className="text-sm text-muted-foreground">{r.date}</span>
                        </div>
                        <p className="text-sm font-medium">
                          {r.symptoms.slice(0, 4).map(formatSymptomName).join(', ')}
                          {r.symptoms.length > 4 ? '...' : ''}
                        </p>
                      </div>
                      <Button variant="ghost" size="sm"><FileText className="h-4 w-4" /></Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Disclaimer */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <div className="flex gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800">
            <p className="font-medium mb-1">{t('symptoms.disclaimer.title')}</p>
            <p>{t('symptoms.disclaimer.text')}</p>
          </div>
        </div>
      </div>

      {/* Previous assessment dialog */}
      <Dialog open={showPreviousDialog} onOpenChange={setShowPreviousDialog}>
        <DialogContent className="sm:max-w-[500px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('symptoms.previous.dialogTitle')}</DialogTitle>
            <DialogDescription>{t('symptoms.previous.dialogDesc')}</DialogDescription>
          </DialogHeader>
          {selectedPrevious && (
            <div className="space-y-4 pt-1">

              {/* Urgency badge + date */}
              <div className="flex items-center gap-3">
                <Badge className={`capitalize ${
                  selectedPrevious.aiAssessment.recommendation === 'emergency' ? 'bg-red-100 text-red-800 border-red-200' :
                  selectedPrevious.aiAssessment.recommendation === 'urgent'    ? 'bg-orange-100 text-orange-800 border-orange-200' :
                  selectedPrevious.aiAssessment.recommendation === 'routine'   ? 'bg-yellow-100 text-yellow-800 border-yellow-200' :
                  'bg-green-100 text-green-800 border-green-200'
                }`} variant="outline">
                  {selectedPrevious.aiAssessment.recommendation}
                </Badge>
                <span className="text-sm text-muted-foreground">{selectedPrevious.date}</span>
              </div>

              {/* Differential diagnosis */}
              {(selectedPrevious.aiAssessment.topPredictions?.length ?? 0) > 0 ? (
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm">{t('symptoms.previous.aiDifferential')}</h4>
                  {selectedPrevious.aiAssessment.topPredictions!.map((p, i) => (
                    <div key={i} className="space-y-0.5">
                      <div className="flex items-center justify-between text-sm">
                        <span className={`flex items-center gap-1.5 ${i === 0 ? 'font-semibold' : 'text-muted-foreground'}`}>
                          {i === 0 && <span className="text-primary">●</span>}
                          {p.disease}
                          {i === 0 && selectedPrevious.aiAssessment.icd10 && (
                            <span className="font-mono text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded border">
                              ICD-10: {selectedPrevious.aiAssessment.icd10}
                            </span>
                          )}
                        </span>
                        <span className="font-mono text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                          {Math.round(p.probability)}%
                        </span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-1">
                        <div className={`h-1 rounded-full ${i === 0 ? 'bg-primary' : i === 1 ? 'bg-primary/40' : 'bg-muted'}`}
                          style={{ width: `${Math.round(p.probability)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : selectedPrevious.aiAssessment.possibleConditions.length > 0 && (
                <div>
                  <h4 className="font-semibold text-sm mb-1">{t('symptoms.previous.possibleCondition')}</h4>
                  <p className="text-sm font-medium text-primary">
                    {selectedPrevious.aiAssessment.possibleConditions[0]}
                    {selectedPrevious.aiAssessment.icd10 && (
                      <span className="ml-2 font-mono text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded border">
                        ICD-10: {selectedPrevious.aiAssessment.icd10}
                      </span>
                    )}
                  </p>
                </div>
              )}

              {/* What to do */}
              <div>
                <h4 className="font-semibold text-sm mb-1">{t('symptoms.previous.recommendation')}</h4>
                <p className="text-sm bg-muted/50 p-3 rounded border">{selectedPrevious.aiAssessment.details}</p>
                {selectedPrevious.aiAssessment.followUpDays != null && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1.5">
                    <Clock className="h-3 w-3" />
                    {t(`symptoms.previous.followUp_${selectedPrevious.aiAssessment.followUpDays === 1 ? 'one' : 'other'}`, { count: selectedPrevious.aiAssessment.followUpDays })}
                  </div>
                )}
              </div>

              {/* Specialist */}
              {selectedPrevious.aiAssessment.specialistType && (
                <div className="flex items-center gap-2 text-sm bg-indigo-50 border border-indigo-200 rounded-lg p-2.5">
                  <Stethoscope className="h-4 w-4 text-indigo-500 flex-shrink-0" />
                  <span className="text-indigo-800">
                    <span className="font-medium">{t('symptoms.previous.specialist')}: </span>
                    {selectedPrevious.aiAssessment.specialistType}
                  </span>
                </div>
              )}

              {/* Self-care tips */}
              {(selectedPrevious.aiAssessment.selfCareTips?.length ?? 0) > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <ClipboardList className="h-4 w-4 text-green-600" />
                    <h4 className="font-semibold text-sm">{t('symptoms.previous.selfCare')}</h4>
                  </div>
                  <ul className="space-y-1">
                    {selectedPrevious.aiAssessment.selfCareTips!.map((tip, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-foreground/80">
                        <CheckCircle className="h-3.5 w-3.5 text-green-500 mt-0.5 flex-shrink-0" />
                        {tip}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Symptoms */}
              {selectedPrevious.symptoms.length > 0 && (
                <div>
                  <h4 className="font-semibold text-sm mb-1.5">{t('symptoms.previous.reportedSymptoms')}</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedPrevious.symptoms.map((s, i) => (
                      <Badge key={i} variant="outline">{formatSymptomName(s)}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Feedback */}
              <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
                {feedbackDone === selectedPrevious.id ? (
                  <div className="flex items-center gap-2 text-sm text-green-700">
                    <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                    <span className="font-medium">{t('symptoms.previous.feedbackThanks')}</span>
                  </div>
                ) : (
                  <>
                    <p className="text-sm font-medium">{t('symptoms.previous.feedbackTitle')}</p>
                    <p className="text-xs text-muted-foreground">{t('symptoms.previous.feedbackHelps')}</p>
                    <div className="flex gap-2">
                      <Button
                        size="sm" variant={feedbackChoice === 'yes' ? 'default' : 'outline'}
                        className="flex-1 gap-1.5"
                        onClick={() => setFeedbackChoice('yes')}
                      >
                        <ThumbsUp className="h-3.5 w-3.5" />
                        {t('symptoms.previous.feedbackYes')}
                      </Button>
                      <Button
                        size="sm" variant={feedbackChoice === 'no' ? 'default' : 'outline'}
                        className="flex-1 gap-1.5"
                        onClick={() => setFeedbackChoice('no')}
                      >
                        <ThumbsDown className="h-3.5 w-3.5" />
                        {t('symptoms.previous.feedbackNo')}
                      </Button>
                    </div>
                    {feedbackChoice === 'no' && (
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">{t('symptoms.previous.feedbackDoctorLabel')}</label>
                        <Input
                          value={doctorDiagnosis}
                          onChange={e => setDoctorDiagnosis(e.target.value)}
                          placeholder={t('symptoms.previous.feedbackDoctorPlaceholder')}
                          className="text-sm"
                        />
                      </div>
                    )}
                    {feedbackChoice && (
                      <Button
                        size="sm" className="w-full"
                        disabled={feedbackSubmitting}
                        onClick={async () => {
                          setFeedbackSubmitting(true);
                          try {
                            const body: FeedbackInput = {
                              wasCorrect: feedbackChoice === 'yes',
                              doctorDiagnosis: feedbackChoice === 'no' && doctorDiagnosis.trim()
                                ? doctorDiagnosis.trim() : undefined,
                            };
                            await symptomsApi.submitFeedback(selectedPrevious.id, body);
                            setFeedbackDone(selectedPrevious.id);
                            setPreviousReports(prev => prev.map(r =>
                              r.id === selectedPrevious.id ? { ...r, feedbackSubmitted: true } : r
                            ));
                          } catch {
                            toast.error('Could not save feedback. Please try again.');
                          } finally {
                            setFeedbackSubmitting(false);
                          }
                        }}
                      >
                        {feedbackSubmitting
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                          : <HelpCircle className="h-3.5 w-3.5 mr-1" />}
                        {t('symptoms.previous.feedbackSubmit')}
                      </Button>
                    )}
                  </>
                )}
              </div>

              {/* Download */}
              <Button variant="outline" className="w-full mt-2" onClick={() => downloadAssessmentReport(selectedPrevious)}>
                <Download className="h-4 w-4 mr-2" />{t('symptoms.previous.download')}
              </Button>

            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
