package com.nemoguardrails.proxy_backend.service;

import com.nemoguardrails.proxy_backend.entity.ChatSessionEntity;
import com.nemoguardrails.proxy_backend.entity.UserEntity;
import com.nemoguardrails.proxy_backend.repository.ChatMessageRepository;
import com.nemoguardrails.proxy_backend.repository.ChatSessionRepository;
import com.nemoguardrails.proxy_backend.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collections;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
public class ChatSessionService {

    public enum SessionAccessResult {
        ALLOWED,
        NOT_FOUND,
        FORBIDDEN
    }

    public enum SessionDeleteResult {
        DELETED,
        NOT_FOUND,
        FORBIDDEN
    }

    private final ChatSessionRepository chatSessionRepository;
    private final ChatMessageRepository chatMessageRepository;
    private final UserRepository userRepository;

    public ChatSessionService(
            ChatSessionRepository chatSessionRepository,
            ChatMessageRepository chatMessageRepository,
            UserRepository userRepository) {
        this.chatSessionRepository = chatSessionRepository;
        this.chatMessageRepository = chatMessageRepository;
        this.userRepository = userRepository;
    }

    // Lấy danh sách phiên chat của đúng người dùng đang đăng nhập (cô lập dữ liệu đa người dùng)
    public List<ChatSessionEntity> getSessionsByUsername(String username) {
        if (username == null || username.trim().isEmpty()) {
            return Collections.emptyList();
        }
        return chatSessionRepository.findByUsernameOrderByIdDesc(username.trim());
    }

    // Lấy phiên chat dựa vào mã UUID
    public Optional<ChatSessionEntity> getSessionByUuid(String sessionUuid) {
        return chatSessionRepository.findBySessionUuid(sessionUuid);
    }

    private Optional<ChatSessionEntity> findSessionByIdentifier(String sessionIdentifier) {
        if (sessionIdentifier == null || sessionIdentifier.trim().isEmpty()) {
            return Optional.empty();
        }
        String trimmed = sessionIdentifier.trim();
        Optional<ChatSessionEntity> target = chatSessionRepository.findBySessionUuid(trimmed);
        if (target.isEmpty()) {
            try {
                Long id = Long.parseLong(trimmed);
                target = chatSessionRepository.findById(id);
            } catch (NumberFormatException ignored) {
                return Optional.empty();
            }
        }
        return target;
    }

    private boolean isOwnedByUser(ChatSessionEntity session, String username) {
        if (session == null || username == null || username.trim().isEmpty()) {
            return false;
        }
        UserEntity owner = session.getUser();
        return owner != null
                && owner.getUsername() != null
                && owner.getUsername().equalsIgnoreCase(username.trim());
    }

    // Kiểm tra quyền sở hữu một phiên chat theo UUID hoặc ID số (chống IDOR)
    @Transactional(readOnly = true)
    public SessionAccessResult checkSessionAccess(String sessionIdentifier, String username) {
        if (username == null || username.trim().isEmpty()) {
            return SessionAccessResult.FORBIDDEN;
        }
        Optional<ChatSessionEntity> target = findSessionByIdentifier(sessionIdentifier);
        if (target.isEmpty()) {
            return SessionAccessResult.NOT_FOUND;
        }
        return isOwnedByUser(target.get(), username)
                ? SessionAccessResult.ALLOWED
                : SessionAccessResult.FORBIDDEN;
    }

    // Tạo phiên chat mới và gắn chặt vào đúng chủ sở hữu từ JWT
    @Transactional
    public ChatSessionEntity createSessionForUser(ChatSessionEntity sessionEntity, String username) {
        if (username == null || username.trim().isEmpty()) {
            throw new IllegalArgumentException("Không xác định được tài khoản tạo phiên chat.");
        }
        UserEntity owner = userRepository.findByUsernameIgnoreCase(username.trim())
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy tài khoản người dùng."));

        sessionEntity.setUser(owner);
        if (sessionEntity.getSessionUuid() == null || sessionEntity.getSessionUuid().trim().isEmpty()) {
            sessionEntity.setSessionUuid(UUID.randomUUID().toString());
        }
        return chatSessionRepository.save(sessionEntity);
    }

    // Xóa một phiên chat thuộc quyền sở hữu của người dùng đang đăng nhập
    @Transactional
    public SessionDeleteResult deleteSessionForUser(String sessionIdentifier, String username) {
        if (username == null || username.trim().isEmpty()) {
            return SessionDeleteResult.FORBIDDEN;
        }
        Optional<ChatSessionEntity> target = findSessionByIdentifier(sessionIdentifier);
        if (target.isEmpty()) {
            return SessionDeleteResult.NOT_FOUND;
        }
        ChatSessionEntity session = target.get();
        if (!isOwnedByUser(session, username)) {
            return SessionDeleteResult.FORBIDDEN;
        }

        chatMessageRepository.deleteBySessionId(session.getId());
        chatSessionRepository.delete(session);
        return SessionDeleteResult.DELETED;
    }

    // Chỉ xóa toàn bộ lịch sử chat của đúng tài khoản đang đăng nhập (không ảnh hưởng tài khoản khác)
    @Transactional
    public int deleteAllSessionsForUser(String username) {
        if (username == null || username.trim().isEmpty()) {
            return 0;
        }
        List<ChatSessionEntity> userSessions = chatSessionRepository.findByUsernameOrderByIdDesc(username.trim());
        if (userSessions.isEmpty()) {
            return 0;
        }
        for (ChatSessionEntity session : userSessions) {
            chatMessageRepository.deleteBySessionId(session.getId());
        }
        chatSessionRepository.deleteAllInBatch(userSessions);
        return userSessions.size();
    }
}
