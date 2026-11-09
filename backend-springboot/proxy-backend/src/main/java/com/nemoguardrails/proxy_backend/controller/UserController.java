package com.nemoguardrails.proxy_backend.controller;

import com.nemoguardrails.proxy_backend.dto.ApiResponse;
import com.nemoguardrails.proxy_backend.entity.UserEntity;
import com.nemoguardrails.proxy_backend.service.UserService;
import com.nemoguardrails.proxy_backend.util.JwtUtil;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/v1/users")
@CrossOrigin(origins = "*")
public class UserController {

    private final UserService userService;
    private final JwtUtil jwtUtil;

    public UserController(UserService userService, JwtUtil jwtUtil) {
        this.userService = userService;
        this.jwtUtil = jwtUtil;
    }

    private record AdminAuthResult(JwtUtil.JwtClaims claims, ResponseEntity<ApiResponse<Void>> errorResponse) {}

    private AdminAuthResult verifyAdmin(String authHeader) {
        Optional<JwtUtil.JwtClaims> claimsOpt = jwtUtil.verifyAuthorizationHeader(authHeader);
        if (claimsOpt.isEmpty()) {
            return new AdminAuthResult(
                    null,
                    ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                            .body(new ApiResponse<>("error", "Phiên đăng nhập không hợp lệ hoặc đã hết hạn."))
            );
        }

        JwtUtil.JwtClaims claims = claimsOpt.get();
        Optional<UserEntity> actorOpt = userService.getUserByUsername(claims.username());
        if (actorOpt.isEmpty()) {
            return new AdminAuthResult(
                    null,
                    ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                            .body(new ApiResponse<>("error", "Tài khoản không tồn tại trong hệ thống."))
            );
        }

        UserEntity actor = actorOpt.get();
        if (Boolean.FALSE.equals(actor.getIsActive())) {
            return new AdminAuthResult(
                    null,
                    ResponseEntity.status(HttpStatus.FORBIDDEN)
                            .body(new ApiResponse<>("error", "Tài khoản của bạn đã bị khóa bởi Quản trị viên."))
            );
        }

        boolean liveAdmin = actor.getRole() != null && actor.getRole().toUpperCase().contains("ADMIN");
        if (!claims.isAdmin() || !liveAdmin) {
            return new AdminAuthResult(
                    null,
                    ResponseEntity.status(HttpStatus.FORBIDDEN)
                            .body(new ApiResponse<>("error", "Chỉ Quản trị viên (ADMIN) mới có quyền quản lý người dùng."))
            );
        }
        return new AdminAuthResult(claims, null);
    }

    private <T> ResponseEntity<ApiResponse<T>> forbiddenOrUnauthorized(ResponseEntity<ApiResponse<Void>> denied) {
        String msg = denied.getBody() != null ? denied.getBody().getMessage() : "Từ chối truy cập.";
        return ResponseEntity.status(denied.getStatusCode()).body(new ApiResponse<>("error", msg));
    }

    // 1. Lấy danh sách toàn bộ tài khoản (IAM Management - chỉ ADMIN)
    @GetMapping
    public ResponseEntity<ApiResponse<List<UserEntity>>> getAllUsers(
            @RequestHeader(value = "Authorization", required = false) String authHeader) {
        AdminAuthResult auth = verifyAdmin(authHeader);
        if (auth.errorResponse() != null) return forbiddenOrUnauthorized(auth.errorResponse());

        List<UserEntity> users = userService.getAllUsers();
        return ResponseEntity.ok(new ApiResponse<>("success", "Lấy danh sách tài khoản thành công!", users));
    }

    // 2. Lấy thông tin người dùng theo username (chỉ ADMIN)
    @GetMapping("/{username}")
    public ResponseEntity<ApiResponse<UserEntity>> getUserByUsername(
            @PathVariable String username,
            @RequestHeader(value = "Authorization", required = false) String authHeader) {
        AdminAuthResult auth = verifyAdmin(authHeader);
        if (auth.errorResponse() != null) return forbiddenOrUnauthorized(auth.errorResponse());

        Optional<UserEntity> userOpt = userService.getUserByUsername(username);
        if (userOpt.isPresent()) {
            return ResponseEntity.ok(new ApiResponse<>("success", "Tìm thấy thông tin người dùng", userOpt.get()));
        }
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(new ApiResponse<>("error", "Không tìm thấy người dùng này!"));
    }

    // 3. Khóa / Mở khóa tài khoản người dùng (Admin Ban/Unban)
    @PatchMapping("/{id}/status")
    public ResponseEntity<ApiResponse<UserEntity>> updateUserStatus(
            @PathVariable Long id,
            @RequestBody Map<String, Object> body,
            @RequestHeader(value = "Authorization", required = false) String authHeader) {
        AdminAuthResult auth = verifyAdmin(authHeader);
        if (auth.errorResponse() != null) return forbiddenOrUnauthorized(auth.errorResponse());

        Optional<UserEntity> targetOpt = userService.getUserById(id);
        if (targetOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new ApiResponse<>("error", "Không tìm thấy tài khoản."));
        }

