package com.nemoguardrails.proxy_backend.controller;

import com.nemoguardrails.proxy_backend.dto.ApiResponse;
import com.nemoguardrails.proxy_backend.entity.SecurityAlertEntity;
import com.nemoguardrails.proxy_backend.service.SecurityAlertService;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/alerts")
@CrossOrigin(origins = "*") // Bùa chú giúp React (port 5173) gọi API không bị lỗi CORS chặn
public class SecurityAlertController {

    private final SecurityAlertService alertService;

    // Dùng Constructor Injection thay cho @Autowired
    public SecurityAlertController(SecurityAlertService alertService) {
        this.alertService = alertService;
    }

    // 1. API cho Quốc Anh (React): Lấy danh sách cảnh báo để vẽ biểu đồ
    // Đường dẫn: GET http://localhost:8080/api/v1/alerts
    @GetMapping
    public ApiResponse<List<SecurityAlertEntity>> getAllAlerts() {
        try {
            // Mượn não bộ (Service) lấy dữ liệu
            List<SecurityAlertEntity> listAlerts = alertService.getAllAlerts();
            
            // Đóng hộp trả về cho Quốc Anh
            return new ApiResponse<>("success", "Lấy danh sách cảnh báo thành công!", listAlerts);
        } catch (Exception e) {
            // Nếu có lỗi, đóng hộp lỗi (data là null)
            return new ApiResponse<>("error", "Lỗi khi lấy dữ liệu: " + e.getMessage());
        }
    }

    // 2. API cho Trần Ân (Python): Gửi log cảnh báo mỗi khi bắt được hacker
    // Đường dẫn: POST http://localhost:8080/api/v1/alerts
    @PostMapping
    public ApiResponse<SecurityAlertEntity> createAlert(@RequestBody SecurityAlertEntity alertEntity) {
        try {
            // Lưu dữ liệu vào Database
            SecurityAlertEntity savedAlert = alertService.createAlert(alertEntity);
            
            // Báo lại cho bên Python là đã lưu thành công
            return new ApiResponse<>("success", "Đã lưu cảnh báo bảo mật thành công!", savedAlert);
        } catch (Exception e) {
            return new ApiResponse<>("error", "Không thể lưu cảnh báo: " + e.getMessage());
        }
    }
}