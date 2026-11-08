package com.nemoguardrails.proxy_backend.util;

import org.springframework.stereotype.Component;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Base64;

@Component
public class JwtUtil {

    private static final String SECRET_KEY = "nemo-guardrails-secret-key-atbm-sgu-2026-very-secure-key";

    /**
     * Tạo mã JWT token chuẩn RFC 7519 (Header.Payload.Signature) dùng thuật toán HS256
     * Sử dụng hoàn toàn thư viện chuẩn của Java để đảm bảo không bị lỗi phụ thuộc thư viện
     */
    public String generateToken(String username, String role) {
        try {
            // 1. Header JSON
            String headerJson = "{\"alg\":\"HS256\",\"typ\":\"JWT\"}";
            String encodedHeader = base64UrlEncode(headerJson.getBytes(StandardCharsets.UTF_8));

            // 2. Payload JSON (Claims)
            long now = System.currentTimeMillis() / 1000;
            long exp = now + (7 * 24 * 3600); // 7 ngày

            String safeUsername = escapeJson(username);
            String safeRole = escapeJson(role);

            String payloadJson = String.format(
                "{\"sub\":\"%s\",\"username\":\"%s\",\"role\":\"%s\",\"iat\":%d,\"exp\":%d}",
                safeUsername, safeUsername, safeRole, now, exp
            );
            String encodedPayload = base64UrlEncode(payloadJson.getBytes(StandardCharsets.UTF_8));

            // 3. Signature (HMAC-SHA256)
            String dataToSign = encodedHeader + "." + encodedPayload;
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(SECRET_KEY.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] signatureBytes = mac.doFinal(dataToSign.getBytes(StandardCharsets.UTF_8));
            String encodedSignature = base64UrlEncode(signatureBytes);

            return dataToSign + "." + encodedSignature;
        } catch (Exception e) {
            throw new RuntimeException("Lỗi sinh JWT Token: " + e.getMessage(), e);
        }
    }

    /**
     * Mã hóa mật khẩu bằng thuật toán SHA-256
     */
    public String hashPassword(String password) {
        if (password == null) return "";
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] hash = md.digest(password.getBytes(StandardCharsets.UTF_8));
            StringBuilder hexString = new StringBuilder();
            for (byte b : hash) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) hexString.append('0');
                hexString.append(hex);
            }
            return hexString.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("Không tìm thấy thuật toán mã hóa SHA-256", e);
        }
    }

    private String base64UrlEncode(byte[] bytes) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private String escapeJson(String s) {
        if (s == null) return "";
        return s.replace("\\", "\\\\").replace("\"", "\\\"");
    }
}
