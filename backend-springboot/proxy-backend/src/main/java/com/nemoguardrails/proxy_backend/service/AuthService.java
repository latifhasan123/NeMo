package com.nemoguardrails.proxy_backend.service;

import com.nemoguardrails.proxy_backend.dto.AuthRequest;
import com.nemoguardrails.proxy_backend.dto.AuthResponse;
import com.nemoguardrails.proxy_backend.entity.UserEntity;
import com.nemoguardrails.proxy_backend.repository.UserRepository;
import com.nemoguardrails.proxy_backend.util.JwtUtil;
import org.springframework.stereotype.Service;

import java.util.Optional;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final JwtUtil jwtUtil;

    public AuthService(UserRepository userRepository, JwtUtil jwtUtil) {
        this.userRepository = userRepository;
        this.jwtUtil = jwtUtil;
    }

    /**
     * Xử lý Đăng ký tài khoản mới
     */
    public AuthResponse register(AuthRequest request) {
        if (request.getUsername() == null || request.getUsername().trim().isEmpty()) {
            throw new RuntimeException("Tên đăng nhập không được để trống!");
        }
        if (request.getPassword() == null || request.getPassword().trim().isEmpty()) {
            throw new RuntimeException("Mật khẩu không được để trống!");
        }

        String username = request.getUsername().trim();

        if (userRepository.existsByUsername(username)) {
            throw new RuntimeException("Tên đăng nhập '" + username + "' đã được sử dụng!");
        }

        UserEntity user = new UserEntity();
        user.setUsername(username);
        user.setPasswordHash(jwtUtil.hashPassword(request.getPassword()));
        
        // Nếu tên đăng nhập có chữ admin thì gán quyền ADMIN, còn lại là ROLE_USER
        if (username.equalsIgnoreCase("admin") || username.toLowerCase().startsWith("admin")) {
            user.setRole("ROLE_ADMIN");
        } else {
            user.setRole("ROLE_USER");
        }
        
        user.setIsActive(true);

        UserEntity savedUser = userRepository.save(user);

        return new AuthResponse(null, savedUser.getUsername(), savedUser.getRole());
    }

    /**
     * Xử lý Đăng nhập tài khoản & cấp JWT Token
     */
    public AuthResponse login(AuthRequest request) {
        if (request.getUsername() == null || request.getUsername().trim().isEmpty() ||
            request.getPassword() == null || request.getPassword().trim().isEmpty()) {
            throw new RuntimeException("Vui lòng điền đầy đủ tên đăng nhập và mật khẩu!");
        }

        String username = request.getUsername().trim();

        Optional<UserEntity> userOpt = userRepository.findByUsername(username);
        if (userOpt.isEmpty()) {
            throw new RuntimeException("Tên đăng nhập hoặc mật khẩu không chính xác!");
        }

        UserEntity user = userOpt.get();

        // Kiểm tra mật khẩu (hỗ trợ cả mật khẩu hash SHA-256 lẫn mật khẩu plain text nếu có dữ liệu test cũ)
        String inputHashed = jwtUtil.hashPassword(request.getPassword());
        boolean passwordMatches = inputHashed.equalsIgnoreCase(user.getPasswordHash()) 
                               || request.getPassword().equals(user.getPasswordHash());

        if (!passwordMatches) {
            throw new RuntimeException("Tên đăng nhập hoặc mật khẩu không chính xác!");
        }

        if (Boolean.FALSE.equals(user.getIsActive())) {
            throw new RuntimeException("Tài khoản của bạn đã bị khóa!");
        }

        // Sinh JWT token
        String token = jwtUtil.generateToken(user.getUsername(), user.getRole());

        return new AuthResponse(token, user.getUsername(), user.getRole());
    }
}
