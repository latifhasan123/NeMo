package com.nemoguardrails.proxy_backend.dto;

import java.time.LocalDateTime;
import lombok.Data;
@Data
public class ChatSessionDTO {
    private String sessionUuid;
    private LocalDateTime createdAt;
    // Tùy chọn: Có thể nhét thêm username vào đây nếu frontend cần hiển thị người tạo phiên chat

    // TODO: Generate Getters và Setters
}