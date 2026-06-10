import React, { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { Button } from "@/app/components/ui/button";
import { Card, CardContent } from "@/app/components/ui/card";
import { Badge } from "@/app/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/app/components/ui/dialog";
import { Textarea } from "@/app/components/ui/textarea";
import { Label } from "@/app/components/ui/label";
import { RefreshCw, MapPin, CheckCircle, XCircle, Camera, Bike, Navigation, Locate } from "lucide-react";
import * as api from "@/app/api/biker";

const STATUS_COLORS: Record<string, string> = {
  ASSIGNED:   "bg-yellow-100 text-yellow-800",
  ACCEPTED:   "bg-blue-100 text-blue-800",
  PICKED_UP:  "bg-indigo-100 text-indigo-800",
  ON_THE_WAY: "bg-cyan-100 text-cyan-800",
  DELIVERED:  "bg-green-100 text-green-800",
  DECLINED:   "bg-muted text-muted-foreground",
  FAILED:     "bg-red-100 text-red-800",
};

const StatusBadge = ({ status }: { status: string }) => (
  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[status] ?? "bg-muted text-foreground/80"}`}>
    {status.replace(/_/g, " ")}
  </span>
);

// ── OSM iframe helper ──────────────────────────────────────────────────────────

function OsmMap({ lat, lng, label }: { lat: number; lng: number; label?: string }) {
  const delta = 0.018; // ~2 km view
  const bbox = `${lng - delta},${lat - delta},${lng + delta},${lat + delta}`;
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lng}`;
  return (
    <div className="rounded-lg overflow-hidden border border-border bg-muted/50">
      {label && <p className="text-xs font-medium text-muted-foreground px-3 py-1.5 border-b border-border">{label}</p>}
      <iframe
        title={label ?? "map"}
        src={src}
        width="100%"
        height="220"
        style={{ border: 0, display: "block" }}
        loading="lazy"
      />
    </div>
  );
}

// ── Destination card (shown once delivery is accepted) ────────────────────────

function DestinationCard({
  deliveryId,
  address,
  lat,
  lng,
}: {
  deliveryId: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
}) {
  const { t } = useTranslation();
  const watchRef = useRef<number | null>(null);
  const lastSentRef = useRef<number>(0);
  const INTERVAL_MS = 20_000; // push every 20 s

  // Start browser geolocation and push coordinates to backend
  useEffect(() => {
    if (!navigator.geolocation) return;
    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const now = Date.now();
        if (now - lastSentRef.current < INTERVAL_MS) return;
        lastSentRef.current = now;
        api.updateLocation(deliveryId, pos.coords.latitude, pos.coords.longitude)
          .catch(() => { /* silent — GPS update failure must not disrupt workflow */ });
      },
      (err) => {
        if (err.code !== err.PERMISSION_DENIED) return; // ignore temporary errors
        toast.error(t('bikerDashboard.toastLocationPermission'));
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 10_000 },
    );
    return () => {
      if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current);
    };
  }, [deliveryId, t]);

  const mapsUrl = lat != null && lng != null
    ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
    : null;

  return (
    <div className="space-y-3 border-t border-dashed border-border pt-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          <MapPin className="h-4 w-4 text-primary mt-0.5 shrink-0" />
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t('bikerDashboard.deliveryDestination')}</p>
            <p className="text-sm text-foreground mt-0.5">{address ?? t('bikerDashboard.addressNotSet')}</p>
          </div>
        </div>
        {mapsUrl && (
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white text-xs font-medium rounded-lg hover:bg-primary/90 transition-colors"
          >
            <Navigation className="h-3.5 w-3.5" /> {t('bikerDashboard.navigate')}
          </a>
        )}
      </div>

      {lat != null && lng != null ? (
        <OsmMap lat={lat} lng={lng} label={t('bikerDashboard.patientLocationOnMap')} />
      ) : (
        <div className="rounded-lg border border-dashed border-border h-24 flex items-center justify-center text-xs text-muted-foreground/70">
          {t('bikerDashboard.noGpsCoordinates')}
        </div>
      )}

      <div className="flex items-center gap-1.5 text-xs text-muted-foreground/70">
        <Locate className="h-3.5 w-3.5" />
        <span>{t('bikerDashboard.gpsBeingShared')}</span>
      </div>
    </div>
  );
}

// ── Active order workflow card ─────────────────────────────────────────────────