        UserEntity target = targetOpt.get();
        if (target.getUsername().equalsIgnoreCase(auth.claims().username())) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(new ApiResponse<>("error", "Không thể tự khóa tài khoản Quản trị viên đang đăng nhập."));
        }

        boolean nextActive = Boolean.TRUE.equals(body.get("isActive"))
                || "true".equalsIgnoreCase(String.valueOf(body.get("isActive")));
        target.setIsActive(nextActive);
        UserEntity updated = userService.updateUser(target);
        String msg = nextActive
                ? "Đã mở khóa tài khoản " + updated.getUsername()
                : "Đã khóa tài khoản " + updated.getUsername();
        return ResponseEntity.ok(new ApiResponse<>("success", msg, updated));
    }

    // 3b. Khóa / Mở khóa nhanh theo username (dùng trực tiếp từ dòng Nhật ký Cảnh báo Admin)
    @PatchMapping("/by-username/{username}/status")
    public ResponseEntity<ApiResponse<UserEntity>> updateUserStatusByUsername(
            @PathVariable String username,
            @RequestBody Map<String, Object> body,
            @RequestHeader(value = "Authorization", required = false) String authHeader) {
        AdminAuthResult auth = verifyAdmin(authHeader);
        if (auth.errorResponse() != null) return forbiddenOrUnauthorized(auth.errorResponse());

        Optional<UserEntity> targetOpt = userService.getUserByUsername(username != null ? username.trim() : "");
        if (targetOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new ApiResponse<>("error", "Không tìm thấy tài khoản '" + username + "' trong hệ thống."));
        }

        UserEntity target = targetOpt.get();
        if (target.getUsername().equalsIgnoreCase(auth.claims().username())) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(new ApiResponse<>("error", "Không thể tự khóa tài khoản Quản trị viên đang đăng nhập."));
        }

        boolean nextActive = Boolean.TRUE.equals(body.get("isActive"))
                || "true".equalsIgnoreCase(String.valueOf(body.get("isActive")));
        target.setIsActive(nextActive);
        UserEntity updated = userService.updateUser(target);
        String msg = nextActive
                ? "Đã mở khóa tài khoản " + updated.getUsername()
                : "Đã khóa tài khoản " + updated.getUsername();
        return ResponseEntity.ok(new ApiResponse<>("success", msg, updated));
    }

    // 4. Thay đổi phân quyền RBAC (ROLE_USER <-> ROLE_ADMIN)
    @PatchMapping("/{id}/role")
    public ResponseEntity<ApiResponse<UserEntity>> updateUserRole(
            @PathVariable Long id,
            @RequestBody Map<String, String> body,
            @RequestHeader(value = "Authorization", required = false) String authHeader) {
        AdminAuthResult auth = verifyAdmin(authHeader);
        if (auth.errorResponse() != null) return forbiddenOrUnauthorized(auth.errorResponse());

        Optional<UserEntity> targetOpt = userService.getUserById(id);
        if (targetOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new ApiResponse<>("error", "Không tìm thấy tài khoản."));
        }

        UserEntity target = targetOpt.get();
        if (target.getUsername().equalsIgnoreCase(auth.claims().username())) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(new ApiResponse<>("error", "Không thể tự hạ quyền tài khoản Quản trị viên đang đăng nhập."));
        }

        String requestedRole = String.valueOf(body.getOrDefault("role", "ROLE_USER")).trim().toUpperCase();
        String normalizedRole = requestedRole.contains("ADMIN") ? "ROLE_ADMIN" : "ROLE_USER";
        target.setRole(normalizedRole);
        UserEntity updated = userService.updateUser(target);
        return ResponseEntity.ok(new ApiResponse<>("success", "Đã cập nhật quyền cho " + updated.getUsername(), updated));
    }

    // 5. Tạo user nội bộ (yêu cầu ADMIN + bắt buộc băm mật khẩu)
    @PostMapping
    public ResponseEntity<ApiResponse<UserEntity>> createUser(
            @RequestBody UserEntity userEntity,
            @RequestHeader(value = "Authorization", required = false) String authHeader) {
        AdminAuthResult auth = verifyAdmin(authHeader);
        if (auth.errorResponse() != null) return forbiddenOrUnauthorized(auth.errorResponse());

        try {
            if (userEntity.getPasswordHash() == null || userEntity.getPasswordHash().trim().length() < 6) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                        .body(new ApiResponse<>("error", "Mật khẩu phải có ít nhất 6 ký tự!"));
            }
            userEntity.setPasswordHash(jwtUtil.hashPassword(userEntity.getPasswordHash()));
            UserEntity newUser = userService.createUser(userEntity);
            return ResponseEntity.ok(new ApiResponse<>("success", "Tạo tài khoản thành công!", newUser));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(new ApiResponse<>("error", "Không thể tạo tài khoản: " + e.getMessage()));
        }
    }
}
