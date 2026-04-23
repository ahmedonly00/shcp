import { apiClient, unwrap } from './client';
import { ApiPrescriptionDto } from '@/app/types';

export interface MedicationItem {
  name: string;
  dosage: string;
  frequency: string;
  durationDays: number;
}

export interface IssuePrescriptionRequest {
  consultationId?: string;
  patientId: string;
  medications: MedicationItem[];
  instructions?: string;
  validForDays: number;
  providerSignature?: string;
  deliveryAddress?: string;
  /** Rwanda District — used for nearest-pharmacy cascade matching */
  deliveryDistrict?: string;
  /** Rwanda Sector */
  deliverySector?: string;
  /** Rwanda Cell (most specific — matched first) */
  deliveryCell?: string;
  /** WGS-84 latitude — enables Haversine GPS tiebreaker */
  deliveryLatitude?: number;
  /** WGS-84 longitude */
  deliveryLongitude?: number;
}

export const prescriptionsApi = {
  issue: (data: IssuePrescriptionRequest) =>
    apiClient.post<ApiPrescriptionDto>('/prescriptions', data).then(unwrap<ApiPrescriptionDto>),

  getById: (id: string) =>
    apiClient.get<ApiPrescriptionDto>(`/prescriptions/${id}`).then(unwrap<ApiPrescriptionDto>),

  getByConsultation: (consultationId: string) =>
    apiClient
      .get<ApiPrescriptionDto[]>(`/prescriptions/consultation/${consultationId}`)
      .then(unwrap<ApiPrescriptionDto[]>),

  getMine: () =>
    apiClient.get<ApiPrescriptionDto[]>('/prescriptions/me').then(unwrap<ApiPrescriptionDto[]>),

  cancel: (id: string) =>
    apiClient.put<ApiPrescriptionDto>(`/prescriptions/${id}/cancel`, {}).then(unwrap<ApiPrescriptionDto>),

  notifyPharmacy: (prescriptionId: string) =>
    apiClient.post(`/prescriptions/${prescriptionId}/notify-pharmacy`, {}).then(unwrap<void>),
};
