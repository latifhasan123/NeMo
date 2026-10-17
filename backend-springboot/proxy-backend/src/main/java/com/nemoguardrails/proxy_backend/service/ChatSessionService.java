package com.nemoguardrails.proxy_backend.service;

import com.nemoguardrails.proxy_backend.entity.ChatSessionEntity;
import com.nemoguardrails.proxy_backend.repository.ChatSessionRepository;
import org.springframework.stereotype.Service;

import java.util.Optional;

@Service
public class ChatSessionService {

    private final ChatSessionRepository chatSessionRepository;

    public ChatSessionService(ChatSessionRepository chatSessionRepository) {
        this.chatSessionRepository = chatSessionRepository;
    }

    // Lấy phiên chat dựa vào mã UUID
    public Optional<ChatSessionEntity> getSessionByUuid(String sessionUuid) {
        return chatSessionRepository.findBySessionUuid(sessionUuid);
    }

    // Tạo phiên chat mới
    public ChatSessionEntity createSession(ChatSessionEntity sessionEntity) {
        return chatSessionRepository.save(sessionEntity);
    }
}