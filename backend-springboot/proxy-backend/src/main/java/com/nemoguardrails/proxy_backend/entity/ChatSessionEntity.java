package com.nemoguardrails.proxy_backend.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Getter 
@Setter 
@Table(name = "chat_sessions")
public class ChatSessionEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // Liên kết Many-To-One với bảng users (Nhiều phiên chat thuộc về 1 user)
    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private UserEntity user;

    @Column(name = "session_name", length = 100)
    private String sessionName;

    @Column(name = "session_uuid", nullable = false, unique = true)
    private String sessionUuid; // Mã phiên chat từ frontend hoặc Python gửi qua

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    // Getter bổ trợ để Frontend Sidebar đọc được tiêu đề
    public String getTitle() {
        return (sessionName != null && !sessionName.trim().isEmpty()) ? sessionName : "Cuộc trò chuyện mới";
    }

    public String getName() {
        return getTitle();
    }

    public Long getUserId() {
        return user != null ? user.getId() : null;
    }

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = LocalDateTime.now();
    }
}
