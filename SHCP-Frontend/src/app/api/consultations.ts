import { apiClient, unwrap } from './client';
import { ApiConsultationDto } from '@/app/types';

export interface StartConsultationRequest {
  appointmentId: string;
  notes?: string;
}

export interface EndConsultationRequest {
  notes?: string;
  durationMinutes?: number;
  recordingUrl?: string;
}

export interface TurnCredentials {
  iceServers: Array<{
    urls: string[];
    username?: string;
    credential?: string;
  }>;
}

export interface AuditEventDto {
  id: string;
  consultationId: string;
  eventType: string;
  participantId: string | null;
  participantRole: string | null;
  metadata: string | null;
  createdAt: string;
}

export interface InstantConsultRequest {
  providerId: string;
  notes?: string;
}

export const consultationsApi = {
  // ── Instant consult (patient-initiated) ─────────────────────────────────────
  startInstant: (data: InstantConsultRequest) =>
    apiClient.post<ApiConsultationDto>('/consultations/instant', data).then(unwrap<ApiConsultationDto>),

  getIncomingInstant: () =>
    apiClient.get<ApiConsultationDto | null>('/consultations/instant-incoming').then(unwrap<ApiConsultationDto | null>),

  start: (data: StartConsultationRequest) =>
    apiClient.post<ApiConsultationDto>('/consultations', data).then(unwrap<ApiConsultationDto>),

  end: (id: string, data: EndConsultationRequest) =>
    apiClient.put<ApiConsultationDto>(`/consultations/${id}/end`, data).then(unwrap<ApiConsultationDto>),

  getById: (id: string) =>
    apiClient.get<ApiConsultationDto>(`/consultations/${id}`).then(unwrap<ApiConsultationDto>),

  getByAppointment: (appointmentId: string) =>
    apiClient.get<ApiConsultationDto>(`/consultations/appointment/${appointmentId}`).then(unwrap<ApiConsultationDto>),

  getMine: (page = 0, size = 10) =>
    apiClient.get<ApiConsultationDto[]>('/consultations/me', { params: { page, size } }).then(unwrap<ApiConsultationDto[]>),

  // ── TURN credentials ────────────────────────────────────────────────────────
  getTurnCredentials: (id: string) =>
    apiClient.get<TurnCredentials>(`/consultations/${id}/turn-credentials`).then(unwrap<TurnCredentials>),

  // ── Audit log ───────────────────────────────────────────────────────────────
  logAuditEvent: (id: string, eventType: string, metadata?: string) =>
    apiClient.post(`/consultations/${id}/audit`, { eventType, metadata }).catch(() => {}),

  getAuditLog: (id: string) =>
    apiClient.get<AuditEventDto[]>(`/consultations/${id}/audit`).then(unwrap<AuditEventDto[]>),

  // ── Recording consent ────────────────────────────────────────────────────────
  grantRecordingConsent: (id: string) =>
    apiClient.post<ApiConsultationDto>(`/consultations/${id}/consent`).then(unwrap<ApiConsultationDto>),

  // ── Recording upload ─────────────────────────────────────────────────────────
  uploadRecording: (id: string, formData: FormData) =>
    apiClient.post<ApiConsultationDto>(`/consultations/${id}/recording`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(unwrap<ApiConsultationDto>),

  // ── Recording download ────────────────────────────────────────────────────────
  getRecordingUrl: (id: string) => `/api/consultations/${id}/recording`,
};
