import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LocationPicker } from '@/app/components/ui/LocationPicker';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Loader2, RefreshCw, Building2, UserPlus, ChevronDown, ChevronUp } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/app/components/ui/dialog';
import {
  listPharmacies, createPharmacy, updatePharmacy,
  activatePharmacy, deactivatePharmacy,
  PharmacyDto, PharmacyPayload,
  getPharmacyPharmacists, addPharmacistToPharmacy, PharmacistProfileDto,
} from '@/app/api/pharmacist';
import { toast } from 'sonner';

export const PharmacyManagement: React.FC = () => {
  const { t } = useTranslation();

  // ── Pharmacy state ────────────────────────────────────────────────────────
  const [pharmacies, setPharmacies] = useState<PharmacyDto[]>([]);
  const [loadingPharmacies, setLoadingPharmacies] = useState(false);
  const [pharmacyDialogOpen, setPharmacyDialogOpen] = useState(false);
  const [editingPharmacy, setEditingPharmacy] = useState<PharmacyDto | null>(null);
  const [pharmacyForm, setPharmacyForm] = useState<PharmacyPayload>({
    name: '', address: '', district: '', sector: '', cell: '', phone: '', email: '',
    latitude: undefined, longitude: undefined,
  });

  // ── Pharmacist state ──────────────────────────────────────────────────────
  const [expandedPharmacy, setExpandedPharmacy] = useState<string | null>(null);
  const [pharmacistsMap, setPharmacistsMap] = useState<Record<string, PharmacistProfileDto[]>>({});
  const [loadingPharmacists, setLoadingPharmacists] = useState<string | null>(null);
  const [pharmacistDialogOpen, setPharmacistDialogOpen] = useState(false);
  const [pharmacistTargetId, setPharmacistTargetId] = useState<string | null>(null);
  const [pharmacistForm, setPharmacistForm] = useState({ name: '', email: '', phone: '' });
  const [savingPharmacist, setSavingPharmacist] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState<{ name: string; email: string; tempPassword: string } | null>(null);

  // ── Pharmacy handlers ─────────────────────────────────────────────────────
  const loadPharmacies = () => {
    setLoadingPharmacies(true);
    listPharmacies()
      .then(setPharmacies)
      .catch(() => toast.error(t('pharmacyManagement.toastFailedPharmacies')))
      .finally(() => setLoadingPharmacies(false));
  };

  useEffect(() => { loadPharmacies(); }, []);

  const openAddPharmacy = () => {
    setEditingPharmacy(null);
    setPharmacyForm({ name: '', address: '', district: '', sector: '', cell: '', phone: '', email: '', latitude: undefined, longitude: undefined });
    setPharmacyDialogOpen(true);
  };

  const openEditPharmacy = (p: PharmacyDto) => {
    setEditingPharmacy(p);
    setPharmacyForm({
      name: p.name, address: p.address,
      district: p.district ?? '', sector: p.sector ?? '', cell: p.cell ?? '',
      latitude: p.latitude ?? undefined, longitude: p.longitude ?? undefined,
      phone: p.phone ?? '', email: p.email ?? '',
    });
    setPharmacyDialogOpen(true);
  };

  const handleSavePharmacy = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingPharmacy) {
        const updated = await updatePharmacy(editingPharmacy.pharmacyId, pharmacyForm);
        setPharmacies(ps => ps.map(p => p.pharmacyId === updated.pharmacyId ? updated : p));
        toast.success(t('pharmacyManagement.toastPharmacyUpdated'));
      } else {
        const created = await createPharmacy(pharmacyForm);
        setPharmacies(ps => [...ps, created]);
        toast.success(t('pharmacyManagement.toastPharmacyRegistered'));
      }
      setPharmacyDialogOpen(false);
    } catch { toast.error(t('pharmacyManagement.toastFailedSave')); }
  };

  const handleTogglePharmacy = async (p: PharmacyDto) => {
    try {
      if (p.isActive) {
        await deactivatePharmacy(p.pharmacyId);
        setPharmacies(ps => ps.map(x => x.pharmacyId === p.pharmacyId ? { ...x, isActive: false } : x));
        toast.success(t('pharmacyManagement.toastPharmacyDeactivated'));
      } else {
        await activatePharmacy(p.pharmacyId);
        setPharmacies(ps => ps.map(x => x.pharmacyId === p.pharmacyId ? { ...x, isActive: true } : x));
        toast.success(t('pharmacyManagement.toastPharmacyActivated'));
      }
    } catch { toast.error(t('pharmacyManagement.toastFailedToggle')); }
  };

  // ── Pharmacist handlers ───────────────────────────────────────────────────
  const togglePharmacistList = async (pharmacyId: string) => {
    if (expandedPharmacy === pharmacyId) { setExpandedPharmacy(null); return; }
    setExpandedPharmacy(pharmacyId);
    if (pharmacistsMap[pharmacyId]) return;
    setLoadingPharmacists(pharmacyId);
    try {
      const list = await getPharmacyPharmacists(pharmacyId);
      setPharmacistsMap(m => ({ ...m, [pharmacyId]: list }));
    } catch { toast.error(t('pharmacyManagement.toastFailedPharmacists')); }
    finally { setLoadingPharmacists(null); }
  };

  const openAddPharmacist = (pharmacyId: string) => {
    setPharmacistTargetId(pharmacyId);
    setPharmacistForm({ name: '', email: '', phone: '' });
    setPharmacistDialogOpen(true);
  };

  const handleSavePharmacist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pharmacistTargetId) return;
    setSavingPharmacist(true);
    try {
      const created = await addPharmacistToPharmacy(pharmacistTargetId, pharmacistForm);
      setPharmacistsMap(m => ({
        ...m,
        [pharmacistTargetId]: [...(m[pharmacistTargetId] ?? []), created],
      }));
      setPharmacistDialogOpen(false);
      if (created.tempPassword) {
        setCreatedCredentials({ name: created.name, email: created.email, tempPassword: created.tempPassword });
      } else {
        toast.success(t('pharmacyManagement.toastPharmacistCreated'));
      }
    } catch { toast.error(t('pharmacyManagement.toastFailedAddPharmacist')); }
    finally { setSavingPharmacist(false); }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold">{t('pharmacyManagement.title')}</h2>
          <p className="text-muted-foreground">{t('pharmacyManagement.subtitle')}</p>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base font-semibold">{t('pharmacyManagement.registeredPharmacies')}</CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={loadPharmacies}>
              <RefreshCw className="h-4 w-4 mr-1" /> {t('common.refresh')}
            </Button>
            <Button size="sm" className="bg-primary hover:bg-primary/90 text-white"
                    onClick={openAddPharmacy}>
              + {t('pharmacyManagement.addPharmacy')}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loadingPharmacies ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground/70">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> {t('pharmacyManagement.loadingPharmacies')}
            </div>
          ) : pharmacies.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground/70">
              <Building2 className="h-10 w-10 mx-auto mb-3 text-muted-foreground/70" />
              <p>{t('pharmacyManagement.noPharmacies')}</p>
              <p className="text-sm mt-1">{t('pharmacyManagement.noPharmaciesHint')}</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {pharmacies.map(p => (
                <div key={p.pharmacyId} className="py-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">{p.name}</span>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          p.isActive ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'
                        }`}>
                          {p.isActive ? t('pharmacyManagement.active') : t('pharmacyManagement.inactive')}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">{p.address}</p>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5 text-xs text-muted-foreground/70">
                        {[p.district, p.sector, p.cell].filter(Boolean).length > 0 && (
                          <span className="text-blue-500 font-medium">
                            {[p.district, p.sector, p.cell].filter(Boolean).join(' › ')}
                          </span>
                        )}
                        {p.phone && <span>{p.phone}</span>}
                        {p.email && <span>{p.email}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4 shrink-0">
                      <Button
                        variant="outline" size="sm"
                        onClick={() => togglePharmacistList(p.pharmacyId)}
                        title={t('pharmacyManagement.pharmacists')}
                      >
                        <UserPlus className="h-3.5 w-3.5 mr-1" />
                        {t('pharmacyManagement.staff')}
                        {expandedPharmacy === p.pharmacyId
                          ? <ChevronUp className="h-3.5 w-3.5 ml-1" />
                          : <ChevronDown className="h-3.5 w-3.5 ml-1" />}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => openEditPharmacy(p)}>
                        {t('common.edit')}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className={p.isActive
                          ? 'border-red-300 text-red-500 hover:bg-red-50'
                          : 'border-green-400 text-green-600 hover:bg-green-50'}
                        onClick={() => handleTogglePharmacy(p)}
                      >
                        {p.isActive ? t('pharmacyManagement.deactivate') : t('pharmacyManagement.activate')}
                      </Button>
                    </div>
                  </div>

                  {/* Pharmacist sub-panel */}
                  {expandedPharmacy === p.pharmacyId && (
                    <div className="mt-3 ml-2 border-l-2 border-blue-100 pl-4">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                          {t('pharmacyManagement.pharmacists')}
                        </p>
                        <Button size="sm" variant="outline" className="h-7 text-xs"
                          onClick={() => openAddPharmacist(p.pharmacyId)}>
                          <UserPlus className="h-3 w-3 mr-1" /> {t('pharmacyManagement.addPharmacist')}
                        </Button>
                      </div>
                      {loadingPharmacists === p.pharmacyId ? (
                        <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground/70">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" /> {t('common.loading')}
                        </div>
                      ) : (pharmacistsMap[p.pharmacyId] ?? []).length === 0 ? (
                        <p className="text-xs text-muted-foreground/70 py-2 italic">
                          {t('pharmacyManagement.noPharmacists')}
                        </p>
                      ) : (
                        <div className="space-y-1">
                          {(pharmacistsMap[p.pharmacyId] ?? []).map(ph => (
                            <div key={ph.userId}
                              className="flex items-center justify-between px-3 py-2 bg-muted/50 rounded text-sm">
                              <div>
                                <span className="font-medium">{ph.name}</span>
                                <span className="text-muted-foreground/70 mx-1.5">·</span>
                                <span className="text-muted-foreground">{ph.email}</span>
                              </div>
                              <span className="text-xs text-muted-foreground/70">{ph.phone}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Credentials display dialog */}
      <Dialog open={!!createdCredentials} onOpenChange={() => setCreatedCredentials(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('pharmacyManagement.accountCreated')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              {t('pharmacyManagement.shareCredentials', { name: createdCredentials?.name })}
              {' '}
              {t('pharmacyManagement.changePasswordHint')}
            </p>
            <div className="bg-muted/50 rounded-lg p-4 space-y-2 font-mono text-sm border">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('common.email')}</span>
                <span className="font-semibold select-all">{createdCredentials?.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('pharmacyManagement.password')}</span>
                <span className="font-semibold select-all text-blue-700">{createdCredentials?.tempPassword}</span>
              </div>
            </div>
            <p className="text-xs text-amber-600">
              {t('pharmacyManagement.copyWarning')}
            </p>
            <Button className="w-full" onClick={() => {
              if (createdCredentials) {
                navigator.clipboard.writeText(
                  `Email: ${createdCredentials.email}\nPassword: ${createdCredentials.tempPassword}`
                );
                toast.success(t('pharmacyManagement.toastCredentialsCopied'));
              }
            }}>
              {t('pharmacyManagement.copyToClipboard')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Pharmacist dialog */}
      <Dialog open={pharmacistDialogOpen} onOpenChange={setPharmacistDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('pharmacyManagement.addPharmacist')}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSavePharmacist} className="space-y-3 py-2">
            <p className="text-xs text-muted-foreground">
              {t('pharmacyManagement.addPharmacistHint')}
            </p>
            <div>
              <Label>{t('auth.fullName')} <span className="text-red-500">*</span></Label>
              <Input required value={pharmacistForm.name}
                onChange={e => setPharmacistForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Jean Paul Habimana" />
            </div>
            <div>
              <Label>{t('common.email')} <span className="text-red-500">*</span></Label>
              <Input required type="email" value={pharmacistForm.email}
                onChange={e => setPharmacistForm(f => ({ ...f, email: e.target.value }))}
                placeholder="pharmacist@example.com" />
            </div>
            <div>
              <Label>{t('common.phone')} <span className="text-red-500">*</span></Label>
              <Input required value={pharmacistForm.phone}
                onChange={e => setPharmacistForm(f => ({ ...f, phone: e.target.value }))}
                placeholder="+250..." />
            </div>
            <Button type="submit" disabled={savingPharmacist}
              className="w-full bg-primary hover:bg-primary/90 text-white">
              {savingPharmacist
                ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                : <UserPlus className="h-4 w-4 mr-2" />}
              {t('pharmacyManagement.createAccount')}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add / Edit Pharmacy dialog */}
      <Dialog open={pharmacyDialogOpen} onOpenChange={setPharmacyDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingPharmacy ? t('pharmacyManagement.editPharmacy') : t('pharmacyManagement.registerPharmacy')}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSavePharmacy} className="space-y-3 py-2">
            <div>
              <Label>{t('common.name')} <span className="text-red-500">*</span></Label>
              <Input required value={pharmacyForm.name}
                onChange={e => setPharmacyForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Kigali Central Pharmacy" />
            </div>
            <div>
              <Label>{t('common.address')} <span className="text-red-500">*</span></Label>
              <Input required value={pharmacyForm.address}
                onChange={e => setPharmacyForm(f => ({ ...f, address: e.target.value }))}
                placeholder="Street / landmark" />
            </div>

            <div className="bg-blue-50 rounded-lg p-3 space-y-2">
              <p className="text-xs font-semibold text-blue-700 mb-1">
                {t('pharmacyManagement.locationLabel')}
              </p>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label className="text-xs">{t('pharmacyManagement.district')}</Label>
                  <Input value={pharmacyForm.district ?? ''}
                    onChange={e => setPharmacyForm(f => ({ ...f, district: e.target.value }))}
                    placeholder="e.g. Gasabo" />
                </div>
                <div>
                  <Label className="text-xs">{t('pharmacyManagement.sector')}</Label>
                  <Input value={pharmacyForm.sector ?? ''}
                    onChange={e => setPharmacyForm(f => ({ ...f, sector: e.target.value }))}
                    placeholder="e.g. Remera" />
                </div>
                <div>
                  <Label className="text-xs">{t('pharmacyManagement.cell')}</Label>
                  <Input value={pharmacyForm.cell ?? ''}
                    onChange={e => setPharmacyForm(f => ({ ...f, cell: e.target.value }))}
                    placeholder="e.g. Rukiri I" />
                </div>
              </div>
              <p className="text-xs text-blue-500">
                {t('pharmacyManagement.locationHint')}
              </p>
            </div>

            <div className="rounded-md border border-green-200 bg-green-50 p-3">
              <LocationPicker
                latitude={pharmacyForm.latitude}
                longitude={pharmacyForm.longitude}
                onSelect={(lat, lon) => setPharmacyForm(f => ({ ...f, latitude: lat, longitude: lon }))}
                searchHint={[pharmacyForm.name, pharmacyForm.address, pharmacyForm.district].filter(Boolean).join(', ')}
                label={t('pharmacyManagement.gpsLabel')}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">{t('common.phone')}</Label>
                <Input value={pharmacyForm.phone ?? ''}
                  onChange={e => setPharmacyForm(f => ({ ...f, phone: e.target.value }))}
                  placeholder="+250..." />
              </div>
              <div>
                <Label className="text-xs">{t('common.email')}</Label>
                <Input type="email" value={pharmacyForm.email ?? ''}
                  onChange={e => setPharmacyForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="pharmacy@..." />
              </div>
            </div>

            <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-white">
              {editingPharmacy ? t('pharmacyManagement.saveChanges') : t('pharmacyManagement.registerBtn')}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};
