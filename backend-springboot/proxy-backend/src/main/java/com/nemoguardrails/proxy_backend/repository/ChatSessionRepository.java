package com.nemoguardrails.proxy_backend.repository;

import com.nemoguardrails.proxy_backend.entity.ChatSessionEntity;
import org.springframework.data.jpa.repository.JpaRepository;


import java.util.Optional;


public interface ChatSessionRepository extends JpaRepository<ChatSessionEntity, Long> {
    
    // Tìm phiên chat theo mã UUID
    Optional<ChatSessionEntity> findBySessionUuid(String sessionUuid);
}