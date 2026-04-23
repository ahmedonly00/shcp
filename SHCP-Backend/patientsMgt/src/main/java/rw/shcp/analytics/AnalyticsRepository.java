package rw.shcp.analytics;

import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;
import rw.shcp.appointments.Appointment;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Read-only repository for cross-domain analytics queries.
 *
 * <p>Uses JPQL and native PostgreSQL queries to compute aggregates that
 * would require multiple round-trips if done via per-entity repositories.</p>
 */
@org.springframework.stereotype.Repository
public interface AnalyticsRepository extends Repository<Appointment, UUID> {

    // ── Appointment counts by status ──────────────────────────────────────────

    @Query("SELECT COUNT(a) FROM Appointment a WHERE a.status = rw.shcp.common.enums.AppointmentStatus.PENDING")
    long countAppointmentsPending();

    @Query("SELECT COUNT(a) FROM Appointment a WHERE a.status = rw.shcp.common.enums.AppointmentStatus.CONFIRMED")
    long countAppointmentsConfirmed();

    @Query("SELECT COUNT(a) FROM Appointment a WHERE a.status = rw.shcp.common.enums.AppointmentStatus.IN_PROGRESS")
    long countAppointmentsInProgress();

    @Query("SELECT COUNT(a) FROM Appointment a WHERE a.status = rw.shcp.common.enums.AppointmentStatus.COMPLETED")
    long countAppointmentsCompleted();

    @Query("SELECT COUNT(a) FROM Appointment a WHERE a.status = rw.shcp.common.enums.AppointmentStatus.CANCELLED")
    long countAppointmentsCancelled();

    @Query("SELECT COUNT(a) FROM Appointment a WHERE a.status = rw.shcp.common.enums.AppointmentStatus.NO_SHOW")
    long countAppointmentsNoShow();

    // ── Provider-scoped appointment counts by status ───────────────────────────

    @Query("SELECT COUNT(a) FROM Appointment a WHERE a.provider.userId = :pid AND a.status = rw.shcp.common.enums.AppointmentStatus.PENDING")
    long countProviderAppointmentsPending(@Param("pid") UUID providerId);

    @Query("SELECT COUNT(a) FROM Appointment a WHERE a.provider.userId = :pid AND a.status = rw.shcp.common.enums.AppointmentStatus.CONFIRMED")
    long countProviderAppointmentsConfirmed(@Param("pid") UUID providerId);

    @Query("SELECT COUNT(a) FROM Appointment a WHERE a.provider.userId = :pid AND a.status = rw.shcp.common.enums.AppointmentStatus.IN_PROGRESS")
    long countProviderAppointmentsInProgress(@Param("pid") UUID providerId);

    @Query("SELECT COUNT(a) FROM Appointment a WHERE a.provider.userId = :pid AND a.status = rw.shcp.common.enums.AppointmentStatus.COMPLETED")
    long countProviderAppointmentsCompleted(@Param("pid") UUID providerId);

    @Query("SELECT COUNT(a) FROM Appointment a WHERE a.provider.userId = :pid AND a.status = rw.shcp.common.enums.AppointmentStatus.CANCELLED")
    long countProviderAppointmentsCancelled(@Param("pid") UUID providerId);

    @Query("SELECT COUNT(a) FROM Appointment a WHERE a.provider.userId = :pid AND a.status = rw.shcp.common.enums.AppointmentStatus.NO_SHOW")
    long countProviderAppointmentsNoShow(@Param("pid") UUID providerId);

    // ── Patient-scoped appointment counts by status ────────────────────────────

    @Query("SELECT COUNT(a) FROM Appointment a WHERE a.patient.userId = :pid AND a.status = rw.shcp.common.enums.AppointmentStatus.PENDING")
    long countPatientAppointmentsPending(@Param("pid") UUID patientId);

    @Query("SELECT COUNT(a) FROM Appointment a WHERE a.patient.userId = :pid AND a.status = rw.shcp.common.enums.AppointmentStatus.CONFIRMED")
    long countPatientAppointmentsConfirmed(@Param("pid") UUID patientId);

