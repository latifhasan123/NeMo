package com.nemoguardrails.proxy_backend.controller;

import com.nemoguardrails.proxy_backend.dto.ApiResponse;
import com.nemoguardrails.proxy_backend.entity.UserEntity;
import com.nemoguardrails.proxy_backend.service.UserService;
import org.springframework.web.bind.annotation.*;

import java.util.Optional;

@RestController
@RequestMapping("/api/v1/users")
@CrossOrigin(origins = "*")
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    // API lấy thông tin người dùng dựa vào username
    // GET http://localhost:8080/api/v1/users/{username}
    @GetMapping("/{username}")
    public ApiResponse<UserEntity> getUserByUsername(@PathVariable String username) {
        try {
            Optional<UserEntity> userOpt = userService.getUserByUsername(username);
            
            if (userOpt.isPresent()) {
                return new ApiResponse<>("success", "Tìm thấy thông tin người dùng", userOpt.get());
            } else {
                return new ApiResponse<>("error", "Không tìm thấy người dùng này!");
            }
        } catch (Exception e) {
            return new ApiResponse<>("error", "Lỗi khi tìm kiếm: " + e.getMessage());
        }
    }

    // API tạo mới người dùng (Dùng cho chức năng Đăng ký)
    // POST http://localhost:8080/api/v1/users
    @PostMapping
    public ApiResponse<UserEntity> createUser(@RequestBody UserEntity userEntity) {
        try {
            // Lưu ý: Trong thực tế bạn sẽ cần mã hóa mật khẩu (BCrypt) trước khi lưu, 
            // nhưng ở bước dựng khung này ta lưu thẳng để test luồng trước.
            UserEntity newUser = userService.createUser(userEntity);
            return new ApiResponse<>("success", "Tạo tài khoản thành công!", newUser);
        } catch (Exception e) {
            return new ApiResponse<>("error", "Không thể tạo tài khoản (có thể username đã tồn tại): " + e.getMessage());
        }
    }
}