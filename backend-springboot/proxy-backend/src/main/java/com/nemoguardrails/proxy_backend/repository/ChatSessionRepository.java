package com.nemoguardrails.proxy_backend.repository;

import com.nemoguardrails.proxy_backend.entity.ChatSessionEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ChatSessionRepository extends JpaRepository<ChatSessionEntity, Long> {
    
    // Tìm phiên chat theo mã UUID
    Optional<ChatSessionEntity> findBySessionUuid(String sessionUuid);

    // Lấy danh sách phiên chat thuộc về đúng người dùng đang đăng nhập (mới nhất lên đầu)
    @Query("SELECT s FROM ChatSessionEntity s JOIN FETCH s.user u WHERE LOWER(u.username) = LOWER(:username) ORDER BY s.id DESC")
    List<ChatSessionEntity> findByUsernameOrderByIdDesc(@Param("username") String username);

    // Lấy tất cả phiên sắp xếp phiên mới nhất lên đầu
    List<ChatSessionEntity> findAllByOrderByIdDesc();
}
