package com.nemoguardrails.proxy_backend.dto;

import java.time.LocalDateTime;
import lombok.Data;
@Data
public class SecurityAlertDTO {
    
    // Tên biến ở đây bắt buộc phải viết theo chuẩn camelCase. 
    // Khi Spring Boot xuất ra JSON, nó sẽ thành "ipAddress", "threatType"... y hệt như đã dặn 2 ông kia.
    private String ipAddress;
    private String threatType;
    private String severityLevel;
    private String blockedPayload;
    private LocalDateTime createdAt;

    // TODO: Bạn nhớ Generate Getters và Setters cho tất cả các biến nhé
    // (Chuột phải -> Source Action -> Generate Getters and Setters)
}