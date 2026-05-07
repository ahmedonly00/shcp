import { apiClient, unwrap, unwrapPage } from './client';
import { ApiPatientProfile, ApiAppointmentDto, ApiSymptomReportSummary, ApiHealthRecordDto, HealthGoal, ActivityLog } from '@/app/types';

export interface UpdatePatientRequest {
  name?: string;
  phone?: string;
  dateOfBirth?: string;
  bloodType?: string;
  insuranceNumber?: string;
  nationalId?: string;
  gender?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  insuranceProvider?: string;
}

export const patientsApi = {
  getMyProfile: () =>
    apiClient.get<ApiPatientProfile>('/patients/me').then(unwrap<ApiPatientProfile>),

  updateMyProfile: (data: UpdatePatientRequest) =>
    apiClient.put<ApiPatientProfile>('/patients/me', data).then(unwrap<ApiPatientProfile>),

  getMyEhr: () =>
    apiClient.get<ApiHealthRecordDto>('/patients/me/ehr').then(unwrap<ApiHealthRecordDto>),

  updateMyEhr: (data: Partial<ApiHealthRecordDto>) =>
    apiClient.put<ApiHealthRecordDto>('/patients/me/ehr', data).then(unwrap<ApiHealthRecordDto>),

  uploadEhrFile: (file: File, title?: string, date?: string) => {
    const form = new FormData();
    form.append('file', file);
    if (title) form.append('title', title);
    if (date)  form.append('date', date);
    return apiClient.post<ApiHealthRecordDto>('/patients/me/ehr/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(unwrap<ApiHealthRecordDto>);
  },

  /** Returns a URL with the auth token baked in as a query param for inline display */
  ehrFileUrl: (storedName: string) => {
    const token = localStorage.getItem('accessToken') ?? '';
    return `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8082'}/api/patients/me/ehr/files/${storedName}?token=${token}`;
  },

  updateVitals: (vitals: Record<string, string>) =>
    apiClient.patch<ApiHealthRecordDto>('/patients/me/vitals', vitals).then(unwrap<ApiHealthRecordDto>),

  getHealthGoals: (): Promise<HealthGoal[]> =>
    apiClient.get<string>('/patients/me/health-goals').then(res => {
      try { return JSON.parse((unwrap<string>(res)) || '[]') as HealthGoal[]; } catch { return []; }
    }),

  updateHealthGoals: (goals: HealthGoal[]) =>
    apiClient.put<ApiHealthRecordDto>('/patients/me/health-goals', JSON.stringify(goals), {
      headers: { 'Content-Type': 'application/json' },
    }).then(unwrap<ApiHealthRecordDto>),

  getActivityLogs: (): Promise<ActivityLog[]> =>
    apiClient.get<string>('/patients/me/activity').then(res => {
      try { return JSON.parse((unwrap<string>(res)) || '[]') as ActivityLog[]; } catch { return []; }
    }),

  logActivity: (entry: ActivityLog) =>
    apiClient.post<ApiHealthRecordDto>('/patients/me/activity', JSON.stringify(entry), {
      headers: { 'Content-Type': 'application/json' },
    }).then(unwrap<ApiHealthRecordDto>),

  uploadAvatar: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return apiClient.post<string>('/users/me/avatar', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(unwrap<string>);
  },

  avatarUrl: (storedName: string) => {
    const token = localStorage.getItem('accessToken') ?? '';
    return `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8082'}/api/users/me/files/${storedName}?token=${token}`;
  },

  getMySymptomReports: (page = 0, size = 10) =>
    apiClient.get('/patients/me/symptom-reports', { params: { page, size } }).then(unwrapPage<ApiSymptomReportSummary>),

  getMyAppointments: (page = 0, size = 10) =>
    apiClient.get('/patients/me/appointments', { params: { page, size } }).then(unwrapPage<ApiAppointmentDto>),
};
