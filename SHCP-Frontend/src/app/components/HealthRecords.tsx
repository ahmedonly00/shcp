import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Textarea } from '@/app/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/app/components/ui/dialog';
import {
  FileText, Download, Share2, Lock, Pill, Activity,
  AlertCircle, Calendar, Plus, Search, Loader2, Syringe, FlaskConical,
  Upload, Image, X as XIcon
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/ui/tabs';
import { patientsApi } from '@/app/api/patients';
import { ApiHealthRecordDto } from '@/app/types';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

// ── Helpers ───────────────────────────────────────────────────────────────────

type RecordSection = 'diagnoses' | 'medications' | 'allergies' | 'immunizations' | 'labResults' | 'documents';

interface ParsedEntry {
  id: string;
  section: RecordSection;
  title: string;
  description: string;
  date: string;
  extra?: Record<string, string>;
}

function safeParse(json: string): unknown[] {
  try { return JSON.parse(json) ?? []; } catch { return []; }
}

function parseEhr(ehr: ApiHealthRecordDto): ParsedEntry[] {
  const entries: ParsedEntry[] = [];

  (safeParse(ehr.diagnoses) as Record<string, string>[]).forEach((d, i) => {
    const isAiScreening = d.source === 'AI Screening';
    const label = isAiScreening
      ? `${d.name} (AI Screening${d.confidence ? ` · ${d.confidence}` : ''}${d.icd10 ? ` · ICD-10: ${d.icd10}` : ''})`
      : (d.name || d.diagnosis || 'Diagnosis');
    entries.push({
      id: `diag-${i}`, section: 'diagnoses',
      title: label,
      description: d.notes || d.description || '',
      date: d.date || ehr.updatedAt?.slice(0, 10) || '',
      extra: isAiScreening ? { urgency: d.urgency, confidence: d.confidence, source: 'AI Screening' } : undefined,
    });
  });

  (safeParse(ehr.medications) as Record<string, string>[]).forEach((m, i) => {
    entries.push({ id: `med-${i}`, section: 'medications', title: m.name || 'Medication', description: `${m.dosage || ''} — ${m.frequency || ''}`.trim().replace(/^—\s*/, ''), date: m.startDate || ehr.updatedAt?.slice(0, 10) || '', extra: m });
  });

  (safeParse(ehr.allergies) as Record<string, string>[]).forEach((a, i) => {
    entries.push({ id: `allergy-${i}`, section: 'allergies', title: a.allergen || a.name || 'Allergy', description: a.reaction || a.notes || '', date: a.date || ehr.updatedAt?.slice(0, 10) || '' });
  });

  (safeParse(ehr.immunizations) as Record<string, string>[]).forEach((v, i) => {
    entries.push({ id: `vax-${i}`, section: 'immunizations', title: v.vaccine || v.name || 'Vaccination', description: v.notes || '', date: v.date || ehr.updatedAt?.slice(0, 10) || '' });
  });

  (safeParse(ehr.labResults) as Record<string, string>[]).forEach((l, i) => {
    entries.push({ id: `lab-${i}`, section: 'labResults', title: l.testName || l.name || 'Lab Result', description: l.result || l.notes || '', date: l.date || ehr.updatedAt?.slice(0, 10) || '' });
  });

  (safeParse(ehr.documents) as Record<string, string>[]).forEach((doc, i) => {
    entries.push({
      id: `doc-${i}`, section: 'documents',
      title: doc.title || doc.name || 'Document',
      description: doc.description || doc.notes || '',
      date: doc.date || ehr.updatedAt?.slice(0, 10) || '',
      extra: doc,   // preserve fileUrl, storedName, contentType for preview
    });
  });

  return entries;
}

function sectionIcon(section: RecordSection) {
  switch (section) {
    case 'diagnoses':    return <Activity className="h-5 w-5" />;
    case 'medications':  return <Pill className="h-5 w-5" />;
    case 'allergies':    return <AlertCircle className="h-5 w-5" />;
    case 'immunizations': return <Syringe className="h-5 w-5" />;
    case 'labResults':   return <FlaskConical className="h-5 w-5" />;
    default:             return <FileText className="h-5 w-5" />;
  }
}

function sectionColor(section: RecordSection) {
  switch (section) {
    case 'diagnoses':    return 'bg-purple-100 text-purple-600';
    case 'medications':  return 'bg-blue-100 text-blue-600';
    case 'allergies':    return 'bg-red-100 text-red-600';
    case 'immunizations': return 'bg-yellow-100 text-yellow-600';
    case 'labResults':   return 'bg-green-100 text-green-600';
    default:             return 'bg-muted text-muted-foreground';
  }
}

function sectionLabel(section: RecordSection) {
  const labels: Record<RecordSection, string> = {
    diagnoses: 'Diagnosis', medications: 'Medication', allergies: 'Allergy',
    immunizations: 'Vaccination', labResults: 'Lab Result', documents: 'Document',
  };
  return labels[section];
}

// ── Component ─────────────────────────────────────────────────────────────────

export const HealthRecords: React.FC = () => {
  const [ehr, setEhr] = useState<ApiHealthRecordDto | null>(null);
  const { t } = useTranslation();
  const [entries, setEntries] = useState<ParsedEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSection, setFilterSection] = useState<RecordSection | 'all'>('all');
  const [selectedEntry, setSelectedEntry] = useState<ParsedEntry | null>(null);
  const [ehrDocUrl, setEhrDocUrl] = useState<string | null>(null);

  // Upload dialog state
  const [showUpload, setShowUpload] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadTab, setUploadTab] = useState<'form' | 'file'>('form');
  const [form, setForm] = useState({
    section: 'documents' as RecordSection,
    title: '',
    description: '',
    date: new Date().toISOString().slice(0, 10),
    extra: '',
  });
  // File upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileTitle, setFileTitle] = useState('');
  const [fileDate, setFileDate] = useState(new Date().toISOString().slice(0, 10));
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    patientsApi.getMyEhr()
      .then(data => {
        setEhr(data);
        setEntries(parseEhr(data));
      })
      .catch(() => toast.error('Could not load health records'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const storedName = selectedEntry?.extra?.storedName;
    if (!storedName) { setEhrDocUrl(null); return; }
    let revoked = false;
    patientsApi.ehrFileUrl(storedName).then(url => {
      if (!revoked) setEhrDocUrl(url);
    }).catch(() => setEhrDocUrl(null));
    return () => { revoked = true; };
  }, [selectedEntry?.extra?.storedName]);

  const filtered = entries.filter(e => {
    const matchSearch = e.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        e.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchFilter = filterSection === 'all' || e.section === filterSection;
    return matchSearch && matchFilter;
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    if (!fileTitle) setFileTitle(file.name.replace(/\.[^.]+$/, ''));
    // Generate local preview URL
    if (filePreviewUrl) URL.revokeObjectURL(filePreviewUrl);
    setFilePreviewUrl(URL.createObjectURL(file));
  };

  const handleFileUpload = async () => {
    if (!selectedFile) { toast.error('Please select a file'); return; }
    setSaving(true);
    try {
      const updatedEhr = await patientsApi.uploadEhrFile(selectedFile, fileTitle || selectedFile.name, fileDate);
      setEhr(updatedEhr);
      setEntries(parseEhr(updatedEhr));
      toast.success('File uploaded successfully');
      setShowUpload(false);
      setSelectedFile(null);
      setFileTitle('');
      setFileDate(new Date().toISOString().slice(0, 10));
      if (filePreviewUrl) { URL.revokeObjectURL(filePreviewUrl); setFilePreviewUrl(null); }
    } catch {
      toast.error('Upload failed. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleUpload = async () => {
    if (!form.title.trim()) { toast.error('Please enter a title'); return; }
    if (!ehr) { toast.error('Health record not loaded yet'); return; }
    setSaving(true);
    try {
      // Build new entry object
      const newEntry: Record<string, string> = {
        date: form.date,
        ...(form.description ? { notes: form.description } : {}),
      };

      // Map section to the right title field
      if (form.section === 'diagnoses')     newEntry.name       = form.title;
      else if (form.section === 'medications')  newEntry.name  = form.title;
      else if (form.section === 'allergies')    newEntry.allergen = form.title;
      else if (form.section === 'immunizations') newEntry.vaccine = form.title;
      else if (form.section === 'labResults')   newEntry.testName = form.title;
      else                                       newEntry.title   = form.title;

      // Try to merge any extra key=value pairs the user typed
      if (form.extra.trim()) {
        form.extra.split('\n').forEach(line => {
          const [k, ...rest] = line.split(':');
          if (k && rest.length) newEntry[k.trim()] = rest.join(':').trim();
        });
      }

      // Get current section array, append, send PUT
      const currentArray = safeParse(ehr[form.section] as string) as object[];
      const updated = JSON.stringify([...currentArray, newEntry]);

      const updatedEhr = await patientsApi.updateMyEhr({ [form.section]: updated });
      setEhr(updatedEhr);
      setEntries(parseEhr(updatedEhr));
      toast.success('Record added successfully');
      setShowUpload(false);
      setForm({ section: 'documents', title: '', description: '', date: new Date().toISOString().slice(0, 10), extra: '' });
    } catch {
      toast.error('Failed to save record. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const counts = (s: RecordSection) => entries.filter(e => e.section === s).length;

  const handleDownloadPdf = () => {
    if (!ehr) return;
    const sections: { label: string; key: RecordSection }[] = [
      { label: 'Diagnoses', key: 'diagnoses' },
      { label: 'Medications', key: 'medications' },
      { label: 'Allergies', key: 'allergies' },
      { label: 'Immunizations', key: 'immunizations' },
      { label: 'Lab Results', key: 'labResults' },
      { label: 'Documents', key: 'documents' },
    ];
    const sectionHtml = sections.map(({ label, key }) => {
      const items = entries.filter(e => e.section === key);
      if (items.length === 0) return '';
      const rows = items.map(e => `
        <tr>
          <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;font-weight:500">${e.title}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;color:#374151">${e.description || '—'}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;color:#6b7280;white-space:nowrap">${e.date || '—'}</td>
        </tr>`).join('');
      return `
        <h3 style="margin:24px 0 8px;font-size:14px;font-weight:600;color:#1e40af;border-bottom:2px solid #bfdbfe;padding-bottom:4px">${label}</h3>
        <table style="width:100%;border-collapse:collapse;font-size:13px">
          <thead><tr style="background:#eff6ff">
            <th style="padding:6px 8px;text-align:left;font-weight:600">Name</th>
            <th style="padding:6px 8px;text-align:left;font-weight:600">Notes</th>
            <th style="padding:6px 8px;text-align:left;font-weight:600">Date</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>`;
    }).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
      <title>Health Records — ${new Date().toLocaleDateString()}</title>
      <style>body{font-family:Arial,sans-serif;margin:32px;color:#111827}
        h1{font-size:20px;font-weight:700;margin-bottom:4px}
        .subtitle{color:#6b7280;font-size:13px;margin-bottom:24px}
        @media print{button{display:none}}</style>
    </head><body>
      <h1>Electronic Health Record</h1>
      <p class="subtitle">Generated on ${new Date().toLocaleString()}</p>
      ${sectionHtml}
      <p style="margin-top:32px;font-size:11px;color:#9ca3af;border-top:1px solid #e5e7eb;padding-top:12px">
        This document is confidential. All records are encrypted and stored securely.
      </p>
      <script>window.onload=()=>window.print()<\/script>
    </body></html>`;

    const win = window.open('', '_blank');
    if (win) { win.document.write(html); win.document.close(); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">{t("healthRecords.title")}</h2>
          <p className="text-muted-foreground">{t('healthRecords.subtitle')}</p>
        </div>
        <Button onClick={() => setShowUpload(true)}>
          <Plus className="h-4 w-4 mr-2" />
          {t('healthRecords.uploadRecord')}
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        {([
          { label: 'All', section: 'all' as const, icon: <FileText className="h-5 w-5 text-muted-foreground" />, color: 'bg-muted', count: entries.length },
          { label: 'Diagnoses', section: 'diagnoses' as RecordSection, icon: <Activity className="h-5 w-5 text-purple-600" />, color: 'bg-purple-100', count: counts('diagnoses') },
          { label: 'Medications', section: 'medications' as RecordSection, icon: <Pill className="h-5 w-5 text-blue-600" />, color: 'bg-blue-100', count: counts('medications') },
          { label: 'Allergies', section: 'allergies' as RecordSection, icon: <AlertCircle className="h-5 w-5 text-red-600" />, color: 'bg-red-100', count: counts('allergies') },
          { label: 'Lab Results', section: 'labResults' as RecordSection, icon: <FlaskConical className="h-5 w-5 text-green-600" />, color: 'bg-green-100', count: counts('labResults') },
          { label: 'Vaccinations', section: 'immunizations' as RecordSection, icon: <Syringe className="h-5 w-5 text-yellow-600" />, color: 'bg-yellow-100', count: counts('immunizations') },
        ]).map(item => (
          <Card key={item.label} className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => setFilterSection(item.section)}>
            <CardContent className="pt-4 pb-3">
              <div className="text-center">
                <div className={`h-10 w-10 ${item.color} rounded-full flex items-center justify-center mx-auto mb-1`}>
                  {item.icon}
                </div>
                <p className="text-xl font-bold">{item.count}</p>
                <p className="text-xs text-muted-foreground">{item.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground/70" />
              <Input placeholder="Search records..." className="pl-10"
                value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            </div>
            {filterSection !== 'all' && (
              <Button variant="outline" onClick={() => setFilterSection('all')}>Clear Filter</Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Records + Detail */}
      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>
              {filterSection === 'all' ? 'All Records' : sectionLabel(filterSection as RecordSection)}
              <span className="ml-2 text-sm font-normal text-muted-foreground">({filtered.length})</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-7 w-7 animate-spin text-muted-foreground/70" /></div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground/70">
                <FileText className="h-12 w-12 mx-auto mb-2 opacity-40" />
                <p className="font-medium">No records found</p>
                <p className="text-sm mt-1">
                  {entries.length === 0 ? 'Click "Upload Record" to add your first record.' : 'Try a different filter.'}
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                {filtered.map(entry => (
                  <div key={entry.id}
                    className={`p-3 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors ${selectedEntry?.id === entry.id ? 'border-primary bg-secondary' : ''}`}
                    onClick={() => setSelectedEntry(entry)}>
                    <div className="flex items-start gap-3">
                      <div className={`h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0 ${sectionColor(entry.section)}`}>
                        {sectionIcon(entry.section)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <h4 className="font-medium text-sm truncate">{entry.title}</h4>
                          <Badge variant="outline" className="text-xs ml-2 flex-shrink-0">{sectionLabel(entry.section)}</Badge>
                        </div>
                        {entry.description && <p className="text-xs text-muted-foreground line-clamp-1">{entry.description}</p>}
                        {entry.date && (
                          <p className="text-xs text-muted-foreground/70 mt-1 flex items-center gap-1">
                            <Calendar className="h-3 w-3" />{entry.date}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Record Details</CardTitle>
              {selectedEntry && (
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={handleDownloadPdf} disabled={!ehr}>
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => toast.info('Share feature coming soon')}>
                    <Share2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {selectedEntry ? (
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className={`h-12 w-12 rounded-lg flex items-center justify-center flex-shrink-0 ${sectionColor(selectedEntry.section)}`}>
                    {sectionIcon(selectedEntry.section)}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">{selectedEntry.title}</h3>
                    <Badge className="capitalize mt-1">{sectionLabel(selectedEntry.section)}</Badge>
                  </div>
                </div>
                {selectedEntry.date && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">Date</p>
                    <p>{selectedEntry.date}</p>
                  </div>
                )}
                {selectedEntry.description && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">Notes</p>
                    <p className="text-foreground/80">{selectedEntry.description}</p>
                  </div>
                )}
                {selectedEntry.extra && Object.keys(selectedEntry.extra).length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-2">Details</p>
                    <div className="space-y-1">
                      {Object.entries(selectedEntry.extra).filter(([k]) => !['fileUrl','storedName','contentType'].includes(k)).map(([k, v]) => (
                        v ? <p key={k} className="text-sm"><span className="font-medium capitalize">{k}:</span> {v}</p> : null
                      ))}
                    </div>
                  </div>
                )}
                {/* File preview for uploaded documents */}
                {selectedEntry.extra?.fileUrl && selectedEntry.extra?.storedName && (() => {
                  const storedName = selectedEntry.extra!.storedName;
                  const isImage = /\.(jpg|jpeg|png|gif|webp|bmp|tiff|tif|svg)$/i.test(storedName);
                  const isPdf   = /\.pdf$/i.test(storedName);
                  return (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-muted-foreground">Attached File</p>
                      {!ehrDocUrl && (
                        <div className="flex items-center justify-center h-16 text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" />
                        </div>
                      )}
                      {ehrDocUrl && isImage && (
                        <img src={ehrDocUrl} alt={selectedEntry.title} className="w-full rounded-lg border object-contain max-h-64" />
                      )}
                      {ehrDocUrl && isPdf && (
                        <embed src={ehrDocUrl} type="application/pdf" className="w-full h-64 rounded-lg border" />
                      )}
                      {ehrDocUrl && (
                        <a href={ehrDocUrl} target="_blank" rel="noopener noreferrer" download={storedName}>
                          <Button size="sm" variant="outline" className="w-full">
                            <Download className="h-4 w-4 mr-2" /> Download File
                          </Button>
                        </a>
                      )}
                    </div>
                  );
                })()}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground/70">
                <FileText className="h-12 w-12 mx-auto mb-2 opacity-40" />
                <p>Select a record to view details</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Security notice */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-5">
          <div className="flex gap-3">
            <Lock className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-blue-800">
              <span className="font-medium">Your data is secure.</span> All health records are encrypted and stored securely. You have full control over who can access your medical information.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Upload Record Dialog */}
      <Dialog open={showUpload} onOpenChange={(open) => {
        if (!open && filePreviewUrl) { URL.revokeObjectURL(filePreviewUrl); setFilePreviewUrl(null); }
        setShowUpload(open);
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Health Record</DialogTitle>
            <DialogDescription>Enter details manually or upload a PDF / image file.</DialogDescription>
          </DialogHeader>

          <Tabs value={uploadTab} onValueChange={v => setUploadTab(v as 'form' | 'file')}>
            <TabsList className="w-full">
              <TabsTrigger value="form" className="flex-1 flex items-center gap-2">
                <FileText className="h-4 w-4" /> Manual Entry
              </TabsTrigger>
              <TabsTrigger value="file" className="flex-1 flex items-center gap-2">
                <Upload className="h-4 w-4" /> Upload File
              </TabsTrigger>
            </TabsList>

            {/* ── Manual entry ── */}
            <TabsContent value="form" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Record Type *</Label>
                <Select value={form.section} onValueChange={v => setForm(f => ({ ...f, section: v as RecordSection }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="diagnoses">Diagnosis</SelectItem>
                    <SelectItem value="medications">Medication</SelectItem>
                    <SelectItem value="allergies">Allergy</SelectItem>
                    <SelectItem value="immunizations">Vaccination</SelectItem>
                    <SelectItem value="labResults">Lab Result</SelectItem>
                    <SelectItem value="documents">Document / Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{form.section === 'allergies' ? 'Allergen Name' : form.section === 'immunizations' ? 'Vaccine Name' : form.section === 'labResults' ? 'Test Name' : 'Title'} *</Label>
                <Input placeholder={
                  form.section === 'diagnoses' ? 'e.g. Hypertension' :
                  form.section === 'medications' ? 'e.g. Amoxicillin 500mg' :
                  form.section === 'allergies' ? 'e.g. Penicillin' :
                  form.section === 'immunizations' ? 'e.g. COVID-19 Vaccine' :
                  form.section === 'labResults' ? 'e.g. Complete Blood Count' : 'e.g. Discharge Summary'
                } value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Date</Label>
                <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Notes / Description</Label>
                <Textarea placeholder="Any additional notes..." rows={3}
                  value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              {form.section === 'medications' && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Extra fields (one per line: key: value)</Label>
                  <Textarea placeholder={'dosage: 500mg\nfrequency: Twice daily\nduration: 7 days'} rows={3}
                    value={form.extra} onChange={e => setForm(f => ({ ...f, extra: e.target.value }))} />
                </div>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowUpload(false)}>Cancel</Button>
                <Button onClick={handleUpload} disabled={saving}>
                  {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</> : 'Save Record'}
                </Button>
              </DialogFooter>
            </TabsContent>

            {/* ── File upload ── */}
            <TabsContent value="file" className="space-y-4 mt-4">
              {/* Drop zone */}
              <div
                className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary/70 transition-colors cursor-pointer relative"
                onClick={() => document.getElementById('ehr-file-input')?.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={e => {
                  e.preventDefault();
                  const file = e.dataTransfer.files[0];
                  if (file) {
                    const fakeEvent = { target: { files: e.dataTransfer.files } } as unknown as React.ChangeEvent<HTMLInputElement>;
                    handleFileSelect(fakeEvent);
                  }
                }}
              >
                <input id="ehr-file-input" type="file" className="hidden"
                  accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.bmp,.tiff,.tif,.svg"
                  onChange={handleFileSelect} />
                {selectedFile ? (
                  <div className="space-y-2">
                    {filePreviewUrl && selectedFile.type.startsWith('image/') ? (
                      <img src={filePreviewUrl} alt="preview" className="max-h-40 mx-auto rounded object-contain" />
                    ) : (
                      <div className="h-16 w-16 bg-red-100 rounded-lg flex items-center justify-center mx-auto">
                        <FileText className="h-8 w-8 text-red-600" />
                      </div>
                    )}
                    <p className="font-medium text-sm truncate">{selectedFile.name}</p>
                    <p className="text-xs text-muted-foreground">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                    <button type="button" className="text-xs text-red-500 hover:underline flex items-center gap-1 mx-auto"
                      onClick={e => { e.stopPropagation(); setSelectedFile(null); if (filePreviewUrl) { URL.revokeObjectURL(filePreviewUrl); setFilePreviewUrl(null); } }}>
                      <XIcon className="h-3 w-3" /> Remove
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="h-14 w-14 bg-muted rounded-full flex items-center justify-center mx-auto mb-3">
                      <Image className="h-7 w-7 text-muted-foreground/70" />
                    </div>
                    <p className="font-medium text-foreground/80">Click or drag a file here</p>
                    <p className="text-xs text-muted-foreground/70 mt-1">PDF, JPG, PNG, GIF, WEBP, BMP, TIFF, SVG — max 10 MB</p>
                  </>
                )}
              </div>

              <div className="space-y-2">
                <Label>Title</Label>
                <Input placeholder="e.g. X-Ray Report, Blood Test Results"
                  value={fileTitle} onChange={e => setFileTitle(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Date</Label>
                <Input type="date" value={fileDate} onChange={e => setFileDate(e.target.value)} />
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setShowUpload(false)}>Cancel</Button>
                <Button onClick={handleFileUpload} disabled={saving || !selectedFile}>
                  {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Uploading...</> : <><Upload className="h-4 w-4 mr-2" />Upload File</>}
                </Button>
              </DialogFooter>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
};
