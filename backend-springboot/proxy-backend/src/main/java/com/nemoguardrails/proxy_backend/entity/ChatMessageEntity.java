package com.nemoguardrails.proxy_backend.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Getter 
@Setter 
@Table(name = "chat_messages")
public class ChatMessageEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // Liên kết với bảng chat_sessions
    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "session_id", nullable = false)
    private ChatSessionEntity session;

    @Column(name = "sender_type", nullable = false)
    private String senderType; // ENUM: "USER", "AI", "SYSTEM"

    @Column(name = "sender_role", nullable = false)
    private String senderRole; // Ví dụ: "user", "assistant", "bot"

    @Column(columnDefinition = "TEXT", nullable = false)
    private String content; // Nội dung tin nhắn

    @Column(name = "ai_latency_ms")
    private Integer aiLatencyMs; // Thời gian AI xử lý

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    public Long getSessionId() {
        return session != null ? session.getId() : null;
    }

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
    }
}
