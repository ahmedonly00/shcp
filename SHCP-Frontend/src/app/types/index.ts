// ─── Frontend UI types (kept for component compatibility) ───────────────────

export type UserRole = 'patient' | 'doctor' | 'admin' | 'pharmacist' | 'biker';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  phone?: string;
  specialization?: string; // for doctors
  verified?: boolean;
  twoFactorEnabled?: boolean;
  // Patient-specific
  dateOfBirth?: string;
  bloodType?: string;
  insuranceNumber?: string;
  nationalId?: string;
  // Provider-specific
  facility?: string;
  licenseNumber?: string;
  languagePref?: string;
  /** false when the patient account was created via Google OAuth and still needs dateOfBirth + nationalId */
  profileComplete?: boolean;
}

export interface Appointment {
  id: string;
  patientId: string;
  patientName: string;
  doctorId: string;
  doctorName: string;
  doctorSpecialization: string;
  date: string;
  time: string;
  type: 'video' | 'chat' | 'follow-up';
  status: 'scheduled' | 'completed' | 'cancelled' | 'in-progress' | 'no-show';
  scheduledAt?: string;   // ISO 8601 — kept for client-side expiry check
  reason: string;
  duration: number;
  fee?: number;
  paymentStatus?: string;
  slotId?: string;
}

export interface ExplainingFactor {
  symptom:      string;
  contribution: number;
  direction:    'positive' | 'negative';
  present:      boolean;
}

export interface SymptomCheck {
  id: string;
  userId: string;
  date: string;
  symptoms: string[];
  severity: 'mild' | 'moderate' | 'severe';
  duration: string;
  bodyLocation?: string;
  language?: string;
  /** True once the patient has submitted doctor-confirmation feedback */
  feedbackSubmitted?: boolean;
  aiAssessment: {
    possibleConditions: string[];
    confidence: number;
    recommendation: 'self-care' | 'routine' | 'urgent' | 'emergency';
    details: string;
    isDegraded?: boolean;
    isLowConfidence?: boolean;
    specialistType?: string | null;
    selfCareTips?: string[];
    followUpDays?: number | null;
    /** Top-3 differential: [{disease, probability}] sorted highest-first. */
    topPredictions?: Array<{ disease: string; probability: number }>;
    /** ICD-10 code for the top-1 prediction, e.g. "B54". */
    icd10?: string | null;
    /** SHAP-based top-5 symptoms driving the prediction. */
    explainingFactors?: ExplainingFactor[];
    modelVersion?: string;
  };
}

export interface HealthRecord {
  id: string;
  userId: string;
  type: 'prescription' | 'lab-result' | 'diagnosis' | 'allergy' | 'vaccination';
  date: string;
  title: string;
  description: string;
  doctor?: string;
  attachments?: string[];
  medications?: Medication[];
}

export interface Medication {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
}

export interface Notification {
  id: string;
  userId: string;
  type: 'appointment' | 'prescription' | 'message' | 'alert' | 'reminder';
  title: string;
  message: string;
  date: string;
  read: boolean;
  actionUrl?: string;
}

export interface VitalSign {
  type: 'heart-rate' | 'blood-pressure' | 'temperature' | 'oxygen' | 'weight' | 'glucose';
  value: string | number;
  date: string;
  unit: string;
}

// ─── Backend API types (match backend DTOs exactly) ─────────────────────────

export type BackendRole = 'PATIENT' | 'PROVIDER' | 'ADMIN' | 'PHARMACIST' | 'BIKER';

/** Map frontend role → backend role enum */
export function toBackendRole(role: UserRole): BackendRole {
  if (role === 'doctor') return 'PROVIDER';
  return role.toUpperCase() as BackendRole;
}

/** Map backend role → frontend role */
export function fromBackendRole(role: BackendRole): UserRole {
  if (role === 'PROVIDER') return 'doctor';
  if (role === 'PHARMACIST') return 'pharmacist';
  if (role === 'BIKER') return 'biker';
  return role.toLowerCase() as UserRole;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
  userId: string;
  email: string;
  role: BackendRole;
  isVerified: boolean;
}

export interface ApiRegisterRequest {
  name: string;
  email: string;
  phone: string;
  password: string;
  role: BackendRole;
  languagePref?: string;
  // Patient fields
  dateOfBirth?: string;
  bloodType?: string;
  insuranceNumber?: string;
  nationalId?: string;
  // Provider fields
  licenseNumber?: string;
  specialty?: string;
  facility?: string;
}

