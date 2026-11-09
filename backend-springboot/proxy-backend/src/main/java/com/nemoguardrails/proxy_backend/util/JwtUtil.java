package com.nemoguardrails.proxy_backend.util;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.Mac;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Component
public class JwtUtil {

    private static final String PBKDF2_PREFIX = "pbkdf2_sha256";
    private static final int PBKDF2_ITERATIONS = 120_000;
    private static final int PBKDF2_KEY_BITS = 256;
    private static final int SALT_BYTES = 16;

    private static final Pattern SUB_PATTERN = Pattern.compile("\"sub\"\\s*:\\s*\"([^\"]*)\"");
    private static final Pattern ROLE_PATTERN = Pattern.compile("\"role\"\\s*:\\s*\"([^\"]*)\"");
    private static final Pattern EXP_PATTERN = Pattern.compile("\"exp\"\\s*:\\s*(\\d+)");

    private final SecureRandom secureRandom = new SecureRandom();
    private final String secretKey;

    public JwtUtil(
            @Value("${app.jwt.secret:nemo-guardrails-secret-key-atbm-sgu-2026-very-secure-key}") String secretKey) {
        this.secretKey = secretKey;
    }

    public record JwtClaims(String username, String role, long expiresAt) {
        public boolean isAdmin() {
            return role != null && role.toUpperCase().contains("ADMIN");
        }
    }

    /**
     * Tạo mã JWT token chuẩn RFC 7519 (Header.Payload.Signature) dùng thuật toán HS256
     */
    public String generateToken(String username, String role) {
        try {
            String headerJson = "{\"alg\":\"HS256\",\"typ\":\"JWT\"}";
            String encodedHeader = base64UrlEncode(headerJson.getBytes(StandardCharsets.UTF_8));

            long now = System.currentTimeMillis() / 1000;
            long exp = now + (24 * 3600); // Hạn 24 giờ thay vì 7 ngày để tăng an toàn phiên

            String safeUsername = escapeJson(username);
            String safeRole = escapeJson(role);

            String payloadJson = String.format(
                "{\"sub\":\"%s\",\"username\":\"%s\",\"role\":\"%s\",\"iat\":%d,\"exp\":%d}",
                safeUsername, safeUsername, safeRole, now, exp
            );
            String encodedPayload = base64UrlEncode(payloadJson.getBytes(StandardCharsets.UTF_8));

            String dataToSign = encodedHeader + "." + encodedPayload;
            byte[] signatureBytes = signHmacSha256(dataToSign);
            String encodedSignature = base64UrlEncode(signatureBytes);

            return dataToSign + "." + encodedSignature;
        } catch (Exception e) {
            throw new RuntimeException("Lỗi sinh JWT Token: " + e.getMessage(), e);
        }
    }

