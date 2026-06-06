package rw.shcp.consultations;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import rw.shcp.common.enums.ConsultationStatus;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ConsultationRepository extends JpaRepository<Consultation, UUID> {

    Optional<Consultation> findByAppointment_AppointmentId(UUID appointmentId);

    List<Consultation> findByAppointment_Patient_UserIdOrderByCreatedAtDesc(UUID patientUserId);

    List<Consultation> findByAppointment_Provider_UserIdOrderByCreatedAtDesc(UUID providerUserId);

    boolean existsByAppointment_AppointmentIdAndStatusNot(UUID appointmentId, ConsultationStatus status);

    /** Consultations by provider within a date range, newest first — for the provider report. */
    List<Consultation> findByAppointment_Provider_UserIdAndStatusAndCreatedAtBetweenOrderByCreatedAtDesc(
            UUID providerUserId, ConsultationStatus status, OffsetDateTime from, OffsetDateTime to);

    @org.springframework.data.jpa.repository.Query(
        "SELECT c FROM Consultation c " +
        "WHERE c.appointment.provider.userId = :providerId " +
        "AND c.appointment.type = rw.shcp.common.enums.AppointmentType.INSTANT " +
        "AND c.status = rw.shcp.common.enums.ConsultationStatus.IN_PROGRESS " +
        "ORDER BY c.createdAt DESC")
    java.util.List<Consultation> findIncomingInstantByProviderId(
        @org.springframework.data.repository.query.Param("providerId") UUID providerId);
}
