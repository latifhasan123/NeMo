package com.nemoguardrails.proxy_backend.service;

import com.nemoguardrails.proxy_backend.entity.UserEntity;
import com.nemoguardrails.proxy_backend.repository.UserRepository;
import org.springframework.stereotype.Service;

import java.util.Optional;

@Service
public class UserService {

    private final UserRepository userRepository;

    public UserService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    // Tìm user theo tên đăng nhập
    public Optional<UserEntity> getUserByUsername(String username) {
        return userRepository.findByUsername(username);
    }

    // Lưu user mới vào database
    public UserEntity createUser(UserEntity userEntity) {
        return userRepository.save(userEntity);
    }
}