package com.nemoguardrails.proxy_backend.service;

import com.nemoguardrails.proxy_backend.entity.ChatMessageEntity;
import com.nemoguardrails.proxy_backend.repository.ChatMessageRepository;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class ChatMessageService {

    private final ChatMessageRepository chatMessageRepository;

    public ChatMessageService(ChatMessageRepository chatMessageRepository) {
        this.chatMessageRepository = chatMessageRepository;
    }

    // Lưu tin nhắn mới (của người dùng hoặc của bot)
    public ChatMessageEntity saveMessage(ChatMessageEntity messageEntity) {
        return chatMessageRepository.save(messageEntity);
    }

    // Lấy toàn bộ lịch sử tin nhắn của một phiên chat cụ thể
    public List<ChatMessageEntity> getChatHistory(Long sessionId) {
        return chatMessageRepository.findBySessionIdOrderByCreatedAtAsc(sessionId);
    }
}