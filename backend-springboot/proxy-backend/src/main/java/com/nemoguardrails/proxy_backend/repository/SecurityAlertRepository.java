package com.nemoguardrails.proxy_backend.repository;

import com.nemoguardrails.proxy_backend.entity.SecurityAlertEntity;
import org.springframework.data.jpa.repository.JpaRepository;



public interface SecurityAlertRepository extends JpaRepository<SecurityAlertEntity, Long> {
    // Tạm thời chưa cần hàm custom nào, các hàm save(), findAll() đã có sẵn hết rồi.
}