function ActiveOrderCard({ order, onRefresh }: { order: api.DeliveryDto; onRefresh: () => void }) {
  const { t } = useTranslation();
  const [failureDialogOpen, setFailureDialogOpen] = useState(false);
  const [deliverDialogOpen, setDeliverDialogOpen] = useState(false);
  const [failureReason, setFailureReason] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const showDestination = order.status === "ACCEPTED" ||
    order.status === "PICKED_UP" ||
    order.status === "ON_THE_WAY";

  const handle = async (action: () => Promise<unknown>) => {
    try { await action(); onRefresh(); }
    catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: { message?: string } } } })
        ?.response?.data?.error?.message;
      toast.error(msg ?? "Action failed");
    }
  };

  return (
    <Card className="border-2 border-primary">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-foreground">{t('bikerDashboard.activeDelivery')}</h3>
            <p className="text-xs text-muted-foreground/70">ID: {order.deliveryId.slice(0, 8)}…</p>
          </div>
          <StatusBadge status={order.status} />
        </div>

        {order.status === "ASSIGNED" && (
          <div className="flex gap-2">
            <Button
              className="flex-1 bg-primary hover:bg-primary/90 text-white"
              onClick={() => handle(() => api.acceptOrder(order.deliveryId))}
            >
              <CheckCircle className="h-4 w-4 mr-1.5" /> {t('bikerDashboard.accept')}
            </Button>
            <Button
              variant="outline"
              className="flex-1 border-red-400 text-red-500"
              onClick={() => handle(() => api.declineOrder(order.deliveryId))}
            >
              <XCircle className="h-4 w-4 mr-1.5" /> {t('bikerDashboard.decline')}
            </Button>
          </div>
        )}

        {order.status === "ACCEPTED" && (
          <Button
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
            onClick={() => handle(() => api.markPickedUp(order.deliveryId))}
          >
            <Bike className="h-4 w-4 mr-1.5" /> {t('bikerDashboard.markPickedUp')}
          </Button>
        )}

        {order.status === "PICKED_UP" && (
          <Button
            className="w-full bg-cyan-600 hover:bg-cyan-700 text-white"
            onClick={() => handle(() => api.markOnTheWay(order.deliveryId))}
          >
            <MapPin className="h-4 w-4 mr-1.5" /> {t('bikerDashboard.markOnTheWay')}
          </Button>
        )}

        {order.status === "ON_THE_WAY" && (
          <div className="flex gap-2">
            <Button
              className="flex-1 bg-green-600 hover:bg-green-700 text-white"
              onClick={() => setDeliverDialogOpen(true)}
            >
              <CheckCircle className="h-4 w-4 mr-1.5" /> {t('bikerDashboard.markDelivered')}
            </Button>
            <Button
              variant="outline"
              className="flex-1 border-red-400 text-red-500"
              onClick={() => setFailureDialogOpen(true)}
            >
              <XCircle className="h-4 w-4 mr-1.5" /> {t('bikerDashboard.markFailed')}
            </Button>
          </div>
        )}

        {/* Destination map — shown once the biker has accepted and needs to know where to go */}
        {showDestination && (
          <DestinationCard
            deliveryId={order.deliveryId}
            address={order.deliveryAddress}
            lat={order.destinationLatitude}
            lng={order.destinationLongitude}
          />
        )}

        {/* Delivered dialog with optional photo */}
        <Dialog open={deliverDialogOpen} onOpenChange={setDeliverDialogOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>{t('bikerDashboard.confirmDelivery')}</DialogTitle></DialogHeader>
            <div className="space-y-3 py-2">
              <Label>{t('bikerDashboard.confirmationPhotoOptional')}</Label>
              <input type="file" accept="image/*" ref={fileRef} className="hidden"
                     onChange={e => setPhoto(e.target.files?.[0] ?? null)} />
              <Button variant="outline" className="w-full" onClick={() => fileRef.current?.click()}>
                <Camera className="h-4 w-4 mr-2" />
                {photo ? photo.name : t('bikerDashboard.attachPhoto')}
              </Button>
              <Button
                className="w-full bg-green-600 hover:bg-green-700 text-white"
                onClick={() => {
                  handle(() => api.markDelivered(order.deliveryId, photo ?? undefined))
                    .then(() => setDeliverDialogOpen(false));
                }}
              >
                {t('bikerDashboard.confirmDelivered')}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Failure dialog */}
        <Dialog open={failureDialogOpen} onOpenChange={setFailureDialogOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>{t('bikerDashboard.reportDeliveryFailure')}</DialogTitle></DialogHeader>
            <div className="space-y-3 py-2">
              <Label>{t('bikerDashboard.reasonForFailure')}</Label>
              <Textarea
                placeholder={t('bikerDashboard.failurePlaceholder')}
                value={failureReason}
                onChange={e => setFailureReason(e.target.value)}
                rows={3}
              />
              <Button
                className="w-full bg-red-600 hover:bg-red-700 text-white"
                disabled={!failureReason.trim()}
                onClick={() => {
                  handle(() => api.markFailed(order.deliveryId, failureReason))
                    .then(() => { setFailureDialogOpen(false); setFailureReason(""); });
                }}
              >
                {t('bikerDashboard.submitFailureReport')}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export const BikerDashboard: React.FC = () => {
  const { t } = useTranslation();
  const [profile, setProfile] = useState<api.BikerDto | null>(null);
  const [orders, setOrders] = useState<api.DeliveryDto[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    Promise.all([api.getMyBikerProfile(), api.getMyOrders()])
      .then(([p, o]) => { setProfile(p); setOrders(o); })
      .catch(() => toast.error(t('bikerDashboard.toastFailedLoad')))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const activeStatuses = new Set(["ASSIGNED", "ACCEPTED", "PICKED_UP", "ON_THE_WAY"]);
  const activeOrders = orders.filter(o => activeStatuses.has(o.status));
  const historyOrders = orders.filter(o => !activeStatuses.has(o.status));

  const toggleStatus = async () => {
    if (!profile) return;
    const next = profile.status === "OFFLINE" ? "AVAILABLE" as const : "OFFLINE" as const;
    try {
      const updated = await api.updateBikerStatus(next);
      setProfile(updated);
      toast.success(t('bikerDashboard.toastStatusSet', { status: updated.status }));
    } catch { toast.error(t('bikerDashboard.toastFailedStatus')); }
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-[300px] text-muted-foreground">{t('bikerDashboard.loadingDashboard')}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-primary">{t('bikerDashboard.title')}</h2>
          <p className="text-muted-foreground text-sm mt-1">{t('bikerDashboard.subtitle')}</p>
        </div>
        <div className="flex items-center gap-3">
          {profile && (
            <Button
              variant="outline"
              className={profile.status === "OFFLINE"
                ? "border-green-500 text-green-600"
                : profile.status === "ON_DELIVERY"
                  ? "border-orange-400 text-orange-500 cursor-not-allowed"
                  : "border-border text-muted-foreground"}
              onClick={toggleStatus}
              disabled={profile.status === "ON_DELIVERY"}
            >
              {profile.status === "OFFLINE"
                ? t('bikerDashboard.goAvailable')
                : profile.status === "ON_DELIVERY"
                  ? t('bikerDashboard.onDelivery')
                  : t('bikerDashboard.goOffline')}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={load}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Profile card */}
      {profile && (
        <div className="flex items-center gap-4 bg-card rounded-xl border border-border p-4 shadow-sm">
          <div className="h-12 w-12 rounded-full bg-secondary flex items-center justify-center">
            <Bike className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-foreground">{profile.name}</p>
            <p className="text-sm text-muted-foreground">{profile.vehicleType} · {profile.operatingZone ?? t('bikerDashboard.allZones')}</p>
          </div>
          <Badge
            className={
              profile.status === "AVAILABLE" ? "bg-green-100 text-green-800" :
              profile.status === "ON_DELIVERY" ? "bg-orange-100 text-orange-800" :
              "bg-muted text-muted-foreground"
            }
          >
            {profile.status.replace("_", " ")}
          </Badge>
        </div>
      )}

      {/* Active orders */}
      {activeOrders.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold text-foreground/80">{t('bikerDashboard.activeOrders')}</h3>
          {activeOrders.map(o => (
            <ActiveOrderCard key={o.deliveryId} order={o} onRefresh={load} />
          ))}
        </div>
      )}

      {/* History */}
      <div className="space-y-3">
        <h3 className="font-semibold text-foreground/80">{t('bikerDashboard.orderHistory')}</h3>
        {historyOrders.length === 0 ? (
          <p className="text-sm text-muted-foreground/70 py-4 text-center">{t('bikerDashboard.noDeliveries')}</p>
        ) : (
          <div className="space-y-2">
            {historyOrders.map(o => (
              <Card key={o.deliveryId} className="border border-border">
                <CardContent className="p-3 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground/70">
                      {o.deliveredAt
                        ? `${t('bikerDashboard.delivered')}: ${new Date(o.deliveredAt).toLocaleDateString()}`
                        : o.assignedAt
                          ? `${t('bikerDashboard.assigned')}: ${new Date(o.assignedAt).toLocaleDateString()}`
                          : ""}
                    </p>
                    {o.failureReason && (
                      <p className="text-xs text-red-500 mt-0.5">{o.failureReason}</p>
                    )}
                  </div>
                  <StatusBadge status={o.status} />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
