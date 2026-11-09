package com.nemoguardrails.proxy_backend.service;

import com.nemoguardrails.proxy_backend.dto.ChatRecordDTO;
import com.nemoguardrails.proxy_backend.entity.ChatMessageEntity;
import com.nemoguardrails.proxy_backend.entity.ChatSessionEntity;
import com.nemoguardrails.proxy_backend.entity.UserEntity;
import com.nemoguardrails.proxy_backend.repository.ChatMessageRepository;
import com.nemoguardrails.proxy_backend.repository.ChatSessionRepository;
import com.nemoguardrails.proxy_backend.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collections;
import java.util.List;

@Service
public class ChatMessageService {

    private final ChatMessageRepository chatMessageRepository;
    private final ChatSessionRepository chatSessionRepository;
    private final UserRepository userRepository;

    public ChatMessageService(
            ChatMessageRepository chatMessageRepository,
            ChatSessionRepository chatSessionRepository,
            UserRepository userRepository) {
        this.chatMessageRepository = chatMessageRepository;
        this.chatSessionRepository = chatSessionRepository;
        this.userRepository = userRepository;
    }

    // Lưu tin nhắn mới (của người dùng hoặc của bot)
    public ChatMessageEntity saveMessage(ChatMessageEntity messageEntity) {
        return chatMessageRepository.save(messageEntity);
    }

    // Lấy toàn bộ lịch sử tin nhắn của một phiên chat cụ thể theo ID
    public List<ChatMessageEntity> getChatHistory(Long sessionId) {
        return chatMessageRepository.findBySessionIdOrderByCreatedAtAsc(sessionId);
    }

    // Lấy lịch sử theo session UUID hoặc ID (chuỗi do Frontend gửi lên)
    public List<ChatMessageEntity> getChatHistoryByUuid(String sessionIdentifier) {
        if (sessionIdentifier == null || sessionIdentifier.trim().isEmpty()) {
            return Collections.emptyList();
        }

        String identifier = sessionIdentifier.trim();

        // 1. Thử tìm nhanh bằng Session UUID qua JPQL JOIN
        List<ChatMessageEntity> list = chatMessageRepository.findBySessionUuidOrderByCreatedAtAsc(identifier);
        if (!list.isEmpty()) {
            return list;
        }

        // 2. Nếu không tìm thấy bằng UUID, kiểm tra xem có phải là Long ID không
        try {
            Long sessionId = Long.parseLong(identifier);
            return chatMessageRepository.findBySessionIdOrderByCreatedAtAsc(sessionId);
        } catch (NumberFormatException e) {
            return Collections.emptyList();
        }
    }

    /**
     * Tự động lưu phiên chat và cặp tin nhắn (User - Bot) từ Proxy gửi về
     */
    @Transactional
    public void recordChat(ChatRecordDTO dto) {
        if (dto.getSessionUuid() == null || dto.getSessionUuid().trim().isEmpty()) {
            return;
        }

        String sessionUuid = dto.getSessionUuid().trim();
        String requestedUsername = dto.getUsername() != null ? dto.getUsername().trim() : "";

        // 1. Tìm đúng User sở hữu phiên này (không tự ý gán sang tài khoản đầu tiên trong DB gây rò rỉ lịch sử)
        UserEntity user = !requestedUsername.isEmpty()
                ? userRepository.findByUsernameIgnoreCase(requestedUsername).orElse(null)
                : null;
        if (user == null) {
            throw new IllegalArgumentException(
                    "Không xác định được tài khoản hợp lệ để lưu lịch sử chat: " + requestedUsername);
        }

        // 2. Tìm hoặc tạo mới ChatSession (chặn ghi chèn vào phiên chat của người dùng khác)
        ChatSessionEntity session = chatSessionRepository.findBySessionUuid(sessionUuid).orElse(null);
        if (session == null) {
            session = new ChatSessionEntity();
            session.setSessionUuid(sessionUuid);
            session.setUser(user);

            // Đặt tên phiên chat theo câu hỏi đầu tiên của người dùng
            String title = dto.getUserMessage();
            if (title != null && title.trim().length() > 30) {
                title = title.trim().substring(0, 27) + "...";
            }
            session.setSessionName(title != null && !title.trim().isEmpty() ? title.trim() : "Cuộc trò chuyện mới");
            session = chatSessionRepository.save(session);
        } else if (session.getUser() != null
                && session.getUser().getUsername() != null
                && !session.getUser().getUsername().equalsIgnoreCase(user.getUsername())) {
            throw new SecurityException("Phiên chat thuộc về một tài khoản khác.");
        }

        // 3. Lưu tin nhắn của User
        if (dto.getUserMessage() != null && !dto.getUserMessage().trim().isEmpty()) {
            ChatMessageEntity userMsg = new ChatMessageEntity();
            userMsg.setSession(session);
            userMsg.setSenderRole("user");
            userMsg.setSenderType("USER");
            userMsg.setContent(dto.getUserMessage().trim());
            chatMessageRepository.save(userMsg);
        }

        // 4. Lưu tin nhắn phản hồi của Bot AI
        if (dto.getBotResponse() != null && !dto.getBotResponse().trim().isEmpty()) {
            ChatMessageEntity botMsg = new ChatMessageEntity();
            botMsg.setSession(session);
            botMsg.setSenderRole("assistant");
            botMsg.setSenderType("AI");
            botMsg.setContent(dto.getBotResponse().trim());
            botMsg.setAiLatencyMs(dto.getLatencyMs());
            chatMessageRepository.save(botMsg);
        }
    }
}
