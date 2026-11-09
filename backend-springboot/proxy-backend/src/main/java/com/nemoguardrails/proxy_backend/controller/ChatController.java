package com.nemoguardrails.proxy_backend.controller;

import com.nemoguardrails.proxy_backend.dto.ApiResponse;
import com.nemoguardrails.proxy_backend.dto.ChatRecordDTO;
import com.nemoguardrails.proxy_backend.entity.ChatMessageEntity;
import com.nemoguardrails.proxy_backend.entity.ChatSessionEntity;
import com.nemoguardrails.proxy_backend.entity.UserEntity;
import com.nemoguardrails.proxy_backend.service.ChatMessageService;
import com.nemoguardrails.proxy_backend.service.ChatSessionService;
import com.nemoguardrails.proxy_backend.service.UserService;
import com.nemoguardrails.proxy_backend.util.JwtUtil;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/v1/chat")
@CrossOrigin(origins = "*")
public class ChatController {

    private final ChatSessionService sessionService;
    private final ChatMessageService messageService;
    private final UserService userService;
    private final JwtUtil jwtUtil;

    public ChatController(
            ChatSessionService sessionService,
            ChatMessageService messageService,
            UserService userService,
            JwtUtil jwtUtil) {
        this.sessionService = sessionService;
        this.messageService = messageService;
        this.userService = userService;
        this.jwtUtil = jwtUtil;
    }

    private record UserAuthResult(JwtUtil.JwtClaims claims, ResponseEntity<ApiResponse<Void>> errorResponse) {}

    private UserAuthResult authenticateActiveUser(String authHeader) {
        Optional<JwtUtil.JwtClaims> claimsOpt = jwtUtil.verifyAuthorizationHeader(authHeader);
        if (claimsOpt.isEmpty()) {
            return new UserAuthResult(
                    null,
                    ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                            .body(new ApiResponse<>("error", "Phiên đăng nhập không hợp lệ hoặc đã hết hạn."))
            );
        }

        JwtUtil.JwtClaims claims = claimsOpt.get();
        Optional<UserEntity> userOpt = userService.getUserByUsername(claims.username());
        if (userOpt.isEmpty()) {
            return new UserAuthResult(
                    null,
                    ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                            .body(new ApiResponse<>("error", "Tài khoản không tồn tại trong hệ thống."))
            );
        }

        if (Boolean.FALSE.equals(userOpt.get().getIsActive())) {
            return new UserAuthResult(
                    null,
                    ResponseEntity.status(HttpStatus.FORBIDDEN)
                            .body(new ApiResponse<>("error", "Tài khoản của bạn đã bị khóa bởi Quản trị viên."))
            );
        }

        return new UserAuthResult(claims, null);
    }

    private <T> ResponseEntity<ApiResponse<T>> propagateDenied(ResponseEntity<ApiResponse<Void>> denied) {
        String msg = denied.getBody() != null ? denied.getBody().getMessage() : "Từ chối truy cập.";
        return ResponseEntity.status(denied.getStatusCode()).body(new ApiResponse<>("error", msg));
    }

