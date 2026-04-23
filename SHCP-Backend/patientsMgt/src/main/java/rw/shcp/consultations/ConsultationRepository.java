package rw.shcp.consultations;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import rw.shcp.common.enums.ConsultationStatus;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ConsultationRepository extends JpaRepository<Consultation, UUID> {

    Optional<Consultation> findByAppointment_AppointmentId(UUID appointmentId);

    List<Consultation> findByAppointment_Patient_UserIdOrderByCreatedAtDesc(UUID patientUserId);

    List<Consultation> findByAppointment_Provider_UserIdOrderByCreatedAtDesc(UUID providerUserId);

    boolean existsByAppointment_AppointmentIdAndStatusNot(UUID appointmentId, ConsultationStatus status);
}
