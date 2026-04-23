package rw.shcp.appointments;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import rw.shcp.common.enums.AppointmentStatus;
import rw.shcp.users.model.Patient;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface AppointmentRepository extends JpaRepository<Appointment, UUID> {

        Page<Appointment> findByPatientUserId(UUID patientId, Pageable pageable);

        Page<Appointment> findByProviderUserId(UUID providerId, Pageable pageable);

        Optional<Appointment> findByAppointmentIdAndPatientUserId(UUID appointmentId, UUID patientId);

        Optional<Appointment> findByAppointmentIdAndProviderUserId(UUID appointmentId, UUID providerId);

        /**
         * Pre-insert double-booking guard — checked before the DB unique constraint
         * fires.
         */
        boolean existsByProviderUserIdAndScheduledAt(UUID providerId, OffsetDateTime scheduledAt);

        /**
         * Fetch confirmed appointments in a time window — used by the reminder
         * scheduler.
         */
        @Query("SELECT a FROM Appointment a " +
                        "WHERE a.scheduledAt BETWEEN :from AND :to " +
                        "AND a.status = :status")
        List<Appointment> findByScheduledAtBetweenAndStatus(
                        @Param("from") OffsetDateTime from,
                        @Param("to") OffsetDateTime to,
                        @Param("status") AppointmentStatus status);

        /**
         * Confirmed VIDEO appointments whose scheduled time has passed the given cutoff.
         * Used by the expiry scheduler to mark them NO_SHOW.
         */
        @Query("SELECT a FROM Appointment a " +
                        "WHERE a.status = :status " +
                        "AND a.type = rw.shcp.common.enums.AppointmentType.VIDEO " +
                        "AND a.scheduledAt < :cutoff")
        List<Appointment> findOverdueVideoAppointments(
                        @Param("status") AppointmentStatus status,
                        @Param("cutoff") OffsetDateTime cutoff);

        /**
         * IN_PROGRESS appointments older than the given cutoff — used to auto-close
         * consultations that were started but never ended (e.g. doctor forgot to end call).
         */
        @Query("SELECT a FROM Appointment a " +
                        "WHERE a.status = rw.shcp.common.enums.AppointmentStatus.IN_PROGRESS " +
                        "AND a.scheduledAt < :cutoff")
        List<Appointment> findStaleInProgressAppointments(
                        @Param("cutoff") OffsetDateTime cutoff);

        /** Distinct patients who have at least one appointment with this provider. */
        @Query("SELECT DISTINCT a.patient FROM Appointment a WHERE a.provider.userId = :providerId")
        List<Patient> findDistinctPatientsByProviderId(@Param("providerId") UUID providerId);
}
