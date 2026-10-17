package com.nemoguardrails.proxy_backend.repository;

import com.nemoguardrails.proxy_backend.entity.ChatMessageEntity;
import org.springframework.data.jpa.repository.JpaRepository;


import java.util.List;


public interface ChatMessageRepository extends JpaRepository<ChatMessageEntity, Long> {
    
    // Lấy toàn bộ lịch sử tin nhắn của một phiên chat, sắp xếp theo thời gian
    List<ChatMessageEntity> findBySessionIdOrderByCreatedAtAsc(Long sessionId);
}