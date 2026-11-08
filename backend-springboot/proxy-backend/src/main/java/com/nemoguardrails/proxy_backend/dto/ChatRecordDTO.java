package com.nemoguardrails.proxy_backend.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ChatRecordDTO {
    private String username;
    private String sessionUuid;
    private String userMessage;
    private String botResponse;
    private Integer latencyMs;
    private Boolean isBlocked;
}