export interface ApiAppointmentDto {
  appointmentId: string;
  patientId: string;
  patientName: string;
  providerId: string;
  providerName: string;
  providerSpecialty?: string;   // absent in summary DTO
  slotId?: string;              // absent in summary DTO
  scheduledAt: string;          // ISO 8601 OffsetDateTime
  type: 'VIDEO' | 'FOLLOWUP' | 'URGENT' | 'INSTANT';
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW' | 'CONFIRMED' | 'PENDING';
  fee: number;
  paymentStatus: string;
  notes?: string;
  cancellationReason?: string;
  createdAt?: string;           // absent in summary DTO
}

export interface ApiProviderSummary {
  providerId: string;
  name: string;
  specialty: string;
  facility: string;
  phone: string;
  rating?: number;
  totalConsultations?: number;
  isAvailableForInstant?: boolean;
}

export interface ApiInstantAvailableProvider {
  providerId: string;
  name: string;
  specialty: string;
  facility: string;
  rating?: number;
  profilePictureUrl?: string;
}

export interface ApiSlot {
  slotId: string;
  startTime: string;    // ISO 8601
  endTime: string;
  isBooked: boolean;
  isBlocked: boolean;
  appointmentType?: string;
}

export interface ApiSymptomReport {
  reportId: string;
  patientId: string;
  symptomText: string;
  language: string;
  aiUrgency: 'EMERGENCY' | 'URGENT' | 'ROUTINE' | 'SELF_CARE' | 'UNKNOWN';
  aiPathway: string;
  aiDisease: string | null;
  /** ICD-10 code for the top-1 predicted disease, e.g. "B54". Null when unavailable. */
  icd10?: string | null;
  aiConfidence: number;
  symptoms: Array<{ name: string; severity?: string }>;
  careRecommendation: string;
  specialistType?: string | null;
  selfCareTips?: string[];
  followUpDays?: number | null;
  /** Top-3 differential predictions from the AI model. */
  top3Predictions?: Array<{ disease: string; probability: number }>;
  /** SHAP-based top-5 symptoms driving the prediction. */
  explaining_factors?: ExplainingFactor[];
  /** Version string of the model that produced this result, e.g. "RandomForest-v2". */
  model_version?: string;
  disclaimer: string;
  /** Set when Flask returned NO_SYMPTOMS_DETECTED or LOW_CONFIDENCE. */
  message?: string;
  isDegraded: boolean;
  createdAt: string;
}

export interface ApiPrescriptionDto {
  prescriptionId: string;
  consultationId: string | null;
  patientId: string;
  providerId: string;
  pharmacyId: string | null;
  patientName: string;
  providerName: string;
  pharmacyName: string | null;
  medications: string;          // JSON string of Medication[]
  instructions: string;
  deliveryAddress: string | null;
  deliveryDistrict: string | null;
  deliverySector: string | null;
  deliveryCell: string | null;
  deliveryLatitude: number | null;
  deliveryLongitude: number | null;
  issuedAt: string;
  validUntil: string;
  status: 'PENDING' | 'PROCESSING' | 'READY_FOR_DELIVERY' | 'PICKED_UP' |
          'ON_THE_WAY' | 'DELIVERED' | 'FAILED' | 'CANCELLED' | 'EXPIRED';
}

