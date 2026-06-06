import { apiClient, unwrap } from './client';
import { ApiPlatformStats, ApiProviderStats, ApiPatientHealthSummary, ProviderConsultationRow } from '@/app/types';
export type { ProviderConsultationRow };

export interface DailyCount { date: string; count: number; }

export interface ReportData {
  fromDate: string;
  toDate: string;
  metrics: string[];
  totalConsultations?: number;
  completedConsultations?: number;
  avgConsultationDurationMinutes?: number;
  totalAppointments?: number;
  completedAppointments?: number;
  cancelledAppointments?: number;
  dailyAppointments: DailyCount[];
  newPatients?: number;
  newProviders?: number;
  dailyRegistrations: DailyCount[];
  totalSymptomReports?: number;
  totalPrescriptions?: number;
  activePrescriptions?: number;
  activeProviders?: number;
  totalProviders?: number;
}

export interface ScheduledReportConfig {
  recipientEmails: string[];
  schedule: 'WEEKLY' | 'MONTHLY';
  metrics: string[];
  enabled: boolean;
  lastSentAt?: string;
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export const analyticsApi = {
  adminOverview: () =>
    apiClient.get<ApiPlatformStats>('/analytics/admin/overview').then(unwrap<ApiPlatformStats>),

  adminRegistrations: (days = 30) =>
    apiClient.get<DailyCount[]>('/analytics/admin/registrations', { params: { days } }).then(unwrap<DailyCount[]>),

  adminAppointments: (days = 30) =>
    apiClient.get<DailyCount[]>('/analytics/admin/appointments', { params: { days } }).then(unwrap<DailyCount[]>),

  providerStats: () =>
    apiClient.get<ApiProviderStats>('/analytics/provider/me').then(unwrap<ApiProviderStats>),

  providerConsultationSummary: (from: string, to: string, filter: string) =>
    apiClient.get<ProviderConsultationRow[]>('/analytics/provider/me/consultations', {
      params: { from, to, filter },
    }).then(unwrap<ProviderConsultationRow[]>),

  patientSummary: () =>
    apiClient.get<ApiPatientHealthSummary>('/analytics/patient/me').then(unwrap<ApiPatientHealthSummary>),

  exportPlatformCsv: async () => {
    const res = await apiClient.get('/analytics/admin/export.csv', { responseType: 'blob' });
    triggerDownload(res.data as Blob, 'platform-stats.csv');
  },

  exportAppointmentsCsv: async (days = 30) => {
    const res = await apiClient.get('/analytics/admin/appointments/export.csv', { params: { days }, responseType: 'blob' });
    triggerDownload(res.data as Blob, 'appointments.csv');
  },

  exportRegistrationsCsv: async (days = 30) => {
    const res = await apiClient.get('/analytics/admin/registrations/export.csv', { params: { days }, responseType: 'blob' });
    triggerDownload(res.data as Blob, 'registrations.csv');
  },

  // ── MOH Report Generator ──────────────────────────────────────────────────

  getMohReport: (from: string, to: string, metrics: string[]) =>
    apiClient.get<ReportData>('/analytics/admin/report', {
      params: { from, to, metrics: metrics.join(',') },
    }).then(unwrap<ReportData>),

  exportMohReportCsv: async (from: string, to: string, metrics: string[]) => {
    const res = await apiClient.get('/analytics/admin/report/export.csv', {
      params: { from, to, metrics: metrics.join(',') },
      responseType: 'blob',
    });
    triggerDownload(res.data as Blob, `moh-report-${from}-to-${to}.csv`);
  },

  exportMohReportExcel: async (from: string, to: string, metrics: string[]) => {
    const res = await apiClient.get('/analytics/admin/report/export.xlsx', {
      params: { from, to, metrics: metrics.join(',') },
      responseType: 'blob',
    });
    triggerDownload(res.data as Blob, `moh-report-${from}-to-${to}.xlsx`);
  },

  getScheduledConfig: () =>
    apiClient.get<ScheduledReportConfig>('/analytics/admin/scheduled-report')
      .then(unwrap<ScheduledReportConfig>),

  saveScheduledConfig: (config: ScheduledReportConfig) =>
    apiClient.put<ScheduledReportConfig>('/analytics/admin/scheduled-report', config)
      .then(unwrap<ScheduledReportConfig>),
};
