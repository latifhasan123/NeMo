package com.nemoguardrails.proxy_backend.dto;

import java.time.LocalDateTime;
import lombok.Data;
@Data
public class ChatMessageDTO {
    
    private String sessionUuid; // Cần biết tin nhắn này thuộc về phiên chat nào
    private String senderRole;  // "user", "bot", hoặc "system"
    private String content;     // Nội dung tin nhắn
    private LocalDateTime createdAt;

    // TODO: Generate Getters và Setters
}