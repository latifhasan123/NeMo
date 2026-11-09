package com.nemoguardrails.proxy_backend.repository;

import com.nemoguardrails.proxy_backend.entity.ChatMessageEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;

public interface ChatMessageRepository extends JpaRepository<ChatMessageEntity, Long> {
    
    // 1. Lấy toàn bộ lịch sử tin nhắn theo Session ID (thông qua khóa ngoại c.session.id)
    @Query("SELECT c FROM ChatMessageEntity c WHERE c.session.id = :sessionId ORDER BY c.createdAt ASC")
    List<ChatMessageEntity> findBySessionIdOrderByCreatedAtAsc(@Param("sessionId") Long sessionId);

    // 2. Lấy toàn bộ lịch sử tin nhắn trực tiếp theo Session UUID
    @Query("SELECT c FROM ChatMessageEntity c WHERE c.session.sessionUuid = :sessionUuid ORDER BY c.createdAt ASC")
    List<ChatMessageEntity> findBySessionUuidOrderByCreatedAtAsc(@Param("sessionUuid") String sessionUuid);

    // 3. Xóa toàn bộ tin nhắn thuộc một phiên chat (tránh lỗi khóa ngoại khi xóa session)
    @Modifying
    @Query("DELETE FROM ChatMessageEntity c WHERE c.session.id = :sessionId")
    void deleteBySessionId(@Param("sessionId") Long sessionId);

    // 4. Xóa toàn bộ tin nhắn của mọi phiên chat
    @Modifying
    @Query("DELETE FROM ChatMessageEntity")
    void deleteAllMessages();

    // 5. Thống kê độ trễ trung bình thực tế từ lịch sử xử lý Proxy/AI
    @Query("SELECT AVG(c.aiLatencyMs) FROM ChatMessageEntity c WHERE c.aiLatencyMs IS NOT NULL AND c.aiLatencyMs >= 0")
    Double findAverageLatencyMs();

    // 6. Đếm tổng số prompt người dùng gửi vào hệ thống
    @Query("SELECT COUNT(c) FROM ChatMessageEntity c WHERE LOWER(c.senderRole) = 'user'")
    long countUserMessages();

    // 7. Lấy danh sách mốc thời gian prompt người dùng để dựng biểu đồ lưu lượng theo ngày
    @Query("SELECT c.createdAt FROM ChatMessageEntity c WHERE LOWER(c.senderRole) = 'user' AND c.createdAt IS NOT NULL")
    List<LocalDateTime> findAllUserMessageTimestamps();
}
