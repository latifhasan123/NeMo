package com.nemoguardrails.proxy_backend.controller;

import com.nemoguardrails.proxy_backend.dto.ApiResponse;
import com.nemoguardrails.proxy_backend.dto.ChatRecordDTO;
import com.nemoguardrails.proxy_backend.entity.ChatMessageEntity;
import com.nemoguardrails.proxy_backend.entity.ChatSessionEntity;
import com.nemoguardrails.proxy_backend.service.ChatMessageService;
import com.nemoguardrails.proxy_backend.service.ChatSessionService;
import org.springframework.web.bind.annotation.*;

import java.util.Collections;
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

    // 1. API lấy danh sách tất cả các phiên chat (được gọi từ Frontend Sidebar)
    // GET http://localhost:8080/api/v1/chat/sessions
    @GetMapping("/sessions")
    public ApiResponse<List<ChatSessionEntity>> getAllSessions() {
        try {
            List<ChatSessionEntity> sessions = sessionService.getAllSessions();
            return new ApiResponse<>("success", "Lấy danh sách phiên chat thành công!", sessions);
        } catch (Exception e) {
            return new ApiResponse<>("error", "Lỗi lấy danh sách phiên: " + e.getMessage());
        }
    }

    // 2. API cho Proxy Python: Tự động ghi lại tin nhắn và cập nhật danh sách phiên
    // POST http://localhost:8080/api/v1/chat/record
    @PostMapping("/record")
    public ApiResponse<String> recordChat(@RequestBody ChatRecordDTO recordDTO) {
        try {
            messageService.recordChat(recordDTO);
            return new ApiResponse<>("success", "Đã lưu lịch sử chat thành công!");
        } catch (Exception e) {
            return new ApiResponse<>("error", "Lỗi lưu lịch sử chat: " + e.getMessage());
        }
    }

    // 3. API tạo phiên chat mới khi người dùng bắt đầu cuộc trò chuyện (thủ công)
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

    // 4. API lấy lịch sử tin nhắn của một phiên chat theo Query Param (Frontend dùng: ?sessionId=...)
    // GET http://localhost:8080/api/v1/chat/messages?sessionId=...
    @GetMapping("/messages")
    public ApiResponse<List<ChatMessageEntity>> getChatMessagesByQuery(
            @RequestParam(required = false, name = "sessionId") String sessionId) {
        try {
            if (sessionId == null || sessionId.trim().isEmpty()) {
                return new ApiResponse<>("success", "Chưa có session được chọn", Collections.emptyList());
            }
            List<ChatMessageEntity> history = messageService.getChatHistoryByUuid(sessionId);
            return new ApiResponse<>("success", "Lấy lịch sử tin nhắn thành công!", history);
        } catch (Exception e) {
            return new ApiResponse<>("error", "Lỗi lấy lịch sử tin nhắn: " + e.getMessage());
        }
    }

    // 5. API lấy lịch sử tin nhắn theo Path Variable (hỗ trợ cách gọi cũ)
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
