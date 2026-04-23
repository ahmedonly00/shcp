import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/app/components/ui/dialog";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/app/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs";
import {
  Package, Truck, Users, RefreshCw, CheckCircle, Clock, AlertTriangle, FlaskConical, Trash2,
} from "lucide-react";
import * as api from "@/app/api/pharmacist";

// ── Status badge helper ────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  PENDING:            "bg-yellow-100 text-yellow-800",
  PROCESSING:         "bg-blue-100 text-blue-800",
  READY_FOR_DELIVERY: "bg-purple-100 text-purple-800",
  PICKED_UP:          "bg-indigo-100 text-indigo-800",
  ON_THE_WAY:         "bg-cyan-100 text-cyan-800",
  DELIVERED:          "bg-green-100 text-green-800",
  FAILED:             "bg-red-100 text-red-800",
  CANCELLED:          "bg-muted text-foreground",
  ASSIGNED:           "bg-orange-100 text-orange-800",
  ACCEPTED:           "bg-teal-100 text-teal-800",
  DECLINED:           "bg-red-100 text-red-800",
  AVAILABLE:          "bg-green-100 text-green-800",
  ON_DELIVERY:        "bg-orange-100 text-orange-800",
  OFFLINE:            "bg-muted text-muted-foreground",
};

const StatusBadge = ({ status }: { status: string }) => (
  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[status] ?? "bg-muted text-foreground/80"}`}>
    {status.replace(/_/g, " ")}
  </span>
);

// ── Sub-components ─────────────────────────────────────────────────────────

function PrescriptionsTab() {
  const [prescriptions, setPrescriptions] = useState<api.PrescriptionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<api.PrescriptionRow | null>(null);
  const [assigningId, setAssigningId] = useState<string>("");
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [suggestedBikers, setSuggestedBikers] = useState<api.BikerDto[]>([]);
  const [loadingBikers, setLoadingBikers] = useState(false);

  const load = () => {
    setLoading(true);
    api.getPharmacistPrescriptions()
      .then(setPrescriptions)
      .catch(() => toast.error("Failed to load prescriptions"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openAssignDialog = (rx: api.PrescriptionRow) => {
    setSelected(rx);
    setAssigningId("");
    setAssignDialogOpen(true);
    setLoadingBikers(true);
    // Fetch zone-ranked available bikers for this specific prescription
    api.getSuggestedBikers(rx.prescriptionId)
      .then(setSuggestedBikers)
      .catch(() => toast.error("Failed to load available bikers"))
      .finally(() => setLoadingBikers(false));
  };

  const handleMarkProcessing = async (id: string) => {
    try {
      const updated = await api.markProcessing(id);
      setPrescriptions(ps => ps.map(p => p.prescriptionId === id ? { ...p, status: updated.status } : p));
      toast.success("Marked as Processing");
    } catch { toast.error("Failed to update status"); }
  };

  const handleMarkReady = async (id: string) => {
    try {
      const updated = await api.markReady(id);
      setPrescriptions(ps => ps.map(p => p.prescriptionId === id ? { ...p, status: updated.status } : p));
      toast.success("Marked as Ready for Delivery");
    } catch { toast.error("Failed to update status"); }
  };

  const handleAssign = async () => {
    if (!selected || !assigningId) return;
    try {
      await api.assignBiker(selected.prescriptionId, assigningId);
      toast.success("Biker assigned successfully");
      setAssignDialogOpen(false);
      setAssigningId("");
      load();
    } catch { toast.error("Failed to assign biker"); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-foreground/80">Incoming Prescriptions</h3>
        <Button variant="outline" size="sm" onClick={load}>
          <RefreshCw className="h-4 w-4 mr-1" /> Refresh
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Loading prescriptions…</div>
      ) : prescriptions.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground/70">No prescriptions assigned to your pharmacy yet.</div>
      ) : (
        <div className="space-y-3">
          {prescriptions.map(rx => (
            <Card key={rx.prescriptionId} className="border border-border hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-foreground">{rx.patientName}</span>
                      <StatusBadge status={rx.status} />
                    </div>
                    <p className="text-sm text-muted-foreground">Prescribed by Dr. {rx.providerName}</p>
                    {rx.deliveryAddress && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Deliver to: {rx.deliveryAddress}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground/70 mt-1">
                      Issued: {new Date(rx.issuedAt).toLocaleDateString()} · Valid until: {rx.validUntil}
                    </p>
                  </div>

                  <div className="flex flex-col gap-2 shrink-0">
                    {rx.status === "PENDING" && (
                      <Button size="sm" variant="outline" onClick={() => handleMarkProcessing(rx.prescriptionId)}>
                        <Clock className="h-3.5 w-3.5 mr-1" /> Start Processing
                      </Button>
                    )}
                    {rx.status === "PROCESSING" && (
                      <Button size="sm" variant="outline" onClick={() => handleMarkReady(rx.prescriptionId)}>
                        <CheckCircle className="h-3.5 w-3.5 mr-1" /> Mark Ready
                      </Button>
                    )}
                    {rx.status === "READY_FOR_DELIVERY" && (
                      <Button size="sm" className="bg-primary hover:bg-primary/90 text-white"
                              onClick={() => openAssignDialog(rx)}>
                        <Truck className="h-3.5 w-3.5 mr-1" /> Assign Biker
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Assign biker dialog — rendered once, outside the list */}
      <Dialog open={assignDialogOpen} onOpenChange={open => { setAssignDialogOpen(open); if (!open) setSelected(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Biker{selected ? ` for ${selected.patientName}` : ""}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {loadingBikers ? (
              <div className="text-center py-4 text-muted-foreground text-sm">Loading available bikers…</div>
            ) : suggestedBikers.length === 0 ? (
              <div className="flex items-center gap-2 text-amber-600">
                <AlertTriangle className="h-4 w-4" />
                <p className="text-sm">No available bikers at the moment.</p>
              </div>
            ) : (
              <>
                <div>
                  <Label>Select Biker <span className="text-xs text-muted-foreground/70 font-normal ml-1">(sorted by zone match)</span></Label>
                </div>
                <Select value={assigningId} onValueChange={setAssigningId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a biker…" />
                  </SelectTrigger>
                  <SelectContent>
                    {suggestedBikers.map((b, idx) => (
                      <SelectItem key={b.userId} value={b.userId}>
                        {idx === 0 && suggestedBikers.length > 1 ? "★ " : ""}{b.name} · {b.vehicleType}
                        {b.operatingZone ? ` · ${b.operatingZone}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button className="w-full bg-primary hover:bg-primary/90 text-white"
                        onClick={handleAssign} disabled={!assigningId}>
                  Confirm Assignment
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DeliveriesTab() {
  const [deliveries, setDeliveries] = useState<api.DeliveryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [bikers, setBikers] = useState<api.BikerDto[]>([]);
  const [reassignId, setReassignId] = useState("");
  const [reassignDelivery, setReassignDelivery] = useState<api.DeliveryDto | null>(null);

  const load = () => {
    setLoading(true);
    Promise.all([api.getPharmacistDeliveries(), api.getMyBikers()])
      .then(([d, b]) => { setDeliveries(d); setBikers(b); })
      .catch(() => toast.error("Failed to load deliveries"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleReassign = async () => {
    if (!reassignDelivery || !reassignId) return;
    try {
      await api.reassignBiker(reassignDelivery.deliveryId, reassignId);
      toast.success("Biker reassigned");
      setReassignDelivery(null);
      setReassignId("");
      load();
    } catch { toast.error("Failed to reassign biker"); }
  };

  const availableBikers = bikers.filter(b => b.status === "AVAILABLE");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-foreground/80">Delivery Tracking</h3>
        <Button variant="outline" size="sm" onClick={load}>
          <RefreshCw className="h-4 w-4 mr-1" /> Refresh
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Loading deliveries…</div>
      ) : deliveries.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground/70">No deliveries yet.</div>
      ) : (
        <div className="space-y-3">
          {deliveries.map(d => (
            <Card key={d.deliveryId} className="border border-border">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <StatusBadge status={d.status} />
                      <span className="text-sm text-muted-foreground">
                        Biker: {d.bikerName ?? "Unassigned"}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground/70">
                      Assigned: {d.assignedAt ? new Date(d.assignedAt).toLocaleString() : "—"}
                    </p>
                    {d.deliveredAt && (
                      <p className="text-xs text-green-600">
                        Delivered: {new Date(d.deliveredAt).toLocaleString()}
                      </p>
                    )}
                    {d.failureReason && (
                      <p className="text-xs text-red-600">Reason: {d.failureReason}</p>
                    )}
                  </div>

                  {(d.status === "DECLINED" || d.status === "FAILED") && (
                    <Dialog open={reassignDelivery?.deliveryId === d.deliveryId}
                            onOpenChange={open => { if (open) setReassignDelivery(d); else setReassignDelivery(null); }}>
                      <DialogTrigger asChild>
                        <Button size="sm" variant="outline">
                          <RefreshCw className="h-3.5 w-3.5 mr-1" /> Reassign
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader><DialogTitle>Reassign Delivery</DialogTitle></DialogHeader>
                        <div className="space-y-4 py-2">
                          {availableBikers.length === 0 ? (
                            <p className="text-sm text-amber-600">No available bikers.</p>
                          ) : (
                            <>
                              <Select value={reassignId} onValueChange={setReassignId}>
                                <SelectTrigger><SelectValue placeholder="Choose a biker…" /></SelectTrigger>
                                <SelectContent>
                                  {availableBikers.map(b => (
                                    <SelectItem key={b.userId} value={b.userId}>
                                      {b.name} · {b.vehicleType}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Button className="w-full bg-primary text-white"
                                      onClick={handleReassign} disabled={!reassignId}>
                                Confirm Reassignment
                              </Button>
                            </>
                          )}
                        </div>
                      </DialogContent>
                    </Dialog>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function BikersTab() {
  const [bikers, setBikers] = useState<api.BikerDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", vehicleType: "", licenseNumber: "", operatingZone: "" });
  const [createdCredentials, setCreatedCredentials] = useState<{ name: string; email: string; tempPassword: string } | null>(null);

  const load = () => {
    setLoading(true);
    api.getMyBikers()
      .then(setBikers)
      .catch(() => toast.error("Failed to load bikers"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const created = await api.registerBiker(form);
      setAddOpen(false);
      setForm({ name: "", email: "", phone: "", vehicleType: "", licenseNumber: "", operatingZone: "" });
      load();
      if (created.tempPassword) {
        setCreatedCredentials({ name: created.name, email: created.email, tempPassword: created.tempPassword });
      } else {
        toast.success("Biker registered. Credentials sent via email.");
      }
    } catch { toast.error("Failed to register biker"); }
  };

  const handleToggle = async (biker: api.BikerDto) => {
    try {
      const updated = biker.status === "OFFLINE"
        ? await api.activateBiker(biker.userId)
        : await api.deactivateBiker(biker.userId);
      setBikers(bs => bs.map(b => b.userId === biker.userId ? updated : b));
      toast.success(`Biker ${updated.status === "OFFLINE" ? "deactivated" : "activated"}`);
    } catch { toast.error("Failed to update biker status"); }
  };

  return (
    <div className="space-y-4">
      {/* Credentials dialog shown after successful biker registration */}
      <Dialog open={!!createdCredentials} onOpenChange={() => setCreatedCredentials(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Biker Account Created</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Account created for <strong>{createdCredentials?.name}</strong>. Share these credentials with the biker.
            </p>
            <div className="rounded-md bg-muted/50 border p-3 font-mono text-sm space-y-1">
              <div><span className="text-muted-foreground">Email:</span> {createdCredentials?.email}</div>
              <div><span className="text-muted-foreground">Password:</span> {createdCredentials?.tempPassword}</div>
            </div>
            <p className="text-xs text-amber-600 font-medium">Copy these now — the password will not be shown again.</p>
            <Button
              className="w-full"
              variant="outline"
              onClick={() => {
                navigator.clipboard.writeText(
                  `Email: ${createdCredentials?.email}\nPassword: ${createdCredentials?.tempPassword}`
                );
                toast.success("Copied to clipboard");
              }}
            >
              Copy to Clipboard
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-foreground/80">Delivery Team</h3>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="bg-primary hover:bg-primary/90 text-white">
              + Add Biker
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Register New Biker</DialogTitle></DialogHeader>
            <form onSubmit={handleAdd} className="space-y-3 py-2">
              {(["name", "email", "phone", "vehicleType", "licenseNumber", "operatingZone"] as const).map(field => (
                <div key={field}>
                  <Label className="capitalize">{field.replace(/([A-Z])/g, " $1")}</Label>
                  <Input
                    required={["name", "email", "phone", "vehicleType"].includes(field)}
                    value={form[field]}
                    onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
                    placeholder={`Enter ${field.replace(/([A-Z])/g, " $1").toLowerCase()}`}
                  />
                </div>
              ))}
              <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-white">
                Register Biker
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Loading team…</div>
      ) : bikers.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground/70">No bikers registered yet. Add your first biker above.</div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {bikers.map(b => (
            <Card key={b.userId} className="border border-border">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-foreground">{b.name}</p>
                    <p className="text-xs text-muted-foreground">{b.email}</p>
                    <p className="text-xs text-muted-foreground">{b.phone}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <StatusBadge status={b.status} />
                      <span className="text-xs text-muted-foreground/70">{b.vehicleType}</span>
                    </div>
                    {b.operatingZone && (
                      <p className="text-xs text-muted-foreground/70 mt-0.5">Zone: {b.operatingZone}</p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className={b.status === "OFFLINE" ? "border-green-500 text-green-600" : "border-red-400 text-red-500"}
                    onClick={() => handleToggle(b)}
                    disabled={b.status === "ON_DELIVERY"}
                  >
                    {b.status === "OFFLINE" ? "Activate" : "Deactivate"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Inventory Tab ──────────────────────────────────────────────────────────

function InventoryTab() {
  const [items, setItems] = useState<api.InventoryItemDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState<api.StockUpdateRequest>({
    medicationName: "", genericName: "", quantityInStock: 0,
    unit: "units", expiryDate: "", reorderLevel: 10,
  });

  const load = () => {
    setLoading(true);
    api.getMyInventory()
      .then(setItems)
      .catch(() => toast.error("Failed to load inventory"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleUpsert = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.upsertStock(form);
      toast.success(`Stock updated for "${form.medicationName}"`);
      setAddOpen(false);
      setForm({ medicationName: "", genericName: "", quantityInStock: 0, unit: "units", expiryDate: "", reorderLevel: 10 });
      load();
    } catch { toast.error("Failed to update stock"); }
  };

  const handleDelete = async (id: string, name: string) => {
    try {
      await api.deleteInventoryItem(id);
      toast.success(`"${name}" removed from inventory`);
      load();
    } catch { toast.error("Failed to delete item"); }
  };

  const lowStockCount = items.filter(i => i.lowStock).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="font-semibold text-foreground/80">Medication Inventory</h3>
          {lowStockCount > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">
              <AlertTriangle className="h-3 w-3" /> {lowStockCount} low stock
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load}>
            <RefreshCw className="h-4 w-4 mr-1" /> Refresh
          </Button>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-primary hover:bg-primary/90 text-white">
                + Add / Update Stock
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>Update Stock</DialogTitle></DialogHeader>
              <form onSubmit={handleUpsert} className="space-y-3 py-2">
                <div>
                  <Label>Medication Name *</Label>
                  <Input required value={form.medicationName}
                    onChange={e => setForm(f => ({ ...f, medicationName: e.target.value }))}
                    placeholder="e.g. Amoxicillin 500mg" />
                </div>
                <div>
                  <Label>Generic Name</Label>
                  <Input value={form.genericName ?? ""}
                    onChange={e => setForm(f => ({ ...f, genericName: e.target.value }))}
                    placeholder="e.g. amoxicillin" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Quantity in Stock *</Label>
                    <Input type="number" min={0} required value={form.quantityInStock}
                      onChange={e => setForm(f => ({ ...f, quantityInStock: Number(e.target.value) }))} />
                  </div>
                  <div>
                    <Label>Unit</Label>
                    <Input value={form.unit ?? "units"}
                      onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
                      placeholder="tablets, vials…" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Reorder Level</Label>
                    <Input type="number" min={0} value={form.reorderLevel ?? 10}
                      onChange={e => setForm(f => ({ ...f, reorderLevel: Number(e.target.value) }))} />
                  </div>
                  <div>
                    <Label>Expiry Date</Label>
                    <Input type="date" value={form.expiryDate ?? ""}
                      onChange={e => setForm(f => ({ ...f, expiryDate: e.target.value }))} />
                  </div>
                </div>
                <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-white">
                  Save Stock
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Loading inventory…</div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground/70">
          No medications in inventory yet. Add your first item above.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground uppercase tracking-wide">
                <th className="pb-2 pr-4">Medication</th>
                <th className="pb-2 pr-4">Generic</th>
                <th className="pb-2 pr-4 text-right">Qty</th>
                <th className="pb-2 pr-4">Unit</th>
                <th className="pb-2 pr-4">Expiry</th>
                <th className="pb-2 pr-4">Status</th>
                <th className="pb-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map(item => (
                <tr key={item.inventoryId} className={item.lowStock ? "bg-red-50" : ""}>
                  <td className="py-2 pr-4 font-medium text-foreground">{item.medicationName}</td>
                  <td className="py-2 pr-4 text-muted-foreground">{item.genericName ?? "—"}</td>
                  <td className="py-2 pr-4 text-right font-mono">{item.quantityInStock}</td>
                  <td className="py-2 pr-4 text-muted-foreground">{item.unit}</td>
                  <td className="py-2 pr-4 text-muted-foreground">{item.expiryDate ?? "—"}</td>
                  <td className="py-2 pr-4">
                    {item.lowStock ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">
                        <AlertTriangle className="h-3 w-3" /> Low stock
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
                        OK
                      </span>
                    )}
                  </td>
                  <td className="py-2">
                    <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-700 h-7 w-7 p-0"
                            onClick={() => handleDelete(item.inventoryId, item.medicationName)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

export const PharmacistDashboard: React.FC = () => {
  const [bikers, setBikers] = useState<api.BikerDto[]>([]);

  useEffect(() => {
    api.getMyBikers().then(setBikers).catch(() => {});
  }, []);

  const stats = [
    { label: "Total Bikers", value: bikers.length, icon: <Users className="h-5 w-5 text-primary" /> },
    { label: "Available Bikers", value: bikers.filter(b => b.status === "AVAILABLE").length, icon: <CheckCircle className="h-5 w-5 text-green-600" /> },
    { label: "On Delivery", value: bikers.filter(b => b.status === "ON_DELIVERY").length, icon: <Truck className="h-5 w-5 text-orange-500" /> },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-primary">Pharmacist Dashboard</h2>
        <p className="text-muted-foreground text-sm mt-1">Manage prescriptions, track deliveries, and coordinate your biker team.</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        {stats.map(s => (
          <Card key={s.label} className="border border-border">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center">
                {s.icon}
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="prescriptions">
        <TabsList className="mb-4">
          <TabsTrigger value="prescriptions">
            <Package className="h-4 w-4 mr-1.5" /> Prescriptions
          </TabsTrigger>
          <TabsTrigger value="deliveries">
            <Truck className="h-4 w-4 mr-1.5" /> Deliveries
          </TabsTrigger>
          <TabsTrigger value="inventory">
            <FlaskConical className="h-4 w-4 mr-1.5" /> Inventory
          </TabsTrigger>
          <TabsTrigger value="bikers">
            <Users className="h-4 w-4 mr-1.5" /> Manage Bikers
          </TabsTrigger>
        </TabsList>

        <TabsContent value="prescriptions">
          <PrescriptionsTab />
        </TabsContent>
        <TabsContent value="deliveries">
          <DeliveriesTab />
        </TabsContent>
        <TabsContent value="inventory">
          <InventoryTab />
        </TabsContent>
        <TabsContent value="bikers">
          <BikersTab />
        </TabsContent>
      </Tabs>
    </div>
  );
};
