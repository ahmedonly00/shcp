import { apiClient, unwrap, unwrapPage } from './client';
import { ApiProviderSummary, ApiProviderProfile, ApiSlot, ApiAppointmentDto, ApiHealthRecordDto, ApiInstantAvailableProvider } from '@/app/types';

export interface UpdateProviderRequest {
  name?: string;
  phone?: string;
  specialty?: string;
  facility?: string;
  languagePref?: string;
}

export interface AvailabilitySlot {
  startTime: string;
  endTime: string;
}

export const providersApi = {
  list: () =>
    apiClient.get('/providers').then(unwrapPage<ApiProviderSummary>),

  getById: (id: string) =>
    apiClient.get<ApiProviderProfile>(`/providers/${id}`).then(unwrap<ApiProviderProfile>),

  getAvailability: (id: string, date?: string) =>
    apiClient.get<ApiSlot[]>(`/providers/${id}/availability`, { params: { date } }).then(unwrap<ApiSlot[]>),

  getMyProfile: () =>
    apiClient.get<ApiProviderProfile>('/providers/me').then(unwrap<ApiProviderProfile>),

  updateMyProfile: (data: UpdateProviderRequest) =>
    apiClient.put<ApiProviderProfile>('/providers/me', data).then(unwrap<ApiProviderProfile>),

  setMyAvailability: (slots: AvailabilitySlot[]) =>
    apiClient.put('/providers/me/availability', { slots }).then(unwrap<ApiSlot[]>),

  getMyAppointments: (page = 0, size = 10) =>
    apiClient.get('/providers/me/appointments', { params: { page, size } }).then(unwrapPage<ApiAppointmentDto>),

  getMyPatients: () =>
    apiClient.get('/providers/me/patients').then(unwrap<ApiProviderSummary[]>),

  getPatientEhr: (patientId: string) =>
    apiClient.get<ApiHealthRecordDto>(`/providers/me/patients/${patientId}/ehr`).then(unwrap<ApiHealthRecordDto>),

  addSlot: (slot: { startTime: string; endTime: string; appointmentType?: string }) =>
    apiClient.post('/providers/me/availability/slots', slot).then(unwrap<ApiSlot>),

  getMySlots: () =>
    apiClient.get<ApiSlot[]>('/providers/me/slots').then(unwrap<ApiSlot[]>),

  blockSlot: (slotId: string) =>
    apiClient.patch<ApiSlot>(`/providers/me/availability/slots/${slotId}/block`, {}).then(unwrap<ApiSlot>),

  exportIcal: () =>
    apiClient.get<string>('/providers/me/availability/export.ics', { responseType: 'text' }).then(r => r.data),

  uploadAvatar: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return apiClient.post<string>('/users/me/avatar', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(unwrap<string>);
  },

  avatarUrl: (storedName: string) => {
    const token = localStorage.getItem('accessToken') ?? '';
    return `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'}/api/users/me/files/${storedName}?token=${token}`;
  },

  // ── Instant consult availability ──────────────────────────────────────────
  getInstantAvailable: () =>
    apiClient.get<ApiInstantAvailableProvider[]>('/providers/instant-available').then(unwrap<ApiInstantAvailableProvider[]>),

  toggleInstantAvailability: () =>
    apiClient.patch<ApiProviderProfile>('/providers/me/instant-availability', {}).then(unwrap<ApiProviderProfile>),
};
