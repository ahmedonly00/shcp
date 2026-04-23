import { apiClient, unwrap } from './client';

export interface WaitlistEntry {
  entryId: string;
  patientId: string;
  patientName: string;
  providerId: string;
  providerName: string;
  date: string;
  type: string;
  position: number;
  notified: boolean;
  createdAt: string;
}

export interface JoinWaitlistRequest {
  providerId: string;
  date: string;   // yyyy-MM-dd
  type?: string;  // VIDEO | FOLLOWUP | URGENT
}

export const waitlistApi = {
  join: (req: JoinWaitlistRequest) =>
    apiClient.post<WaitlistEntry>('/waitlist', req).then(unwrap<WaitlistEntry>),

  myEntries: () =>
    apiClient.get<WaitlistEntry[]>('/waitlist/me').then(unwrap<WaitlistEntry[]>),

  leave: (entryId: string) =>
    apiClient.delete(`/waitlist/${entryId}`),
};