    /**
     * Xác thực Authorization Bearer header: kiểm tra chữ ký HMAC-SHA256 và thời hạn JWT
     */
    public Optional<JwtClaims> verifyAuthorizationHeader(String authHeader) {
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            return Optional.empty();
        }
        String token = authHeader.substring(7).trim();
        return verifyToken(token);
    }

    public Optional<JwtClaims> verifyToken(String token) {
        if (token == null || token.isEmpty()) {
            return Optional.empty();
        }
        String[] parts = token.split("\\.");
        if (parts.length != 3) {
            return Optional.empty();
        }

        try {
            String dataToVerify = parts[0] + "." + parts[1];
            byte[] expectedSig = signHmacSha256(dataToVerify);
            byte[] providedSig = Base64.getUrlDecoder().decode(parts[2]);

            // So sánh constant-time để chống Timing Attack
            if (!MessageDigest.isEqual(expectedSig, providedSig)) {
                return Optional.empty();
            }

            String payloadJson = new String(Base64.getUrlDecoder().decode(parts[1]), StandardCharsets.UTF_8);
            String username = extractStringClaim(SUB_PATTERN, payloadJson);
            String role = extractStringClaim(ROLE_PATTERN, payloadJson);
            long exp = extractLongClaim(EXP_PATTERN, payloadJson);

            long now = System.currentTimeMillis() / 1000;
            if (username == null || username.isEmpty() || exp <= now) {
                return Optional.empty();
            }

            return Optional.of(new JwtClaims(username, role != null ? role : "", exp));
        } catch (Exception e) {
            return Optional.empty();
        }
    }

    /**
     * Băm mật khẩu an toàn với Salted PBKDF2WithHmacSHA256 (120,000 vòng lặp, chuẩn NIST SP 800-132)
     */
    public String hashPassword(String password) {
        if (password == null) return "";
        byte[] salt = new byte[SALT_BYTES];
        secureRandom.nextBytes(salt);
        byte[] derived = pbkdf2(password.toCharArray(), salt, PBKDF2_ITERATIONS, PBKDF2_KEY_BITS);
        return PBKDF2_PREFIX + "$" + PBKDF2_ITERATIONS + "$"
                + Base64.getEncoder().encodeToString(salt) + "$"
                + Base64.getEncoder().encodeToString(derived);
    }

    /**
     * Kiểm tra mật khẩu khớp với hash lưu trong DB (hỗ trợ nâng cấp từ SHA-256 cũ sang PBKDF2)
     */
    public boolean verifyPassword(String rawPassword, String storedHash) {
        if (rawPassword == null || storedHash == null || storedHash.isEmpty()) {
            return false;
        }
        if (storedHash.startsWith(PBKDF2_PREFIX + "$")) {
            String[] parts = storedHash.split("\\$");
            if (parts.length != 4) return false;
            try {
                int iterations = Integer.parseInt(parts[1]);
                byte[] salt = Base64.getDecoder().decode(parts[2]);
                byte[] expectedHash = Base64.getDecoder().decode(parts[3]);
                byte[] candidateHash = pbkdf2(rawPassword.toCharArray(), salt, iterations, expectedHash.length * 8);
                return MessageDigest.isEqual(expectedHash, candidateHash);
            } catch (Exception e) {
                return false;
            }
        }

        // Tương thích ngược cho dữ liệu SHA-256 cũ trong DB (sẽ được tự nâng cấp lên PBKDF2 ngay sau khi login)
        String legacySha256 = sha256Hex(rawPassword);
        return MessageDigest.isEqual(
                legacySha256.toLowerCase().getBytes(StandardCharsets.UTF_8),
                storedHash.toLowerCase().getBytes(StandardCharsets.UTF_8)
        );
    }

    public boolean needsRehash(String storedHash) {
        return storedHash == null || !storedHash.startsWith(PBKDF2_PREFIX + "$" + PBKDF2_ITERATIONS + "$");
    }

    private byte[] signHmacSha256(String data) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(secretKey.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        return mac.doFinal(data.getBytes(StandardCharsets.UTF_8));
    }

    private byte[] pbkdf2(char[] password, byte[] salt, int iterations, int keyBits) {
        try {
            PBEKeySpec spec = new PBEKeySpec(password, salt, iterations, keyBits);
            SecretKeyFactory skf = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256");
            return skf.generateSecret(spec).getEncoded();
        } catch (Exception e) {
            throw new RuntimeException("Lỗi băm mật khẩu PBKDF2: " + e.getMessage(), e);
        }
    }

    private String sha256Hex(String input) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] hash = md.digest(input.getBytes(StandardCharsets.UTF_8));
            StringBuilder hexString = new StringBuilder();
            for (byte b : hash) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) hexString.append('0');
                hexString.append(hex);
            }
            return hexString.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("Không tìm thấy SHA-256", e);
        }
    }

    private String extractStringClaim(Pattern pattern, String json) {
        Matcher matcher = pattern.matcher(json);
        return matcher.find() ? matcher.group(1) : null;
    }

    private long extractLongClaim(Pattern pattern, String json) {
        Matcher matcher = pattern.matcher(json);
        return matcher.find() ? Long.parseLong(matcher.group(1)) : 0L;
    }

    private String base64UrlEncode(byte[] bytes) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private String escapeJson(String s) {
        if (s == null) return "";
        return s.replace("\\", "\\\\").replace("\"", "\\\"");
    }
}
