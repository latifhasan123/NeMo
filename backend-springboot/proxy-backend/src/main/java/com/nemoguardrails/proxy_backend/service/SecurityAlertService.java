package com.nemoguardrails.proxy_backend.service;

import com.nemoguardrails.proxy_backend.entity.SecurityAlertEntity;
import com.nemoguardrails.proxy_backend.repository.SecurityAlertRepository;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class SecurityAlertService {

    // 1. Khai báo Repository với từ khóa 'final' để bảo vệ nó không bị ghi đè
    private final SecurityAlertRepository alertRepository;

    // 2. Constructor Injection (Cách chuẩn Senior thay cho @Autowired)
    // Spring Boot tự động nhận diện và "bơm" SecurityAlertRepository vào đây.
    public SecurityAlertService(SecurityAlertRepository alertRepository) {
        this.alertRepository = alertRepository;
    }

    // 3. Viết hàm lưu cảnh báo mới (Dùng cho Trần Ân bắn API về)
    public SecurityAlertEntity createAlert(SecurityAlertEntity alertEntity) {
        return alertRepository.save(alertEntity);
    }

    // 4. Viết hàm lấy toàn bộ danh sách cảnh báo (Dùng cho Quốc Anh hiển thị lên giao diện)
    public List<SecurityAlertEntity> getAllAlerts() {
        return alertRepository.findAll();
    }
}