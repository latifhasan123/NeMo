package com.nemoguardrails.proxy_backend.repository;

import com.nemoguardrails.proxy_backend.entity.SecurityAlertEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface SecurityAlertRepository extends JpaRepository<SecurityAlertEntity, Long> {

    // Sắp xếp cảnh báo mới nhất lên đầu để tiện theo dõi khi Live Demo
    List<SecurityAlertEntity> findAllByOrderByIdDesc();

    @Query("SELECT COUNT(DISTINCT s.ipAddress) FROM SecurityAlertEntity s WHERE s.ipAddress IS NOT NULL")
    long countDistinctIpAddresses();

    @Query("SELECT AVG(s.latencyMs) FROM SecurityAlertEntity s WHERE s.latencyMs IS NOT NULL AND s.latencyMs >= 0")
    Double findAverageAlertLatencyMs();
}
