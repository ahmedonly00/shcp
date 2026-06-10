import { apiClient, unwrap } from './client';

export interface PharmacyDto {
  pharmacyId: string;
  name: string;
  address: string;
  /** Rwanda administrative level 2 */
  district: string | null;
  /** Rwanda administrative level 3 */
  sector: string | null;
  /** Rwanda administrative level 4 */
  cell: string | null;
  /** WGS-84 GPS coordinates — used for Haversine tiebreaking */
  latitude: number | null;
  longitude: number | null;
  phone: string | null;
  email: string | null;
  isActive: boolean;
}

export interface InventoryItemDto {
  inventoryId: string;
  pharmacyId: string;
  medicationName: string;
  genericName: string | null;
  quantityInStock: number;
  unit: string;
  expiryDate: string | null;
  reorderLevel: number;
  lowStock: boolean;
  updatedAt: string;
}

export interface StockUpdateRequest {
  medicationName: string;
  genericName?: string;
  quantityInStock: number;
  unit?: string;
  expiryDate?: string;
  reorderLevel?: number;
}

export interface BikerDto {
  userId: string;
  pharmacyId: string;
  name: string;
  email: string;
  phone: string;
  licenseNumber: string | null;
  vehicleType: string;
  operatingZone: string | null;
  status: 'AVAILABLE' | 'ON_DELIVERY' | 'OFFLINE';
  /** Only populated on initial registration — null in list responses. */
  tempPassword: string | null;
}

export interface DeliveryDto {
  deliveryId: string;
  prescriptionId: string;
  bikerId: string | null;
  bikerName: string | null;
  status: 'ASSIGNED' | 'ACCEPTED' | 'PICKED_UP' | 'ON_THE_WAY' | 'DELIVERED' | 'DECLINED' | 'FAILED';
  assignedAt: string | null;
  acceptedAt: string | null;
  pickedUpAt: string | null;
  deliveredAt: string | null;
  confirmationPhotoUrl: string | null;
  failureReason: string | null;
  createdAt: string;
  // Real-time biker GPS position
  bikerLatitude: number | null;
  bikerLongitude: number | null;
  locationUpdatedAt: string | null;
  // Patient delivery destination (from Prescription)
  deliveryAddress: string | null;
  destinationLatitude: number | null;
  destinationLongitude: number | null;
}

export interface PrescriptionRow {
  prescriptionId: string;
  patientName: string;
  providerName: string;
  pharmacyName: string | null;
  medications: string;
  deliveryAddress: string | null;
  issuedAt: string;
  validUntil: string;
  status: string;
}

export interface NearestPharmacyDto extends PharmacyDto {
  /** Haversine distance in km — null when no GPS was provided in the query. */
  distanceKm: number | null;
  /** Admin-area match quality: CELL, SECTOR, DISTRICT, or OTHER. */
  matchLevel: 'CELL' | 'SECTOR' | 'DISTRICT' | 'OTHER';
}

// ── Pharmacies (public + admin) ────────────────────────────────────────────

export const listPharmacies = () =>
  apiClient.get<{ data: PharmacyDto[] }>('/pharmacies').then(unwrap);

export const getNearestPharmacies = (params: {
  district?: string; sector?: string; cell?: string;
  lat?: number; lng?: number; limit?: number;
}) =>
  apiClient.get<{ data: NearestPharmacyDto[] }>('/pharmacies/nearest', { params })
    .then(unwrap<NearestPharmacyDto[]>);

export interface PharmacyPayload {
  name: string;
  address: string;
  district?: string;
  sector?: string;
  cell?: string;
  latitude?: number;
  longitude?: number;
  phone?: string;
  email?: string;
}

export const createPharmacy = (data: PharmacyPayload) =>
  apiClient.post<{ data: PharmacyDto }>('/pharmacies', data).then(unwrap);

export const updatePharmacy = (id: string, data: PharmacyPayload) =>
  apiClient.put<{ data: PharmacyDto }>(`/pharmacies/${id}`, data).then(unwrap);

