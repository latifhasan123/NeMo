package com.nemoguardrails.proxy_backend;

import com.nemoguardrails.proxy_backend.dto.AuthRequest;
import com.nemoguardrails.proxy_backend.dto.AuthResponse;
import com.nemoguardrails.proxy_backend.entity.ChatSessionEntity;
import com.nemoguardrails.proxy_backend.entity.UserEntity;
import com.nemoguardrails.proxy_backend.repository.ChatMessageRepository;
import com.nemoguardrails.proxy_backend.repository.ChatSessionRepository;
import com.nemoguardrails.proxy_backend.repository.UserRepository;
import com.nemoguardrails.proxy_backend.service.AuthService;
import com.nemoguardrails.proxy_backend.service.ChatSessionService;
import com.nemoguardrails.proxy_backend.util.JwtUtil;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class SecurityHardeningTest {

    private final JwtUtil jwtUtil = new JwtUtil("test-secret-key-atbm-2026");

    @Test
    void passwordHashingUsesUniqueSaltsAndVerifiesCorrectly() {
        String hash1 = jwtUtil.hashPassword("Secret@123");
        String hash2 = jwtUtil.hashPassword("Secret@123");

        assertTrue(hash1.startsWith("pbkdf2_sha256$120000$"));
        assertNotEquals(hash1, hash2, "Salted hashes must differ for identical passwords");
        assertTrue(jwtUtil.verifyPassword("Secret@123", hash1));
        assertFalse(jwtUtil.verifyPassword("WrongPass", hash1));
        assertFalse(jwtUtil.needsRehash(hash1));
    }

    @Test
    void jwtVerificationRejectsTamperedRolePayload() {
        String userToken = jwtUtil.generateToken("alice", "ROLE_USER");
        Optional<JwtUtil.JwtClaims> validClaims = jwtUtil.verifyToken(userToken);
        assertTrue(validClaims.isPresent());
        assertFalse(validClaims.get().isAdmin());

        // Giả mạo nâng quyền từ ROLE_USER lên ROLE_ADMIN trong payload
        String[] parts = userToken.split("\\.");
        String originalPayload = new String(Base64.getUrlDecoder().decode(parts[1]), StandardCharsets.UTF_8);
        String tamperedPayload = originalPayload.replace("ROLE_USER", "ROLE_ADMIN");
        String forgedToken = parts[0] + "."
                + Base64.getUrlEncoder().withoutPadding().encodeToString(tamperedPayload.getBytes(StandardCharsets.UTF_8))
                + "." + parts[2];

        assertTrue(jwtUtil.verifyToken(forgedToken).isEmpty(), "Tampered JWT signature must fail verification");
    }

    @Test
    void publicRegistrationNeverGrantsAdminRoleEvenForAdminPrefix() {
        UserRepository mockRepo = Mockito.mock(UserRepository.class);
        when(mockRepo.existsByUsername("admin_hacker")).thenReturn(false);
        when(mockRepo.save(any(UserEntity.class))).thenAnswer(inv -> inv.getArgument(0));

        AuthService authService = new AuthService(mockRepo, jwtUtil);
        AuthRequest req = new AuthRequest();
        req.setUsername("admin_hacker");
        req.setPassword("Pass@1234");

        AuthResponse res = authService.register(req);
        assertEquals("ROLE_USER", res.getRole());
    }

    @Test
    void chatSessionsAreStrictlyIsolatedPerUser() {
        ChatSessionRepository sessionRepo = Mockito.mock(ChatSessionRepository.class);
        ChatMessageRepository messageRepo = Mockito.mock(ChatMessageRepository.class);
        UserRepository userRepo = Mockito.mock(UserRepository.class);

        UserEntity hasan = new UserEntity();
        hasan.setId(1L);
        hasan.setUsername("hasan");

        ChatSessionEntity hasanSession = new ChatSessionEntity();
        hasanSession.setId(10L);
        hasanSession.setSessionUuid("uuid-hasan-1");
        hasanSession.setUser(hasan);
        hasanSession.setSessionName("hello");

        when(sessionRepo.findByUsernameOrderByIdDesc("admin")).thenReturn(List.of());
        when(sessionRepo.findByUsernameOrderByIdDesc("hasan")).thenReturn(List.of(hasanSession));
        when(sessionRepo.findBySessionUuid("uuid-hasan-1")).thenReturn(Optional.of(hasanSession));

        ChatSessionService service = new ChatSessionService(sessionRepo, messageRepo, userRepo);

        assertTrue(service.getSessionsByUsername("admin").isEmpty(), "Admin must not see hasan's sessions");
        assertEquals(1, service.getSessionsByUsername("hasan").size());
        assertEquals(
                ChatSessionService.SessionAccessResult.FORBIDDEN,
                service.checkSessionAccess("uuid-hasan-1", "admin")
        );
        assertEquals(
                ChatSessionService.SessionAccessResult.ALLOWED,
                service.checkSessionAccess("uuid-hasan-1", "hasan")
        );
        assertEquals(
                ChatSessionService.SessionDeleteResult.FORBIDDEN,
                service.deleteSessionForUser("uuid-hasan-1", "admin")
        );
        verify(sessionRepo, never()).delete(any());

        assertEquals(
                ChatSessionService.SessionDeleteResult.DELETED,
                service.deleteSessionForUser("uuid-hasan-1", "hasan")
        );
        verify(messageRepo).deleteBySessionId(10L);
        verify(sessionRepo).delete(hasanSession);
    }
}
