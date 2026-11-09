package com.nemoguardrails.proxy_backend.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Getter
@Setter
@Table(name = "security_alerts")
public class SecurityAlertEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "username", length = 50)
    private String username; // Tài khoản thực hiện yêu cầu vi phạm (để Admin truy vết & khóa)

    @Column(name = "ip_address", nullable = false, length = 45)
    private String ipAddress;

    @Column(name = "threat_type", nullable = false)
    private String threatType; // Ví dụ: "JAILBREAK", "PROMPT_LEAKAGE"

    @Column(name = "severity_level", nullable = false)
    private String severityLevel; // Ví dụ: "HIGH", "CRITICAL", "MEDIUM"

    @Column(name = "blocked_payload", columnDefinition = "TEXT")
    private String blockedPayload; // Câu lệnh độc hại bị chặn lại

    @Column(name = "latency_ms")
    private Integer latencyMs; // Độ trễ xử lý yêu cầu (ms)

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
    }
}
