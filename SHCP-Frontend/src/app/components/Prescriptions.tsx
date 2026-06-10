'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { Input } from '@/app/components/ui/input';
import {
  Pill, Download, Loader2, Search, FileText, Building2,
  Calendar, User, ChevronDown, ChevronUp, XCircle, Bell,
  RefreshCw, Clock, CheckCircle2, Truck, AlertCircle, Navigation
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/app/context/AuthContext';
import { prescriptionsApi } from '@/app/api/prescriptions';
import { ApiPrescriptionDto } from '@/app/types';
import { downloadPrescriptionPdf } from '@/app/lib/downloadPrescriptionPdf';
import { toast } from 'sonner';

// ── Types ────────────────────────────────────────────────────────────────────

type RxStatus = ApiPrescriptionDto['status'];
type FilterKey = 'all' | 'active' | 'transit' | 'delivered' | 'closed';

interface Medication {
  name: string;
  dosage?: string;
  frequency?: string;
  durationDays?: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<RxStatus, string> = {
  PENDING:              'bg-yellow-100 text-yellow-800 border-yellow-300',
  PROCESSING:           'bg-blue-100 text-blue-800 border-blue-300',
  READY_FOR_DELIVERY:   'bg-indigo-100 text-indigo-800 border-indigo-300',
  PICKED_UP:            'bg-cyan-100 text-cyan-800 border-cyan-300',
  ON_THE_WAY:           'bg-purple-100 text-purple-800 border-purple-300',
  DELIVERED:            'bg-green-100 text-green-800 border-green-300',
  FAILED:               'bg-red-100 text-red-800 border-red-300',
  CANCELLED:            'bg-gray-100 text-gray-600 border-gray-300',
  EXPIRED:              'bg-gray-100 text-gray-500 border-gray-300',
};

const ACTIVE_STATUSES:    RxStatus[] = ['PENDING', 'PROCESSING', 'READY_FOR_DELIVERY'];
const TRANSIT_STATUSES:   RxStatus[] = ['PICKED_UP', 'ON_THE_WAY'];
const DELIVERED_STATUSES: RxStatus[] = ['DELIVERED'];
const CLOSED_STATUSES:    RxStatus[] = ['CANCELLED', 'FAILED', 'EXPIRED'];

function matchesFilter(rx: ApiPrescriptionDto, filter: FilterKey): boolean {
  if (filter === 'all')       return true;
  if (filter === 'active')    return ACTIVE_STATUSES.includes(rx.status);
  if (filter === 'transit')   return TRANSIT_STATUSES.includes(rx.status);
  if (filter === 'delivered') return DELIVERED_STATUSES.includes(rx.status);
  if (filter === 'closed')    return CLOSED_STATUSES.includes(rx.status);
  return true;
}

function parseMeds(raw: string): Medication[] {
  try { return JSON.parse(raw) ?? []; } catch { return []; }
}

// ── Prescription Card ────────────────────────────────────────────────────────

interface RxCardProps {
  rx: ApiPrescriptionDto;
  isProvider: boolean;
  onCancel: (id: string) => void;
  onNotifyPharmacy: (id: string) => void;
  onDownload: (rx: ApiPrescriptionDto) => void;
  downloading: boolean;
  cancelling: boolean;
  notifying: boolean;
  onNavigateToDashboard?: () => void;
}

function RxCard({ rx, isProvider, onCancel, onNotifyPharmacy, onDownload, downloading, cancelling, notifying, onNavigateToDashboard }: RxCardProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const meds = parseMeds(rx.medications);

  const STATUS_LABELS: Record<RxStatus, string> = {
    PENDING:            t('prescriptions.statusPending'),
    PROCESSING:         t('prescriptions.statusProcessing'),
    READY_FOR_DELIVERY: t('prescriptions.statusReadyAtPharmacy'),
    PICKED_UP:          t('prescriptions.statusPickedUp'),
    ON_THE_WAY:         t('prescriptions.statusOnTheWay'),
    DELIVERED:          t('prescriptions.statusDelivered'),
    FAILED:             t('prescriptions.statusFailed'),
    CANCELLED:          t('prescriptions.statusCancelled'),
    EXPIRED:            t('prescriptions.statusExpired'),
  };

  const color = STATUS_COLORS[rx.status] ?? STATUS_COLORS.PENDING;
  const label = STATUS_LABELS[rx.status] ?? STATUS_LABELS.PENDING;
  const canCancel = isProvider && ['PENDING', 'PROCESSING'].includes(rx.status);
  const canNotify = isProvider && rx.pharmacyId && ['PENDING', 'PROCESSING', 'READY_FOR_DELIVERY'].includes(rx.status);

  return (
    <div className="border rounded-lg overflow-hidden bg-white hover:shadow-sm transition-shadow">
      {/* Header row */}
      <div
        className="flex items-center justify-between p-4 cursor-pointer select-none"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
            <Pill className="h-5 w-5 text-blue-600" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-medium text-sm truncate">
                {isProvider ? rx.patientName : `Dr. ${rx.providerName}`}
              </p>
              <Badge className={`text-xs px-2 py-0 border ${color}`}>
                {label}
              </Badge>
            </div>
            <div className="flex items-center gap-3 mt-0.5 flex-wrap">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {rx.issuedAt.split('T')[0]}
              </span>
              <span className="text-xs text-muted-foreground">
                {t('prescriptions.medicationCount', { count: meds.length })}
              </span>
              {rx.pharmacyName && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Building2 className="h-3 w-3" /> {rx.pharmacyName}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-2">
          {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </div>

      {/* Expanded body */}
      {expanded && (
        <div className="border-t px-4 pb-4 pt-3 space-y-4 bg-gray-50/50">
          {/* Medications */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{t('prescriptions.medications')}</p>
            <div className="space-y-2">
              {meds.map((med, i) => (
                <div key={i} className="bg-white rounded-lg border p-3 text-sm">
                  <p className="font-medium text-gray-800">{med.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {[med.dosage, med.frequency, med.durationDays ? t('prescriptions.durationDays', { count: med.durationDays }) : null]
                      .filter(Boolean).join(' · ')}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Instructions */}
          {rx.instructions && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">{t('prescriptions.instructions')}</p>
              <p className="text-sm text-gray-700 italic">{rx.instructions}</p>
            </div>
          )}

          {/* Validity & delivery */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div className="bg-white rounded-lg border p-3">
              <p className="text-xs text-muted-foreground mb-0.5">{t('prescriptions.validUntil')}</p>
              <p className="font-medium">{rx.validUntil.split('T')[0]}</p>
            </div>
            {(rx.deliveryDistrict || rx.deliveryAddress) && (
              <div className="bg-white rounded-lg border p-3">
                <p className="text-xs text-muted-foreground mb-0.5">{t('prescriptions.deliveryAddress')}</p>
                <p className="font-medium text-xs leading-relaxed">
                  {[rx.deliveryCell, rx.deliverySector, rx.deliveryDistrict, rx.deliveryAddress]
                    .filter(Boolean).join(', ')}
                </p>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 flex-wrap pt-1">
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => onDownload(rx)}
              disabled={downloading}
            >
              {downloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              {t('prescriptions.downloadPdf')}
            </Button>

            {!isProvider && (rx.status === 'PICKED_UP' || rx.status === 'ON_THE_WAY') && onNavigateToDashboard && (
              <Button
                size="sm"
                className="gap-1.5 bg-cyan-600 hover:bg-cyan-700 text-white"
                onClick={onNavigateToDashboard}
              >
                <Navigation className="h-3.5 w-3.5" />
                {t('prescriptions.trackLive')}
              </Button>
            )}

            {canNotify && (
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={() => onNotifyPharmacy(rx.prescriptionId)}
                disabled={notifying}
              >
                {notifying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Bell className="h-3.5 w-3.5" />}
                {t('prescriptions.notifyPharmacy')}
              </Button>
            )}

            {canCancel && (
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                onClick={() => onCancel(rx.prescriptionId)}
                disabled={cancelling}
              >
                {cancelling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
                {t('prescriptions.cancel')}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export function Prescriptions({ onNavigateToDashboard }: { onNavigateToDashboard?: () => void } = {}) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isProvider = user?.role === 'doctor';

  const FILTER_TABS: { key: FilterKey; label: string; icon: React.ReactNode }[] = [
    { key: 'all',       label: t('prescriptions.filterAll'),       icon: <FileText className="h-3.5 w-3.5" /> },
    { key: 'active',    label: t('prescriptions.filterActive'),    icon: <Clock className="h-3.5 w-3.5" /> },
    { key: 'transit',   label: t('prescriptions.filterTransit'),   icon: <Truck className="h-3.5 w-3.5" /> },
    { key: 'delivered', label: t('prescriptions.filterDelivered'), icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
    { key: 'closed',    label: t('prescriptions.filterClosed'),    icon: <XCircle className="h-3.5 w-3.5" /> },
  ];

  const [prescriptions, setPrescriptions] = useState<ApiPrescriptionDto[]>([]);
  const [loading, setLoading]             = useState(false);
  const [filter, setFilter]               = useState<FilterKey>('all');
  const [search, setSearch]               = useState('');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [cancellingId, setCancellingId]   = useState<string | null>(null);
  const [notifyingId, setNotifyingId]     = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await prescriptionsApi.getMine();
      setPrescriptions(list ?? []);
    } catch {
      toast.error(t('prescriptions.toastLoadFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { load(); }, [load]);

  const handleDownload = async (rx: ApiPrescriptionDto) => {
    setDownloadingId(rx.prescriptionId);
    try {
      await downloadPrescriptionPdf(rx);
    } catch {
      toast.error(t('prescriptions.toastPdfFailed'));
    } finally {
      setDownloadingId(null);
    }
  };

  const handleCancel = async (id: string) => {
    setCancellingId(id);
    try {
      const updated = await prescriptionsApi.cancel(id);
      setPrescriptions(prev => prev.map(p => p.prescriptionId === id ? updated : p));
      toast.success(t('prescriptions.toastCancelled'));
    } catch {
      toast.error(t('prescriptions.toastCancelFailed'));
    } finally {
      setCancellingId(null);
    }
  };

  const handleNotifyPharmacy = async (id: string) => {
    setNotifyingId(id);
    try {
      await prescriptionsApi.notifyPharmacy(id);
      toast.success(t('prescriptions.toastPharmacyNotified'));
    } catch {
      toast.error(t('prescriptions.toastNotifyFailed'));
    } finally {
      setNotifyingId(null);
    }
  };

  // ── Filter + search ────────────────────────────────────────────────────────
  const q = search.trim().toLowerCase();
  const visible = prescriptions.filter(rx => {
    if (!matchesFilter(rx, filter)) return false;
    if (!q) return true;
    const target = isProvider ? rx.patientName : rx.providerName;
    return (
      target.toLowerCase().includes(q) ||
      rx.issuedAt.includes(q) ||
      parseMeds(rx.medications).some(m => m.name.toLowerCase().includes(q))
    );
  });

  // ── Summary counts ─────────────────────────────────────────────────────────
  const counts: Record<FilterKey, number> = {
    all:       prescriptions.length,
    active:    prescriptions.filter(r => ACTIVE_STATUSES.includes(r.status)).length,
    transit:   prescriptions.filter(r => TRANSIT_STATUSES.includes(r.status)).length,
    delivered: prescriptions.filter(r => DELIVERED_STATUSES.includes(r.status)).length,
    closed:    prescriptions.filter(r => CLOSED_STATUSES.includes(r.status)).length,
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{t('prescriptions.title')}</h2>
          <p className="text-muted-foreground text-sm mt-0.5">
            {isProvider
              ? t('prescriptions.subtitleProvider')
              : t('prescriptions.subtitlePatient')}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading} className="gap-1.5">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          {t('prescriptions.refresh')}
        </Button>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { key: 'all' as FilterKey,       label: t('prescriptions.statTotal'),     icon: <FileText className="h-4 w-4 text-gray-500" />,        bg: 'bg-gray-50' },
          { key: 'active' as FilterKey,    label: t('prescriptions.statActive'),    icon: <Clock className="h-4 w-4 text-yellow-500" />,         bg: 'bg-yellow-50' },
          { key: 'transit' as FilterKey,   label: t('prescriptions.statInTransit'), icon: <Truck className="h-4 w-4 text-purple-500" />,         bg: 'bg-purple-50' },
          { key: 'delivered' as FilterKey, label: t('prescriptions.statDelivered'), icon: <CheckCircle2 className="h-4 w-4 text-green-500" />,   bg: 'bg-green-50' },
        ].map(s => (
          <Card key={s.key} className={`${s.bg} border-0`}>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2">
                {s.icon}
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
              <p className="text-2xl font-bold mt-1">{counts[s.key]}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters + search */}
      <Card>
        <CardContent className="pt-4 pb-4 space-y-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={isProvider ? t('prescriptions.searchProvider') : t('prescriptions.searchPatient')}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Filter tabs */}
          <div className="flex gap-2 flex-wrap">
            {FILTER_TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  filter === tab.key
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                {tab.icon}
                {tab.label}
                <span className={`ml-0.5 px-1.5 py-0 rounded-full text-xs ${
                  filter === tab.key ? 'bg-white/20 text-white' : 'bg-background text-muted-foreground'
                }`}>
                  {counts[tab.key]}
                </span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* List */}
      <div className="space-y-3">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : visible.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <Pill className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-30" />
              <p className="font-medium text-muted-foreground">
                {prescriptions.length === 0
                  ? (isProvider ? t('prescriptions.emptyNoIssued') : t('prescriptions.emptyNoFound'))
                  : t('prescriptions.emptyNoMatch')}
              </p>
              {prescriptions.length > 0 && q && (
                <Button variant="ghost" size="sm" className="mt-3" onClick={() => setSearch('')}>
                  {t('prescriptions.clearSearch')}
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          visible.map(rx => (
            <RxCard
              key={rx.prescriptionId}
              rx={rx}
              isProvider={isProvider}
              onCancel={handleCancel}
              onNotifyPharmacy={handleNotifyPharmacy}
              onDownload={handleDownload}
              downloading={downloadingId === rx.prescriptionId}
              cancelling={cancellingId === rx.prescriptionId}
              notifying={notifyingId === rx.prescriptionId}
              onNavigateToDashboard={onNavigateToDashboard}
            />
          ))
        )}
      </div>
    </div>
  );
}
