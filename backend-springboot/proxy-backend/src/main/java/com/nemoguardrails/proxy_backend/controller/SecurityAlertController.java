package com.nemoguardrails.proxy_backend.controller;

import com.nemoguardrails.proxy_backend.dto.ApiResponse;
import com.nemoguardrails.proxy_backend.entity.SecurityAlertEntity;
import com.nemoguardrails.proxy_backend.entity.UserEntity;
import com.nemoguardrails.proxy_backend.service.SecurityAlertService;
import com.nemoguardrails.proxy_backend.service.UserService;
import com.nemoguardrails.proxy_backend.util.JwtUtil;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/v1/alerts")
@CrossOrigin(origins = "*")
public class SecurityAlertController {

    private final SecurityAlertService alertService;
    private final UserService userService;
    private final JwtUtil jwtUtil;

    public SecurityAlertController(
            SecurityAlertService alertService,
            UserService userService,
            JwtUtil jwtUtil) {
        this.alertService = alertService;
        this.userService = userService;
        this.jwtUtil = jwtUtil;
    }

    private ResponseEntity<ApiResponse<Void>> checkAdminAccess(String authHeader) {
        Optional<JwtUtil.JwtClaims> claimsOpt = jwtUtil.verifyAuthorizationHeader(authHeader);
        if (claimsOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(new ApiResponse<>("error", "Phiên đăng nhập không hợp lệ hoặc đã hết hạn."));
        }

        JwtUtil.JwtClaims claims = claimsOpt.get();
        Optional<UserEntity> userOpt = userService.getUserByUsername(claims.username());
        if (userOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(new ApiResponse<>("error", "Tài khoản không tồn tại trong hệ thống."));
        }

        UserEntity user = userOpt.get();
        if (Boolean.FALSE.equals(user.getIsActive())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(new ApiResponse<>("error", "Tài khoản của bạn đã bị khóa bởi Quản trị viên."));
        }

        boolean liveAdmin = user.getRole() != null && user.getRole().toUpperCase().contains("ADMIN");
        if (!claims.isAdmin() || !liveAdmin) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(new ApiResponse<>("error", "Truy cập bị từ chối: Chỉ Quản trị viên (ADMIN) mới có quyền thực hiện thao tác này."));
        }
        return null;
    }

    // 1. API Dashboard Admin tổng hợp đầy đủ số liệu hiệu năng (Latency, Traffic, Alerts)
    @GetMapping("/analytics")
    public ResponseEntity<?> getSecurityAnalytics(
            @RequestHeader(value = "Authorization", required = false) String authHeader) {
        ResponseEntity<ApiResponse<Void>> denied = checkAdminAccess(authHeader);
        if (denied != null) return denied;

        try {
            Map<String, Object> analytics = alertService.getSecurityAnalytics();
            return ResponseEntity.ok(new ApiResponse<>("success", "Lấy dữ liệu phân tích an ninh thành công!", analytics));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse<>("error", "Lỗi tổng hợp phân tích: " + e.getMessage()));
        }
    }

    // 2. API danh sách cảnh báo thuần (giữ tương thích ngược)
    @GetMapping
    public ResponseEntity<?> getAllAlerts(
            @RequestHeader(value = "Authorization", required = false) String authHeader) {
        ResponseEntity<ApiResponse<Void>> denied = checkAdminAccess(authHeader);
        if (denied != null) return denied;

        try {
            List<SecurityAlertEntity> listAlerts = alertService.getAllAlerts();
            return ResponseEntity.ok(new ApiResponse<>("success", "Lấy danh sách cảnh báo thành công!", listAlerts));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ApiResponse<>("error", "Lỗi khi lấy dữ liệu: " + e.getMessage()));
        }
    }

    // 3. API xóa 1 bản ghi cảnh báo (Admin dọn cảnh báo test hoặc đã xử lý)
    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<String>> deleteAlert(
            @PathVariable Long id,
            @RequestHeader(value = "Authorization", required = false) String authHeader) {
        ResponseEntity<ApiResponse<Void>> denied = checkAdminAccess(authHeader);
        if (denied != null) {
            return ResponseEntity.status(denied.getStatusCode())
                    .body(new ApiResponse<>("error", denied.getBody() != null ? denied.getBody().getMessage() : "Từ chối truy cập."));
        }

        boolean deleted = alertService.deleteAlertById(id);
        if (!deleted) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new ApiResponse<>("error", "Không tìm thấy bản ghi cảnh báo cần xóa."));
        }
        return ResponseEntity.ok(new ApiResponse<>("success", "Đã xóa cảnh báo bảo mật."));
    }

    // 4. API dọn sạch nhật ký cảnh báo (Admin reset môi trường demo)
    @DeleteMapping
    public ResponseEntity<ApiResponse<String>> clearAllAlerts(
            @RequestHeader(value = "Authorization", required = false) String authHeader) {
        ResponseEntity<ApiResponse<Void>> denied = checkAdminAccess(authHeader);
        if (denied != null) {
            return ResponseEntity.status(denied.getStatusCode())
                    .body(new ApiResponse<>("error", denied.getBody() != null ? denied.getBody().getMessage() : "Từ chối truy cập."));
        }

        alertService.deleteAllAlerts();
        return ResponseEntity.ok(new ApiResponse<>("success", "Đã dọn sạch toàn bộ nhật ký cảnh báo."));
    }

    // 5. API nội bộ cho Proxy Python ghi log cảnh báo thời gian thực
    @PostMapping
    public ApiResponse<SecurityAlertEntity> createAlert(@RequestBody SecurityAlertEntity alertEntity) {
        try {
            SecurityAlertEntity savedAlert = alertService.createAlert(alertEntity);
            return new ApiResponse<>("success", "Đã lưu cảnh báo bảo mật thành công!", savedAlert);
        } catch (Exception e) {
            return new ApiResponse<>("error", "Không thể lưu cảnh báo: " + e.getMessage());
        }
    }
}
