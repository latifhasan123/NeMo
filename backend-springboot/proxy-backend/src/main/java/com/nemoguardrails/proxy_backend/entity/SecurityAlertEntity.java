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

    @Column(name = "ip_address", nullable = false, length = 45)
    private String ipAddress;

    @Column(name = "threat_type", nullable = false)
    private String threatType; // Ví dụ: "Jailbreak", "Prompt Injection"

    @Column(name = "severity_level", nullable = false)
    private String severityLevel; // Ví dụ: "High", "Medium", "Low"

    @Column(name = "blocked_payload", columnDefinition = "TEXT")
    private String blockedPayload; // Câu lệnh độc hại bị chặn lại

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
    }

    // TODO: Generate Getters and Setters
}