export interface ApiPatientProfile {
  userId: string;
  name: string;
  email: string;
  phone: string;
  role: BackendRole;
  languagePref: string;
  isVerified: boolean;
  dateOfBirth?: string;
  bloodType?: string;
  insuranceNumber?: string;
  nationalId?: string;
  gender?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  insuranceProvider?: string;
  profilePictureUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApiProviderProfile {
  userId: string;
  name: string;
  email: string;
  phone: string;
  role: BackendRole;
  specialty: string;
  facility: string;
  licenseNumber: string;
  languagePref: string;
  isVerified: boolean;
  isAvailableForInstant?: boolean;
  profilePictureUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApiPlatformStats {
  totalUsers: number;
  activePatients: number;
  activeProviders: number;
  totalAppointments: number;
  completedAppointments: number;
  pendingAppointments: number;
  totalSymptomReports: number;
  totalPrescriptions: number;
}

export interface ApiProviderStats {
  providerId: string;
  totalAppointments: number;
  completedAppointments: number;
  totalPatients: number;
  averageRating: number;
  totalEarnings: number;
  appointmentsThisMonth: number;
}

export interface ApiPatientHealthSummary {
  patientId: string;
  totalAppointments: number;
  upcomingAppointments: number;
  lastConsultationDate?: string;
  activePrescriptions: number;
  totalSymptomReports: number;
}

export interface ApiHealthRecordDto {
  recordId: string;
  patientId: string;
  diagnoses: string;
  medications: string;
  allergies: string;
  vitals: string;
  immunizations: string;
  labResults: string;
  documents: string;
  goals: string;
  activityLogs: string;
  createdAt: string;
  updatedAt: string;
}

export interface HealthGoal {
  id: string;
  title: string;
  target: number;
  current: number;
  unit: string;
}

export interface ActivityLog {
  date: string;
  steps: number;
  calories: number;
  exerciseMinutes: number;
  waterGlasses: number;
  sleepHours: number;
}

export interface ApiConsultationDto {
  consultationId: string;
  appointmentId: string;
  patientId: string;
  roomId: string;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  startedAt: string;
  endedAt?: string;
  durationMinutes?: number;
  notes?: string;
  recordingUrl?: string;
  createdAt: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Convert backend appointment type → frontend type */
export function fromBackendApptType(type: string): Appointment['type'] {
  if (type === 'VIDEO' || type === 'INSTANT') return 'video';
  if (type === 'URGENT') return 'chat';
  return 'follow-up';
}

/** Convert frontend appointment type → backend type */
export function toBackendApptType(type: Appointment['type']): string {
  if (type === 'video') return 'VIDEO';
  if (type === 'chat') return 'URGENT';
  return 'FOLLOWUP';
}

/**
 * Returns true if an appointment should be treated as expired on the client.
 *
 * Rules (in priority order):
 *  1. Backend already marked it NO_SHOW → expired.
 *  2. The scheduled DATE is before today → expired immediately (no grace needed;
 *     the entire calendar day has passed).
 *  3. The scheduled DATE is today but the scheduled time + 30-minute grace has
 *     passed → expired (doctor/patient had a window but neither joined).
 *
 * Only `scheduled` appointments can be expired — in-progress / completed /
 * cancelled appointments are already in a terminal or active state.
 */
export function isAppointmentExpired(apt: Appointment): boolean {
  if (apt.status === 'no-show') return true;
  if (apt.status !== 'scheduled' || !apt.scheduledAt) return false;

  const now   = new Date();
  const appt  = new Date(apt.scheduledAt);

  // Strip time → compare calendar dates only
  const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const apptDate  = new Date(appt.getFullYear(), appt.getMonth(), appt.getDate());

  if (apptDate < todayDate) return true;                          // past date → always expired
  if (apptDate.getTime() === todayDate.getTime()) {               // today → check grace period
    const GRACE_MS = 30 * 60 * 1000;
    return now.getTime() > appt.getTime() + GRACE_MS;
  }
  return false; // future date → not expired
}

/** Convert backend appointment status → frontend status */
export function fromBackendApptStatus(status: string): Appointment['status'] {
  if (status === 'SCHEDULED' || status === 'CONFIRMED' || status === 'PENDING') return 'scheduled';
  if (status === 'IN_PROGRESS') return 'in-progress';
  if (status === 'COMPLETED') return 'completed';
  if (status === 'NO_SHOW') return 'no-show';
  return 'cancelled';
}

/** Convert backend urgency → frontend severity */
export function fromBackendUrgency(urgency: string): SymptomCheck['severity'] {
  if (urgency === 'SELF_CARE') return 'mild';
  if (urgency === 'ROUTINE' || urgency === 'UNKNOWN') return 'moderate';
  if (urgency === 'URGENT') return 'severe';
  if (urgency === 'EMERGENCY') return 'severe';
  return 'moderate'; // safe default
}

/** Convert backend urgency → frontend recommendation */
export function fromBackendRecommendation(urgency: string): SymptomCheck['aiAssessment']['recommendation'] {
  if (urgency === 'SELF_CARE') return 'self-care';
  if (urgency === 'ROUTINE' || urgency === 'UNKNOWN') return 'routine';
  if (urgency === 'URGENT') return 'urgent';
  if (urgency === 'EMERGENCY') return 'emergency';
  return 'routine'; // safe default
}

/** Map ApiAppointmentDto → frontend Appointment */
export function mapApiAppointment(a: ApiAppointmentDto): Appointment {
  const dt = new Date(a.scheduledAt);
  return {
    id: a.appointmentId,
    patientId: a.patientId,
    patientName: a.patientName,
    doctorId: a.providerId,
    doctorName: a.providerName,
    doctorSpecialization: a.providerSpecialty ?? '',
    date: dt.toISOString().split('T')[0],
    time: dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    type: fromBackendApptType(a.type),
    status: fromBackendApptStatus(a.status),
    reason: a.cancellationReason || '',
    duration: 30,
    fee: a.fee,
    paymentStatus: a.paymentStatus,
    slotId: a.slotId,
    scheduledAt: a.scheduledAt,
  };
}

/** Map ApiSymptomReport → frontend SymptomCheck */
export function mapApiSymptomReport(r: ApiSymptomReport): SymptomCheck {
  const isLowConfidence = r.aiUrgency === 'UNKNOWN' && !r.isDegraded;
  return {
    id: r.reportId,
    userId: r.patientId,
    date: r.createdAt.split('T')[0],
    symptoms: r.symptoms.map(s => s.name || String(s)),
    severity: fromBackendUrgency(r.aiUrgency),
    duration: '',
    language: r.language,
    aiAssessment: {
      possibleConditions: [r.aiDisease].filter((v): v is string => Boolean(v)),
      confidence: Number(r.aiConfidence),
      recommendation: fromBackendRecommendation(r.aiUrgency),
      details: r.careRecommendation,
      isDegraded: r.isDegraded,
      isLowConfidence,
      specialistType: r.specialistType ?? null,
      selfCareTips: r.selfCareTips ?? [],
      followUpDays: r.followUpDays ?? null,
      topPredictions: r.top3Predictions ?? [],
      icd10: r.icd10 ?? null,
      explainingFactors: r.explaining_factors ?? [],
      modelVersion: r.model_version,
    },
  };
}

/**
 * Matches SymptomReportSummaryDto — returned by GET /patients/me/symptom-reports.
 * Lighter than the full ApiSymptomReport: no top3Predictions, no selfCareTips, etc.
 * but includes aiDisease + icd10 extracted server-side from the raw response.
 */
export interface ApiSymptomReportSummary {
  reportId: string;
  patientId: string;
  symptomText: string;
  language: string;
  aiUrgency: 'EMERGENCY' | 'URGENT' | 'ROUTINE' | 'SELF_CARE' | 'UNKNOWN';
  aiPathway: string | null;
  aiDisease: string | null;
  icd10: string | null;
  aiConfidence: number | null;
  careRecommendation: string | null;
  /** Canonical symptom name strings extracted from the stored symptoms column. */
  symptoms: string[];
  isDegraded: boolean;
  createdAt: string;
}

/** Map ApiSymptomReportSummary (history list) → frontend SymptomCheck */
export function mapApiSymptomReportSummary(r: ApiSymptomReportSummary): SymptomCheck {
  return {
    id: r.reportId,
    userId: r.patientId,
    date: r.createdAt.split('T')[0],
    // Summary stores canonical names (e.g. "high_fever"); display them as-is.
    symptoms: r.symptoms ?? [],
    severity: fromBackendUrgency(r.aiUrgency),
    duration: '',
    language: r.language,
    aiAssessment: {
      possibleConditions: r.aiDisease ? [r.aiDisease] : [],
      confidence: Number(r.aiConfidence ?? 0),
      recommendation: fromBackendRecommendation(r.aiUrgency),
      details: r.careRecommendation ?? '',
      isDegraded: r.isDegraded,
      icd10: r.icd10 ?? null,
    },
  };
}

/** Map ApiPrescriptionDto → frontend HealthRecord */
export function mapApiPrescription(p: ApiPrescriptionDto): HealthRecord {
  let meds: Medication[] = [];
  try { meds = JSON.parse(p.medications); } catch { /* ignore */ }
  return {
    id: p.prescriptionId,
    userId: p.patientId,
    type: 'prescription',
    date: p.issuedAt.split('T')[0],
    title: `Prescription - ${p.issuedAt.split('T')[0]}`,
    description: p.instructions,
    doctor: p.providerName,
    medications: meds,
  };
}