    @Query("SELECT COUNT(a) FROM Appointment a WHERE a.patient.userId = :pid AND a.status = rw.shcp.common.enums.AppointmentStatus.IN_PROGRESS")
    long countPatientAppointmentsInProgress(@Param("pid") UUID patientId);

    @Query("SELECT COUNT(a) FROM Appointment a WHERE a.patient.userId = :pid AND a.status = rw.shcp.common.enums.AppointmentStatus.COMPLETED")
    long countPatientAppointmentsCompleted(@Param("pid") UUID patientId);

    @Query("SELECT COUNT(a) FROM Appointment a WHERE a.patient.userId = :pid AND a.status = rw.shcp.common.enums.AppointmentStatus.CANCELLED")
    long countPatientAppointmentsCancelled(@Param("pid") UUID patientId);

    @Query("SELECT COUNT(a) FROM Appointment a WHERE a.patient.userId = :pid AND a.status = rw.shcp.common.enums.AppointmentStatus.NO_SHOW")
    long countPatientAppointmentsNoShow(@Param("pid") UUID patientId);

    @Query("SELECT COUNT(a) FROM Appointment a WHERE a.patient.userId = :pid AND a.scheduledAt > :now AND a.status IN (rw.shcp.common.enums.AppointmentStatus.CONFIRMED, rw.shcp.common.enums.AppointmentStatus.PENDING)")
    long countPatientUpcomingAppointments(@Param("pid") UUID patientId, @Param("now") OffsetDateTime now);

    // ── Consultation aggregates ────────────────────────────────────────────────

    @Query("SELECT COUNT(c) FROM Consultation c WHERE c.status = rw.shcp.common.enums.ConsultationStatus.COMPLETED")
    long countCompletedConsultations();

    @Query("SELECT COALESCE(AVG(c.durationMinutes), 0.0) FROM Consultation c WHERE c.durationMinutes IS NOT NULL")
    double avgConsultationDurationMinutes();

    @Query("SELECT COUNT(c) FROM Consultation c WHERE c.appointment.provider.userId = :pid")
    long countConsultationsByProvider(@Param("pid") UUID providerId);

    @Query("SELECT COUNT(c) FROM Consultation c WHERE c.appointment.provider.userId = :pid AND c.status = rw.shcp.common.enums.ConsultationStatus.COMPLETED")
    long countCompletedConsultationsByProvider(@Param("pid") UUID providerId);

    @Query("SELECT COALESCE(AVG(c.durationMinutes), 0.0) FROM Consultation c WHERE c.appointment.provider.userId = :pid AND c.durationMinutes IS NOT NULL")
    double avgConsultationDurationByProvider(@Param("pid") UUID providerId);

    @Query("SELECT COUNT(c) FROM Consultation c WHERE c.appointment.patient.userId = :pid")
    long countConsultationsByPatient(@Param("pid") UUID patientId);

    // ── Prescription aggregates ────────────────────────────────────────────────

    // "Active" = not yet in a terminal state (DELIVERED / FAILED / CANCELLED / EXPIRED)
    @Query("""
            SELECT COUNT(p) FROM Prescription p
            WHERE p.status NOT IN (
                rw.shcp.common.enums.PrescriptionStatus.DELIVERED,
                rw.shcp.common.enums.PrescriptionStatus.FAILED,
                rw.shcp.common.enums.PrescriptionStatus.CANCELLED,
                rw.shcp.common.enums.PrescriptionStatus.EXPIRED)
            """)
    long countActivePrescriptions();

    @Query("SELECT COUNT(p) FROM Prescription p WHERE p.provider.userId = :pid")
    long countPrescriptionsByProvider(@Param("pid") UUID providerId);

    @Query("""
            SELECT COUNT(p) FROM Prescription p
            WHERE p.provider.userId = :pid
              AND p.status NOT IN (
                rw.shcp.common.enums.PrescriptionStatus.DELIVERED,
                rw.shcp.common.enums.PrescriptionStatus.FAILED,
                rw.shcp.common.enums.PrescriptionStatus.CANCELLED,
                rw.shcp.common.enums.PrescriptionStatus.EXPIRED)
            """)
    long countActivePrescriptionsByProvider(@Param("pid") UUID providerId);

