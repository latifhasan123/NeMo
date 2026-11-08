package com.nemoguardrails.proxy_backend.controller;

import com.nemoguardrails.proxy_backend.dto.ApiResponse;
import com.nemoguardrails.proxy_backend.dto.AuthRequest;
import com.nemoguardrails.proxy_backend.dto.AuthResponse;
import com.nemoguardrails.proxy_backend.service.AuthService;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
@CrossOrigin(origins = "*")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    /**
     * API Đăng ký tài khoản
     * POST http://localhost:8080/api/auth/register
     */
    @PostMapping("/register")
    public ApiResponse<AuthResponse> register(@RequestBody AuthRequest request) {
        try {
            AuthResponse response = authService.register(request);
            return new ApiResponse<>("success", "Tạo tài khoản thành công! Hãy đăng nhập để tiếp tục.", response);
        } catch (Exception e) {
            return new ApiResponse<>("error", e.getMessage());
        }
    }

    /**
     * API Đăng nhập và nhận JWT Token
     * POST http://localhost:8080/api/auth/login
     */
    @PostMapping("/login")
    public ApiResponse<AuthResponse> login(@RequestBody AuthRequest request) {
        try {
            AuthResponse response = authService.login(request);
            return new ApiResponse<>("success", "Đăng nhập thành công!", response);
        } catch (Exception e) {
            return new ApiResponse<>("error", e.getMessage());
        }
    }
}
