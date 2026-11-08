package com.nemoguardrails.proxy_backend.repository;

import com.nemoguardrails.proxy_backend.entity.ChatMessageEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface ChatMessageRepository extends JpaRepository<ChatMessageEntity, Long> {
    
    // 1. Lấy toàn bộ lịch sử tin nhắn theo Session ID (thông qua khóa ngoại c.session.id)
    @Query("SELECT c FROM ChatMessageEntity c WHERE c.session.id = :sessionId ORDER BY c.createdAt ASC")
    List<ChatMessageEntity> findBySessionIdOrderByCreatedAtAsc(@Param("sessionId") Long sessionId);

    // 2. Lấy toàn bộ lịch sử tin nhắn trực tiếp theo Session UUID
    @Query("SELECT c FROM ChatMessageEntity c WHERE c.session.sessionUuid = :sessionUuid ORDER BY c.createdAt ASC")
    List<ChatMessageEntity> findBySessionUuidOrderByCreatedAtAsc(@Param("sessionUuid") String sessionUuid);
}
