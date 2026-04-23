package rw.shcp.users.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import rw.shcp.users.model.Provider;

import java.util.UUID;

@Repository
public interface ProviderRepository extends JpaRepository<Provider, UUID> {
}
