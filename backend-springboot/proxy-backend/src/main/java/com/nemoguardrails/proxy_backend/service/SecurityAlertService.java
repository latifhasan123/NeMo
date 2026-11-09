package com.nemoguardrails.proxy_backend.service;

import com.nemoguardrails.proxy_backend.entity.SecurityAlertEntity;
import com.nemoguardrails.proxy_backend.repository.ChatMessageRepository;
import com.nemoguardrails.proxy_backend.repository.ChatSessionRepository;
import com.nemoguardrails.proxy_backend.repository.SecurityAlertRepository;
import com.nemoguardrails.proxy_backend.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Service
public class SecurityAlertService {

    private static final DateTimeFormatter DAY_LABEL = DateTimeFormatter.ofPattern("dd/MM");

    private final SecurityAlertRepository alertRepository;
    private final ChatMessageRepository chatMessageRepository;
    private final ChatSessionRepository chatSessionRepository;
    private final UserRepository userRepository;

    public SecurityAlertService(
            SecurityAlertRepository alertRepository,
            ChatMessageRepository chatMessageRepository,
            ChatSessionRepository chatSessionRepository,
            UserRepository userRepository) {
        this.alertRepository = alertRepository;
        this.chatMessageRepository = chatMessageRepository;
        this.chatSessionRepository = chatSessionRepository;
        this.userRepository = userRepository;
    }

    public SecurityAlertEntity createAlert(SecurityAlertEntity alertEntity) {
        return alertRepository.save(alertEntity);
    }

    public List<SecurityAlertEntity> getAllAlerts() {
        return alertRepository.findAllByOrderByIdDesc();
    }

    /**
     * Tổng hợp dữ liệu Telemetry & Analytics đầy đủ cho Bảng điều khiển Admin
     */
    public Map<String, Object> getSecurityAnalytics() {
        List<SecurityAlertEntity> alerts = alertRepository.findAllByOrderByIdDesc();
        Double chatAvgLatency = chatMessageRepository.findAverageLatencyMs();
        Double alertAvgLatency = alertRepository.findAverageAlertLatencyMs();
        Double avgLatencyMs = chatAvgLatency != null ? chatAvgLatency : alertAvgLatency;
        long totalUserPrompts = chatMessageRepository.countUserMessages();
        long totalSessions = chatSessionRepository.count();
        long totalUsers = userRepository.count();
        long uniqueSourceIps = alertRepository.countDistinctIpAddresses();
        List<LocalDateTime> messageDates = chatMessageRepository.findAllUserMessageTimestamps();

        // Tổng hợp chuỗi thời gian theo ngày (tối đa 7 ngày gần nhất có dữ liệu)
        TreeMap<LocalDate, long[]> dailyBuckets = new TreeMap<>();
        for (LocalDateTime dt : messageDates) {
            if (dt != null) {
                dailyBuckets.computeIfAbsent(dt.toLocalDate(), k -> new long[2])[0] += 1;
            }
        }
        for (SecurityAlertEntity alert : alerts) {
            if (alert.getCreatedAt() != null) {
                dailyBuckets.computeIfAbsent(alert.getCreatedAt().toLocalDate(), k -> new long[2])[1] += 1;
            }
        }

        List<Map<String, Object>> traffic = new ArrayList<>();
        List<Map.Entry<LocalDate, long[]>> entries = new ArrayList<>(dailyBuckets.entrySet());
        int startIndex = Math.max(0, entries.size() - 7);
        for (int i = startIndex; i < entries.size(); i++) {
            Map.Entry<LocalDate, long[]> entry = entries.get(i);
            long blocked = entry.getValue()[1];
            long requests = Math.max(entry.getValue()[0], blocked);
            Map<String, Object> point = new LinkedHashMap<>();
            point.put("label", entry.getKey().format(DAY_LABEL));
            point.put("requests", requests);
            point.put("blocked", blocked);
            traffic.add(point);
        }

        long effectiveTotalPrompts = Math.max(totalUserPrompts, alerts.size());
        List<String> lockedUsernames = userRepository.findAll().stream()
                .filter(u -> Boolean.FALSE.equals(u.getIsActive()))
                .map(u -> u.getUsername() != null ? u.getUsername().toLowerCase() : "")
                .filter(name -> !name.isEmpty())
                .toList();

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("recentAlerts", alerts);
        result.put("totalAlerts", alerts.size());
        result.put("avgLatencyMs", avgLatencyMs);
        result.put("totalUserPrompts", effectiveTotalPrompts);
        result.put("totalSessions", totalSessions);
        result.put("totalUsers", totalUsers);
        result.put("uniqueSourceIps", uniqueSourceIps);
        result.put("lockedUsernames", lockedUsernames);
        result.put("traffic", traffic);
        return result;
    }

    @Transactional
    public boolean deleteAlertById(Long id) {
        if (id == null || !alertRepository.existsById(id)) {
            return false;
        }
        alertRepository.deleteById(id);
        return true;
    }

    @Transactional
    public void deleteAllAlerts() {
        alertRepository.deleteAllInBatch();
    }
}
