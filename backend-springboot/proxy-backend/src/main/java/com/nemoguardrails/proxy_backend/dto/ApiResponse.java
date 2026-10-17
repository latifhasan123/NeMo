package com.nemoguardrails.proxy_backend.dto;
import lombok.Data;
@Data
public class ApiResponse<T> {
    private String status;  // "success" hoặc "error"
    private String message; // Câu thông báo (VD: "Lưu log thành công")
    private T data;         // Dữ liệu thực tế (Cục JSON)

    // Constructor chuẩn bị sẵn để xài cho tiện
    public ApiResponse(String status, String message, T data) {
        this.status = status;
        this.message = message;
        this.data = data;
    }

    // Constructor rút gọn khi bị lỗi (không có data)
    public ApiResponse(String status, String message) {
        this.status = status;   
        this.message = message;
        this.data = null;
    }

    // TODO: Generate Getters và Setters
}