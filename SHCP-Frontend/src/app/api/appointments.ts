import { apiClient, unwrap } from './client';
import { ApiAppointmentDto } from '@/app/types';

export interface BookingRequest {
  providerId: string;
  slotId: string;
  type: 'VIDEO' | 'FOLLOWUP' | 'URGENT';
  notes?: string;
}

export interface RescheduleRequest {
  newSlotId: string;
  reason?: string;
}

export interface CancelRequest {
  reason: string;
}

export interface AvailableSlotSearch {
  specialty?: string;
  date?: string;
  language?: string;
  type?: string;
}

export const appointmentsApi = {
  book: (data: BookingRequest) =>
    apiClient.post<ApiAppointmentDto>('/appointments', data).then(unwrap<ApiAppointmentDto>),

  getById: (id: string) =>
    apiClient.get<ApiAppointmentDto>(`/appointments/${id}`).then(unwrap<ApiAppointmentDto>),

  cancel: (id: string, data: CancelRequest) =>
    apiClient.put<ApiAppointmentDto>(`/appointments/${id}/cancel`, data).then(unwrap<ApiAppointmentDto>),

  reschedule: (id: string, data: RescheduleRequest) =>
    apiClient.put<ApiAppointmentDto>(`/appointments/${id}/reschedule`, data).then(unwrap<ApiAppointmentDto>),

  searchAvailable: (params: AvailableSlotSearch) =>
    apiClient.get('/appointments/available', { params }).then(unwrap<ApiAppointmentDto[]>),
};