export const activatePharmacy = (id: string) =>
  apiClient.patch(`/pharmacies/${id}/activate`);

export const deactivatePharmacy = (id: string) =>
  apiClient.patch(`/pharmacies/${id}/deactivate`);

// ── Pharmacist dashboard ───────────────────────────────────────────────────

export const getPharmacistPrescriptions = () =>
  apiClient.get<{ data: PrescriptionRow[] }>('/pharmacist/prescriptions').then(unwrap);

export const markProcessing = (id: string) =>
  apiClient.patch<{ data: PrescriptionRow }>(`/pharmacist/prescriptions/${id}/processing`).then(unwrap);

export const markReady = (id: string) =>
  apiClient.patch<{ data: PrescriptionRow }>(`/pharmacist/prescriptions/${id}/ready`).then(unwrap);

export const getSuggestedBikers = (prescriptionId: string) =>
  apiClient.get<{ data: BikerDto[] }>(`/pharmacist/prescriptions/${prescriptionId}/suggested-bikers`).then(unwrap);

export const assignBiker = (prescriptionId: string, bikerId: string) =>
  apiClient.post<{ data: DeliveryDto }>(`/pharmacist/prescriptions/${prescriptionId}/assign-biker`, { bikerId }).then(unwrap);

export const getPharmacistDeliveries = () =>
  apiClient.get<{ data: DeliveryDto[] }>('/pharmacist/deliveries').then(unwrap);

export const reassignBiker = (deliveryId: string, bikerId: string) =>
  apiClient.post<{ data: DeliveryDto }>(`/pharmacist/deliveries/${deliveryId}/reassign`, { bikerId }).then(unwrap);

// ── Biker management ───────────────────────────────────────────────────────

export const getMyBikers = () =>
  apiClient.get<{ data: BikerDto[] }>('/pharmacist/bikers').then(unwrap);

export const registerBiker = (data: {
  name: string; email: string; phone: string;
  licenseNumber?: string; vehicleType: string; operatingZone?: string;
}) => apiClient.post<{ data: BikerDto }>('/pharmacist/bikers', data).then(unwrap);

export const activateBiker = (bikerId: string) =>
  apiClient.patch<{ data: BikerDto }>(`/pharmacist/bikers/${bikerId}/activate`).then(unwrap);

export const deactivateBiker = (bikerId: string) =>
  apiClient.patch<{ data: BikerDto }>(`/pharmacist/bikers/${bikerId}/deactivate`).then(unwrap);

// ── Inventory management ──────────────────────────────────────────────────────

export const getMyInventory = () =>
  apiClient.get<{ data: InventoryItemDto[] }>('/pharmacist/inventory').then(unwrap);

export const getLowStockAlerts = () =>
  apiClient.get<{ data: InventoryItemDto[] }>('/pharmacist/inventory/low-stock').then(unwrap);

export const upsertStock = (data: StockUpdateRequest) =>
  apiClient.put<{ data: InventoryItemDto }>('/pharmacist/inventory', data).then(unwrap);

export const deleteInventoryItem = (inventoryId: string) =>
  apiClient.delete(`/pharmacist/inventory/${inventoryId}`);

// ── Pharmacist management (admin per pharmacy) ────────────────────────────────

export interface PharmacistProfileDto {
  userId: string;
  name: string;
  email: string;
  phone: string;
  pharmacyId: string;
  pharmacyName: string;
  /** Only present on the creation response — null in list results. */
  tempPassword: string | null;
}

export const getPharmacyPharmacists = (pharmacyId: string) =>
  apiClient.get<{ data: PharmacistProfileDto[] }>(`/pharmacies/${pharmacyId}/pharmacists`).then(unwrap);

export const addPharmacistToPharmacy = (pharmacyId: string, data: { name: string; email: string; phone: string }) =>
  apiClient.post<{ data: PharmacistProfileDto }>(`/pharmacies/${pharmacyId}/pharmacists`, data).then(unwrap);