    // 1. API lấy danh sách phiên chat theo đúng tài khoản đang đăng nhập (yêu cầu JWT hợp lệ + tài khoản đang hoạt động)
    @GetMapping("/sessions")
    public ResponseEntity<ApiResponse<List<ChatSessionEntity>>> getAllSessions(
            @RequestHeader(value = "Authorization", required = false) String authHeader) {
        UserAuthResult auth = authenticateActiveUser(authHeader);
        if (auth.errorResponse() != null) return propagateDenied(auth.errorResponse());

        try {
            List<ChatSessionEntity> sessions = sessionService.getSessionsByUsername(auth.claims().username());
            return ResponseEntity.ok(new ApiResponse<>("success", "Lấy danh sách phiên chat thành công!", sessions));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse<>("error", "Lỗi lấy danh sách phiên: " + e.getMessage()));
        }
    }

    // 2. API nội bộ cho Proxy Python ghi lại tin nhắn và cập nhật danh sách phiên
    @PostMapping("/record")
    public ApiResponse<String> recordChat(@RequestBody ChatRecordDTO recordDTO) {
        try {
            messageService.recordChat(recordDTO);
            return new ApiResponse<>("success", "Đã lưu lịch sử chat thành công!");
        } catch (Exception e) {
            return new ApiResponse<>("error", "Lỗi lưu lịch sử chat: " + e.getMessage());
        }
    }

    // 3. API tạo phiên chat mới (gắn chặt vào đúng user đang đăng nhập theo JWT)
    @PostMapping("/session")
    public ResponseEntity<ApiResponse<ChatSessionEntity>> createSession(
            @RequestBody ChatSessionEntity sessionEntity,
            @RequestHeader(value = "Authorization", required = false) String authHeader) {
        UserAuthResult auth = authenticateActiveUser(authHeader);
        if (auth.errorResponse() != null) return propagateDenied(auth.errorResponse());

        try {
            ChatSessionEntity newSession = sessionService.createSessionForUser(sessionEntity, auth.claims().username());
            return ResponseEntity.ok(new ApiResponse<>("success", "Tạo phiên chat mới thành công!", newSession));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(new ApiResponse<>("error", "Lỗi tạo phiên chat: " + e.getMessage()));
        }
    }

    // 4. API lấy lịch sử tin nhắn theo Query Param (?sessionId=...) - kiểm tra quyền sở hữu khi có JWT
    @GetMapping("/messages")
    public ResponseEntity<ApiResponse<List<ChatMessageEntity>>> getChatMessagesByQuery(
            @RequestParam(required = false, name = "sessionId") String sessionId,
            @RequestHeader(value = "Authorization", required = false) String authHeader) {
        try {
            if (authHeader != null && !authHeader.isBlank()) {
                UserAuthResult auth = authenticateActiveUser(authHeader);
                if (auth.errorResponse() != null) return propagateDenied(auth.errorResponse());

                if (sessionId != null && !sessionId.trim().isEmpty()) {
                    ChatSessionService.SessionAccessResult access =
                            sessionService.checkSessionAccess(sessionId, auth.claims().username());
                    if (access == ChatSessionService.SessionAccessResult.FORBIDDEN) {
                        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                                .body(new ApiResponse<>("error", "Bạn không có quyền truy cập lịch sử cuộc trò chuyện này."));
                    }
                }
            }

            if (sessionId == null || sessionId.trim().isEmpty()) {
                return ResponseEntity.ok(new ApiResponse<>("success", "Chưa có session được chọn", Collections.emptyList()));
            }
            List<ChatMessageEntity> history = messageService.getChatHistoryByUuid(sessionId);
            return ResponseEntity.ok(new ApiResponse<>("success", "Lấy lịch sử tin nhắn thành công!", history));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse<>("error", "Lỗi lấy lịch sử tin nhắn: " + e.getMessage()));
        }
    }

    // 5. API lấy lịch sử tin nhắn theo Path Variable (bắt buộc JWT + đúng chủ sở hữu phiên)
    @GetMapping("/{sessionId}/messages")
    public ResponseEntity<ApiResponse<List<ChatMessageEntity>>> getChatHistory(
            @PathVariable Long sessionId,
            @RequestHeader(value = "Authorization", required = false) String authHeader) {
        UserAuthResult auth = authenticateActiveUser(authHeader);
        if (auth.errorResponse() != null) return propagateDenied(auth.errorResponse());

        ChatSessionService.SessionAccessResult access =
                sessionService.checkSessionAccess(String.valueOf(sessionId), auth.claims().username());
        if (access == ChatSessionService.SessionAccessResult.FORBIDDEN) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(new ApiResponse<>("error", "Bạn không có quyền truy cập lịch sử cuộc trò chuyện này."));
        }
        if (access == ChatSessionService.SessionAccessResult.NOT_FOUND) {
            return ResponseEntity.ok(new ApiResponse<>("success", "Không tìm thấy phiên chat", Collections.emptyList()));
        }

        try {
            List<ChatMessageEntity> history = messageService.getChatHistory(sessionId);
            return ResponseEntity.ok(new ApiResponse<>("success", "Lấy lịch sử tin nhắn thành công!", history));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse<>("error", "Lỗi lấy lịch sử: " + e.getMessage()));
        }
    }

    // 6. API xóa một phiên chat của chính người dùng đang đăng nhập (chống IDOR)
    @DeleteMapping("/sessions/{sessionId}")
    public ResponseEntity<ApiResponse<String>> deleteSession(
            @PathVariable String sessionId,
            @RequestHeader(value = "Authorization", required = false) String authHeader) {
        UserAuthResult auth = authenticateActiveUser(authHeader);
        if (auth.errorResponse() != null) return propagateDenied(auth.errorResponse());

        try {
            ChatSessionService.SessionDeleteResult result =
                    sessionService.deleteSessionForUser(sessionId, auth.claims().username());
            if (result == ChatSessionService.SessionDeleteResult.FORBIDDEN) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body(new ApiResponse<>("error", "Bạn không có quyền xóa cuộc trò chuyện của người dùng khác."));
            }
            if (result == ChatSessionService.SessionDeleteResult.NOT_FOUND) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(new ApiResponse<>("error", "Không tìm thấy phiên chat để xóa."));
            }
            return ResponseEntity.ok(new ApiResponse<>("success", "Đã xóa cuộc trò chuyện thành công!"));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse<>("error", "Lỗi xóa phiên chat: " + e.getMessage()));
        }
    }

    // 7. API xóa toàn bộ lịch sử chat của riêng tài khoản đang đăng nhập (giữ nguyên dữ liệu người khác và log Admin)
    @DeleteMapping("/sessions")
    public ResponseEntity<ApiResponse<String>> deleteAllSessions(
            @RequestHeader(value = "Authorization", required = false) String authHeader) {
        UserAuthResult auth = authenticateActiveUser(authHeader);
        if (auth.errorResponse() != null) return propagateDenied(auth.errorResponse());

        try {
            sessionService.deleteAllSessionsForUser(auth.claims().username());
            return ResponseEntity.ok(new ApiResponse<>("success", "Đã xóa toàn bộ lịch sử trò chuyện của bạn!"));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse<>("error", "Lỗi xóa toàn bộ lịch sử: " + e.getMessage()));
        }
    }

    // 8. API nội bộ cho Proxy Python kiểm tra nhanh tài khoản có đang bị Admin khóa hay không
    @GetMapping("/account-status")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getAccountStatus(
            @RequestParam(name = "username", required = false) String username) {
        if (username == null || username.trim().isEmpty()) {
            return ResponseEntity.ok(new ApiResponse<>("success", "OK", Map.of("active", true)));
        }
        Optional<UserEntity> userOpt = userService.getUserByUsername(username.trim());
        boolean active = userOpt.map(u -> !Boolean.FALSE.equals(u.getIsActive())).orElse(true);
        return ResponseEntity.ok(new ApiResponse<>("success", "OK", Map.of(
                "username", username.trim(),
                "active", active
        )));
    }
}