    @Query("SELECT COUNT(p) FROM Prescription p WHERE p.patient.userId = :pid")
    long countPrescriptionsByPatient(@Param("pid") UUID patientId);

    @Query("""
            SELECT COUNT(p) FROM Prescription p
            WHERE p.patient.userId = :pid
              AND p.status NOT IN (
                rw.shcp.common.enums.PrescriptionStatus.DELIVERED,
                rw.shcp.common.enums.PrescriptionStatus.FAILED,
                rw.shcp.common.enums.PrescriptionStatus.CANCELLED,
                rw.shcp.common.enums.PrescriptionStatus.EXPIRED)
            """)
    long countActivePrescriptionsByPatient(@Param("pid") UUID patientId);

    // ── Symptom report aggregates ──────────────────────────────────────────────

    @Query("SELECT COUNT(s) FROM SymptomReport s WHERE s.patient.userId = :pid")
    long countSymptomReportsByPatient(@Param("pid") UUID patientId);

    /**
     * Urgency distribution for a patient — returns Object[]{aiUrgency, count}.
     * Groups by the denormalised ai_urgency column set by the AI service.
     */
    @Query("SELECT s.aiUrgency, COUNT(s) FROM SymptomReport s " +
           "WHERE s.patient.userId = :pid " +
           "GROUP BY s.aiUrgency")
    List<Object[]> urgencyDistributionByPatient(@Param("pid") UUID patientId);

    // ── Time-series (native SQL, PostgreSQL DATE_TRUNC) ────────────────────────

    /**
     * New user registrations per day for the last N days.
     * Returns Object[]{date::text, count}.
     */
    @Query(value = """
            SELECT TO_CHAR(DATE_TRUNC('day', created_at), 'YYYY-MM-DD') AS day,
                   COUNT(*) AS cnt
            FROM   users
            WHERE  created_at >= NOW() - (:days || ' days')::interval
            GROUP  BY day
            ORDER  BY day
            """, nativeQuery = true)
    List<Object[]> registrationsPerDay(@Param("days") int days);

    /**
     * Appointment bookings per day for the last N days.
     * Returns Object[]{date::text, count}.
     */
    @Query(value = """
            SELECT TO_CHAR(DATE_TRUNC('day', created_at), 'YYYY-MM-DD') AS day,
                   COUNT(*) AS cnt
            FROM   appointments
            WHERE  created_at >= NOW() - (:days || ' days')::interval
            GROUP  BY day
            ORDER  BY day
            """, nativeQuery = true)
    List<Object[]> appointmentsPerDay(@Param("days") int days);

    // ── Date-range queries (for MOH Report Generator) ─────────────────────────

    @Query("SELECT COUNT(c) FROM Consultation c WHERE c.createdAt BETWEEN :from AND :to")
    long countConsultationsInRange(@Param("from") java.time.OffsetDateTime from,
                                   @Param("to")   java.time.OffsetDateTime to);

    @Query("SELECT COUNT(c) FROM Consultation c WHERE c.status = rw.shcp.common.enums.ConsultationStatus.COMPLETED AND c.createdAt BETWEEN :from AND :to")
    long countCompletedConsultationsInRange(@Param("from") java.time.OffsetDateTime from,
                                            @Param("to")   java.time.OffsetDateTime to);

    @Query("SELECT COALESCE(AVG(c.durationMinutes), 0.0) FROM Consultation c WHERE c.durationMinutes IS NOT NULL AND c.createdAt BETWEEN :from AND :to")
    double avgConsultationDurationInRange(@Param("from") java.time.OffsetDateTime from,
                                          @Param("to")   java.time.OffsetDateTime to);

    @Query("SELECT COUNT(a) FROM Appointment a WHERE a.createdAt BETWEEN :from AND :to")
    long countAppointmentsInRange(@Param("from") java.time.OffsetDateTime from,
                                  @Param("to")   java.time.OffsetDateTime to);

