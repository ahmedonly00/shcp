import React, { useEffect, useState } from 'react';
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
      .catch(() => toast.error('Failed to load pharmacies'))
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
        toast.success('Pharmacy updated');
      } else {
        const created = await createPharmacy(pharmacyForm);
        setPharmacies(ps => [...ps, created]);
        toast.success('Pharmacy registered');
      }
      setPharmacyDialogOpen(false);
    } catch { toast.error('Failed to save pharmacy'); }
  };

  const handleTogglePharmacy = async (p: PharmacyDto) => {
    try {
      if (p.isActive) {
        await deactivatePharmacy(p.pharmacyId);
        setPharmacies(ps => ps.map(x => x.pharmacyId === p.pharmacyId ? { ...x, isActive: false } : x));
        toast.success('Pharmacy deactivated');
      } else {
        await activatePharmacy(p.pharmacyId);
        setPharmacies(ps => ps.map(x => x.pharmacyId === p.pharmacyId ? { ...x, isActive: true } : x));
        toast.success('Pharmacy activated');
      }
    } catch { toast.error('Failed to update pharmacy'); }
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
    } catch { toast.error('Failed to load pharmacists'); }
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
        toast.success('Pharmacist account created — credentials sent via email');
      }
    } catch { toast.error('Failed to add pharmacist'); }
    finally { setSavingPharmacist(false); }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold">Pharmacy Management</h2>
          <p className="text-muted-foreground">Register and manage pharmacies and their staff accounts</p>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base font-semibold">Registered Pharmacies</CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={loadPharmacies}>
              <RefreshCw className="h-4 w-4 mr-1" /> Refresh
            </Button>
            <Button size="sm" className="bg-primary hover:bg-primary/90 text-white"
                    onClick={openAddPharmacy}>
              + Add Pharmacy
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loadingPharmacies ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground/70">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading pharmacies…
            </div>
          ) : pharmacies.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground/70">
              <Building2 className="h-10 w-10 mx-auto mb-3 text-muted-foreground/70" />
              <p>No pharmacies registered yet.</p>
              <p className="text-sm mt-1">Click <strong>+ Add Pharmacy</strong> to get started.</p>
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
                          {p.isActive ? 'Active' : 'Inactive'}
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
                        title="Manage pharmacists"
                      >
                        <UserPlus className="h-3.5 w-3.5 mr-1" />
                        Staff
                        {expandedPharmacy === p.pharmacyId
                          ? <ChevronUp className="h-3.5 w-3.5 ml-1" />
                          : <ChevronDown className="h-3.5 w-3.5 ml-1" />}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => openEditPharmacy(p)}>
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className={p.isActive
                          ? 'border-red-300 text-red-500 hover:bg-red-50'
                          : 'border-green-400 text-green-600 hover:bg-green-50'}
                        onClick={() => handleTogglePharmacy(p)}
                      >
                        {p.isActive ? 'Deactivate' : 'Activate'}
                      </Button>
                    </div>
                  </div>

                  {/* Pharmacist sub-panel */}
                  {expandedPharmacy === p.pharmacyId && (
                    <div className="mt-3 ml-2 border-l-2 border-blue-100 pl-4">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                          Pharmacists
                        </p>
                        <Button size="sm" variant="outline" className="h-7 text-xs"
                          onClick={() => openAddPharmacist(p.pharmacyId)}>
                          <UserPlus className="h-3 w-3 mr-1" /> Add Pharmacist
                        </Button>
                      </div>
                      {loadingPharmacists === p.pharmacyId ? (
                        <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground/70">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
                        </div>
                      ) : (pharmacistsMap[p.pharmacyId] ?? []).length === 0 ? (
                        <p className="text-xs text-muted-foreground/70 py-2 italic">
                          No pharmacists yet — click "Add Pharmacist" to create an account.
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

      {/* Credentials display dialog — shown after account creation */}
      <Dialog open={!!createdCredentials} onOpenChange={() => setCreatedCredentials(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Pharmacist Account Created</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Share these credentials with <strong>{createdCredentials?.name}</strong> so they can log in.
              They should change their password on first login.
            </p>
            <div className="bg-muted/50 rounded-lg p-4 space-y-2 font-mono text-sm border">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Email</span>
                <span className="font-semibold select-all">{createdCredentials?.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Password</span>
                <span className="font-semibold select-all text-blue-700">{createdCredentials?.tempPassword}</span>
              </div>
            </div>
            <p className="text-xs text-amber-600">
              Copy these now — the password will not be shown again.
            </p>
            <Button className="w-full" onClick={() => {
              if (createdCredentials) {
                navigator.clipboard.writeText(
                  `Email: ${createdCredentials.email}\nPassword: ${createdCredentials.tempPassword}`
                );
                toast.success('Credentials copied to clipboard');
              }
            }}>
              Copy to Clipboard
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Pharmacist dialog */}
      <Dialog open={pharmacistDialogOpen} onOpenChange={setPharmacistDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add Pharmacist</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSavePharmacist} className="space-y-3 py-2">
            <p className="text-xs text-muted-foreground">
              An account will be created with a temporary password sent via email.
            </p>
            <div>
              <Label>Full Name <span className="text-red-500">*</span></Label>
              <Input required value={pharmacistForm.name}
                onChange={e => setPharmacistForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Jean Paul Habimana" />
            </div>
            <div>
              <Label>Email <span className="text-red-500">*</span></Label>
              <Input required type="email" value={pharmacistForm.email}
                onChange={e => setPharmacistForm(f => ({ ...f, email: e.target.value }))}
                placeholder="pharmacist@example.com" />
            </div>
            <div>
              <Label>Phone <span className="text-red-500">*</span></Label>
              <Input required value={pharmacistForm.phone}
                onChange={e => setPharmacistForm(f => ({ ...f, phone: e.target.value }))}
                placeholder="+250..." />
            </div>
            <Button type="submit" disabled={savingPharmacist}
              className="w-full bg-primary hover:bg-primary/90 text-white">
              {savingPharmacist
                ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                : <UserPlus className="h-4 w-4 mr-2" />}
              Create Account & Send Credentials
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add / Edit Pharmacy dialog */}
      <Dialog open={pharmacyDialogOpen} onOpenChange={setPharmacyDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingPharmacy ? 'Edit Pharmacy' : 'Register New Pharmacy'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSavePharmacy} className="space-y-3 py-2">
            <div>
              <Label>Name <span className="text-red-500">*</span></Label>
              <Input required value={pharmacyForm.name}
                onChange={e => setPharmacyForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Kigali Central Pharmacy" />
            </div>
            <div>
              <Label>Address <span className="text-red-500">*</span></Label>
              <Input required value={pharmacyForm.address}
                onChange={e => setPharmacyForm(f => ({ ...f, address: e.target.value }))}
                placeholder="Street / landmark" />
            </div>

            <div className="bg-blue-50 rounded-lg p-3 space-y-2">
              <p className="text-xs font-semibold text-blue-700 mb-1">
                Location (used for nearest-pharmacy matching)
              </p>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label className="text-xs">District</Label>
                  <Input value={pharmacyForm.district ?? ''}
                    onChange={e => setPharmacyForm(f => ({ ...f, district: e.target.value }))}
                    placeholder="e.g. Gasabo" />
                </div>
                <div>
                  <Label className="text-xs">Sector</Label>
                  <Input value={pharmacyForm.sector ?? ''}
                    onChange={e => setPharmacyForm(f => ({ ...f, sector: e.target.value }))}
                    placeholder="e.g. Remera" />
                </div>
                <div>
                  <Label className="text-xs">Cell</Label>
                  <Input value={pharmacyForm.cell ?? ''}
                    onChange={e => setPharmacyForm(f => ({ ...f, cell: e.target.value }))}
                    placeholder="e.g. Rukiri I" />
                </div>
              </div>
              <p className="text-xs text-blue-500">
                More specific = higher priority when matching a patient's location.
              </p>
            </div>

            <div className="rounded-md border border-green-200 bg-green-50 p-3">
              <LocationPicker
                latitude={pharmacyForm.latitude}
                longitude={pharmacyForm.longitude}
                onSelect={(lat, lon) => setPharmacyForm(f => ({ ...f, latitude: lat, longitude: lon }))}
                searchHint={[pharmacyForm.name, pharmacyForm.address, pharmacyForm.district].filter(Boolean).join(', ')}
                label="GPS Location (optional — improves nearest-pharmacy matching)"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Phone</Label>
                <Input value={pharmacyForm.phone ?? ''}
                  onChange={e => setPharmacyForm(f => ({ ...f, phone: e.target.value }))}
                  placeholder="+250..." />
              </div>
              <div>
                <Label className="text-xs">Email</Label>
                <Input type="email" value={pharmacyForm.email ?? ''}
                  onChange={e => setPharmacyForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="pharmacy@..." />
              </div>
            </div>

            <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-white">
              {editingPharmacy ? 'Save Changes' : 'Register Pharmacy'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};
