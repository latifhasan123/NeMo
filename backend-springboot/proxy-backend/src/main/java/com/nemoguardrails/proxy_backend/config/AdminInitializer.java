package com.nemoguardrails.proxy_backend.config;

import com.nemoguardrails.proxy_backend.service.AuthService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

@Component
public class AdminInitializer implements CommandLineRunner {

    private final AuthService authService;
    private final String adminUsername;
    private final String adminPassword;

    public AdminInitializer(
            AuthService authService,
            @Value("${app.admin.username:admin}") String adminUsername,
            @Value("${app.admin.password:Admin@123456}") String adminPassword) {
        this.authService = authService;
        this.adminUsername = adminUsername;
        this.adminPassword = adminPassword;
    }

    @Override
    public void run(String... args) {
        authService.ensureSeededAdmin(adminUsername, adminPassword);
    }
}