    @Query("SELECT COUNT(a) FROM Appointment a WHERE a.status = rw.shcp.common.enums.AppointmentStatus.COMPLETED AND a.createdAt BETWEEN :from AND :to")
    long countCompletedAppointmentsInRange(@Param("from") java.time.OffsetDateTime from,
                                           @Param("to")   java.time.OffsetDateTime to);

    @Query("SELECT COUNT(a) FROM Appointment a WHERE a.status = rw.shcp.common.enums.AppointmentStatus.CANCELLED AND a.createdAt BETWEEN :from AND :to")
    long countCancelledAppointmentsInRange(@Param("from") java.time.OffsetDateTime from,
                                           @Param("to")   java.time.OffsetDateTime to);

    @Query("SELECT COUNT(s) FROM SymptomReport s WHERE s.createdAt BETWEEN :from AND :to")
    long countSymptomReportsInRange(@Param("from") java.time.OffsetDateTime from,
                                    @Param("to")   java.time.OffsetDateTime to);

    @Query("SELECT COUNT(p) FROM Prescription p WHERE p.issuedAt BETWEEN :from AND :to")
    long countPrescriptionsInRange(@Param("from") java.time.OffsetDateTime from,
                                   @Param("to")   java.time.OffsetDateTime to);

    @Query("""
            SELECT COUNT(p) FROM Prescription p
            WHERE p.issuedAt BETWEEN :from AND :to
              AND p.status NOT IN (
                rw.shcp.common.enums.PrescriptionStatus.DELIVERED,
                rw.shcp.common.enums.PrescriptionStatus.FAILED,
                rw.shcp.common.enums.PrescriptionStatus.CANCELLED,
                rw.shcp.common.enums.PrescriptionStatus.EXPIRED)
            """)
    long countActivePrescriptionsInRange(@Param("from") java.time.OffsetDateTime from,
                                         @Param("to")   java.time.OffsetDateTime to);

    @Query("SELECT COUNT(u) FROM User u WHERE u.role = rw.shcp.common.enums.Role.PATIENT AND u.createdAt BETWEEN :from AND :to")
    long countNewPatientsInRange(@Param("from") java.time.OffsetDateTime from,
                                 @Param("to")   java.time.OffsetDateTime to);

    @Query("SELECT COUNT(u) FROM User u WHERE u.role = rw.shcp.common.enums.Role.PROVIDER AND u.createdAt BETWEEN :from AND :to")
    long countNewProvidersInRange(@Param("from") java.time.OffsetDateTime from,
                                  @Param("to")   java.time.OffsetDateTime to);

    @Query(value = """
            SELECT TO_CHAR(DATE_TRUNC('day', created_at), 'YYYY-MM-DD') AS day,
                   COUNT(*) AS cnt
            FROM   appointments
            WHERE  created_at BETWEEN :from AND :to
            GROUP  BY day
            ORDER  BY day
            """, nativeQuery = true)
    List<Object[]> appointmentsPerDayInRange(@Param("from") java.time.OffsetDateTime from,
                                             @Param("to")   java.time.OffsetDateTime to);

    @Query(value = """
            SELECT TO_CHAR(DATE_TRUNC('day', created_at), 'YYYY-MM-DD') AS day,
                   COUNT(*) AS cnt
            FROM   users
            WHERE  created_at BETWEEN :from AND :to
            GROUP  BY day
            ORDER  BY day
            """, nativeQuery = true)
    List<Object[]> registrationsPerDayInRange(@Param("from") java.time.OffsetDateTime from,
                                              @Param("to")   java.time.OffsetDateTime to);

    // ── Provider counts ────────────────────────────────────────────────────────

    @Query("SELECT COUNT(p) FROM Provider p WHERE p.isActive = true")
    long countActiveProviders();

    // ── Platform-wide entity totals ────────────────────────────────────────────

    @Query("SELECT COUNT(c) FROM Consultation c")
    long countAllConsultations();

    @Query("SELECT COUNT(s) FROM SymptomReport s")
    long countAllSymptomReports();

    @Query("SELECT COUNT(p) FROM Prescription p")
    long countAllPrescriptions();
}
