package com.nemoguardrails.proxy_backend.service;

import com.nemoguardrails.proxy_backend.dto.AuthRequest;
import com.nemoguardrails.proxy_backend.dto.AuthResponse;
import com.nemoguardrails.proxy_backend.entity.UserEntity;
import com.nemoguardrails.proxy_backend.repository.UserRepository;
import com.nemoguardrails.proxy_backend.util.JwtUtil;
import org.springframework.stereotype.Service;

import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class AuthService {

    private static final int MAX_FAILED_ATTEMPTS = 5;
    private static final long LOCK_DURATION_MS = 5 * 60 * 1000L; // Khóa tạm 5 phút nếu brute-force

    private static final class FailedAttemptState {
        int count;
        long lockedUntilMs;
    }

    private final ConcurrentHashMap<String, FailedAttemptState> loginAttempts = new ConcurrentHashMap<>();
    private final UserRepository userRepository;
    private final JwtUtil jwtUtil;

    public AuthService(UserRepository userRepository, JwtUtil jwtUtil) {
        this.userRepository = userRepository;
        this.jwtUtil = jwtUtil;
    }

    /**
     * Khởi tạo tài khoản Admin duy nhất khi khởi động (Database Seeding)
     */
    public void ensureSeededAdmin(String adminUsername, String rawPassword) {
        String cleanUsername = adminUsername == null ? "admin" : adminUsername.trim();
        Optional<UserEntity> existingOpt = userRepository.findByUsername(cleanUsername);

        if (existingOpt.isEmpty()) {
            UserEntity admin = new UserEntity();
            admin.setUsername(cleanUsername);
            admin.setPasswordHash(jwtUtil.hashPassword(rawPassword));
            admin.setRole("ROLE_ADMIN");
            admin.setIsActive(true);
            userRepository.save(admin);
            System.out.println("[SECURITY SEED] Đã khởi tạo tài khoản Quản trị viên mặc định: " + cleanUsername);
        } else {
            UserEntity existing = existingOpt.get();
            if (!"ROLE_ADMIN".equalsIgnoreCase(existing.getRole())) {
                existing.setRole("ROLE_ADMIN");
                userRepository.save(existing);
            }
        }
    }

    /**
     * Đăng ký tài khoản mới công khai:
     * LUÔN gán ROLE_USER mặc định để chống lỗ hổng leo thang đặc quyền (Privilege Escalation).
     */
    public AuthResponse register(AuthRequest request) {
        if (request.getUsername() == null || request.getUsername().trim().isEmpty()) {
            throw new RuntimeException("Tên đăng nhập không được để trống!");
        }
        if (request.getPassword() == null || request.getPassword().trim().isEmpty()) {
            throw new RuntimeException("Mật khẩu không được để trống!");
        }

        String username = request.getUsername().trim();
        String password = request.getPassword();

        if (password.length() < 6) {
            throw new RuntimeException("Mật khẩu phải có ít nhất 6 ký tự!");
        }
        if (userRepository.existsByUsername(username)) {
            throw new RuntimeException("Tên đăng nhập '" + username + "' đã được sử dụng!");
        }

        UserEntity user = new UserEntity();
        user.setUsername(username);
        user.setPasswordHash(jwtUtil.hashPassword(password));
        user.setRole("ROLE_USER");
        user.setIsActive(true);

        UserEntity savedUser = userRepository.save(user);
        return new AuthResponse(null, savedUser.getUsername(), savedUser.getRole());
    }

    /**
     * Đăng nhập tài khoản, chống brute-force và tự nâng cấp hash SHA-256 cũ lên Salted PBKDF2
     */
    public AuthResponse login(AuthRequest request) {
        if (request.getUsername() == null || request.getUsername().trim().isEmpty() ||
            request.getPassword() == null || request.getPassword().trim().isEmpty()) {
            throw new RuntimeException("Vui lòng điền đầy đủ tên đăng nhập và mật khẩu!");
        }

        String username = request.getUsername().trim();
        String key = username.toLowerCase();

        FailedAttemptState attemptState = loginAttempts.get(key);
        long now = System.currentTimeMillis();
        if (attemptState != null && attemptState.lockedUntilMs > now) {
            long waitSeconds = Math.max(1, (attemptState.lockedUntilMs - now) / 1000);
            throw new RuntimeException(
                "Tài khoản tạm bị khóa do đăng nhập sai quá nhiều lần. Vui lòng thử lại sau " + waitSeconds + " giây!"
            );
        }

        Optional<UserEntity> userOpt = userRepository.findByUsername(username);
        if (userOpt.isEmpty()) {
            recordFailedAttempt(key, now);
            throw new RuntimeException("Tên đăng nhập hoặc mật khẩu không chính xác!");
        }

        UserEntity user = userOpt.get();
        if (!jwtUtil.verifyPassword(request.getPassword(), user.getPasswordHash())) {
            recordFailedAttempt(key, now);
            throw new RuntimeException("Tên đăng nhập hoặc mật khẩu không chính xác!");
        }

        if (Boolean.FALSE.equals(user.getIsActive())) {
            throw new RuntimeException("Tài khoản của bạn đã bị khóa!");
        }

        // Reset bộ đếm brute-force khi đăng nhập thành công
        loginAttempts.remove(key);

        // Tự động nâng cấp mật khẩu từ SHA-256 cũ sang Salted PBKDF2 nếu cần
        if (jwtUtil.needsRehash(user.getPasswordHash())) {
            user.setPasswordHash(jwtUtil.hashPassword(request.getPassword()));
            userRepository.save(user);
        }

        String token = jwtUtil.generateToken(user.getUsername(), user.getRole());
        return new AuthResponse(token, user.getUsername(), user.getRole());
    }

    private void recordFailedAttempt(String key, long now) {
        loginAttempts.compute(key, (k, existing) -> {
            FailedAttemptState state = (existing == null || existing.lockedUntilMs <= now)
                ? new FailedAttemptState()
                : existing;
            state.count += 1;
            if (state.count >= MAX_FAILED_ATTEMPTS) {
                state.lockedUntilMs = now + LOCK_DURATION_MS;
                state.count = 0;
            }
            return state;
        });
    }
}
