package rw.shcp.users.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import rw.shcp.users.model.Patient;

import java.util.UUID;

@Repository
public interface PatientRepository extends JpaRepository<Patient, UUID> {

    /**
     * Count distinct patients who have at least one appointment with the given
     * provider.
     */
    @Query("SELECT COUNT(DISTINCT a.patient.userId) FROM Appointment a WHERE a.provider.userId = :providerId")
    long countDistinctByAppointments_Provider_UserId(@Param("providerId") UUID providerId);
}
