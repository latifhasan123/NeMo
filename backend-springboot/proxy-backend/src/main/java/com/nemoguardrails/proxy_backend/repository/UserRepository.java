package com.nemoguardrails.proxy_backend.repository;

import com.nemoguardrails.proxy_backend.entity.UserEntity;
import org.springframework.data.jpa.repository.JpaRepository;


import java.util.Optional;


public interface UserRepository extends JpaRepository<UserEntity, Long> {
    
    // Spring Boot sẽ tự động dịch hàm này thành: SELECT * FROM users WHERE username = ?
    Optional<UserEntity> findByUsername(String username);
    
    // Kiểm tra xem username đã tồn tại chưa (dùng khi đăng ký)
    boolean existsByUsername(String username);
}