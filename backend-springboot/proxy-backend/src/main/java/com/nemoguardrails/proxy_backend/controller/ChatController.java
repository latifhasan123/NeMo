package com.nemoguardrails.proxy_backend.controller;

import com.nemoguardrails.proxy_backend.dto.ApiResponse;
import com.nemoguardrails.proxy_backend.entity.ChatMessageEntity;
import com.nemoguardrails.proxy_backend.entity.ChatSessionEntity;
import com.nemoguardrails.proxy_backend.service.ChatMessageService;
import com.nemoguardrails.proxy_backend.service.ChatSessionService;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/chat")
@CrossOrigin(origins = "*")
public class ChatController {

    private final ChatSessionService sessionService;
    private final ChatMessageService messageService;

    public ChatController(ChatSessionService sessionService, ChatMessageService messageService) {
        this.sessionService = sessionService;
        this.messageService = messageService;
    }

    // API tạo phiên chat mới khi người dùng vừa vào trang web
    // POST http://localhost:8080/api/v1/chat/session
    @PostMapping("/session")
    public ApiResponse<ChatSessionEntity> createSession(@RequestBody ChatSessionEntity sessionEntity) {
        try {
            ChatSessionEntity newSession = sessionService.createSession(sessionEntity);
            return new ApiResponse<>("success", "Tạo phiên chat mới thành công!", newSession);
        } catch (Exception e) {
            return new ApiResponse<>("error", "Lỗi tạo phiên chat: " + e.getMessage());
        }
    }

    // API lấy lịch sử tin nhắn của một phiên chat cụ thể
    // GET http://localhost:8080/api/v1/chat/{sessionId}/messages
    @GetMapping("/{sessionId}/messages")
    public ApiResponse<List<ChatMessageEntity>> getChatHistory(@PathVariable Long sessionId) {
        try {
            List<ChatMessageEntity> history = messageService.getChatHistory(sessionId);
            return new ApiResponse<>("success", "Lấy lịch sử tin nhắn thành công!", history);
        } catch (Exception e) {
            return new ApiResponse<>("error", "Lỗi lấy lịch sử: " + e.getMessage());
        }
    }
}