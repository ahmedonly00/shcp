import { apiClient, unwrap } from './client';

export interface ReferralDto {
  referralId: string;
  patientId: string;
  patientName: string;
  referringProviderId: string;
  referringProviderName: string;
  specialistId: string | null;
  specialistName: string | null;
  specialistSpecialty: string | null;
  consultationId: string | null;
  specialtyNeeded: string;
  reason: string;
  urgency: string;
  status: string;
  notes: string | null;
  referralType: string;           // INTERNAL | EXTERNAL
  institutionName: string | null;
  institutionType: string | null; // HOSPITAL | SURGICAL_CENTER | CLINIC | LABORATORY | IMAGING_CENTER | REHABILITATION_CENTER
  institutionAddress: string | null;
  institutionContact: string | null;
  treatmentType: string | null;   // OPERATION | SPECIALIST_CARE | EMERGENCY | LAB_TESTS | IMAGING | PHYSIOTHERAPY | REHABILITATION | OTHER
  createdAt: string;
}

export interface CreateReferralRequest {
  patientId: string;
  specialistId?: string;
  consultationId?: string;
  specialtyNeeded: string;
  reason: string;
  urgency?: string;         // EMERGENCY | URGENT | ROUTINE
  notes?: string;
  referralType?: string;    // INTERNAL | EXTERNAL
  institutionName?: string;
  institutionType?: string;
  institutionAddress?: string;
  institutionContact?: string;
  treatmentType?: string;
}

export const referralsApi = {
  create: (req: CreateReferralRequest) =>
    apiClient.post<ReferralDto>('/referrals', req).then(unwrap<ReferralDto>),

  myReferrals: () =>
    apiClient.get<ReferralDto[]>('/referrals/me').then(unwrap<ReferralDto[]>),

  incomingReferrals: () =>
    apiClient.get<ReferralDto[]>('/referrals/incoming').then(unwrap<ReferralDto[]>),

  patientReferrals: () =>
    apiClient.get<ReferralDto[]>('/referrals/patient/me').then(unwrap<ReferralDto[]>),

  updateStatus: (referralId: string, status: string) =>
    apiClient.patch<ReferralDto>(`/referrals/${referralId}/status`, null, { params: { status } })
      .then(unwrap<ReferralDto>),
};
