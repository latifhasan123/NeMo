package com.nemoguardrails.proxy_backend.entity;

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
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "session_id", nullable = false)
    private ChatSessionEntity session;

    @Column(name = "sender_role", nullable = false)
    private String senderRole; // Ví dụ: "user", "bot", "system"

    @Column(columnDefinition = "TEXT", nullable = false)
    private String content; // Nội dung tin nhắn (dùng TEXT vì tin nhắn có thể dài)

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
    }

    // TODO: Generate Getters and Setters
}