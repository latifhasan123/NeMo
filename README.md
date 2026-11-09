# Sentinel AI - NeMo Guardrails Proxy Firewall

Hệ thống Tường lửa AI Proxy bảo vệ Mô hình Ngôn ngữ Lớn (LLM) chống lại các tấn công **Prompt Injection**, **Jailbreak**, **Prompt Leakage**, **Mã độc & Tấn công mạng** và **Off-topic**, tích hợp **NVIDIA NeMo Guardrails**, **Spring Boot 4 (Java 17)**, **FastAPI (Python)**, **MySQL 8.0** và **React 19 (Vite)**.

---

## 🚀 Hướng dẫn khởi chạy nhanh bằng Docker (Khuyên dùng)

### 📌 Yêu cầu trước khi chạy
Máy tính chỉ cần cài đặt và mở sẵn **[Docker Desktop](https://www.docker.com/products/docker-desktop/)**.  
*(Không cần cài đặt thêm Java, Python, Node.js hay MySQL vào máy)*.

---

### 🛠️ Các bước thực hiện từ đầu đến cuối

#### Bước 1: Clone dự án về máy
Mở Terminal / PowerShell / Git Bash và chạy:
```bash
git clone <URL_REPO_CỦA_BẠN>
cd NeMo
```

#### Bước 2: Tạo file cấu hình API Key (`.env`)
1. Nhân bản file mẫu `.env.example` thành file `.env`:
   - Trên **Windows PowerShell / CMD**:
     ```powershell
     copy .env.example .env
     ```
   - Trên **Git Bash / macOS / Linux**:
     ```bash
     cp .env.example .env
     ```
   *(Hoặc bạn có thể nhấp chuột phải vào file `.env.example`, chọn Copy rồi Paste, đổi tên thành `.env`)*.

2. Mở file `.env` vừa tạo bằng Notepad hoặc VS Code, thay thế khóa API của bạn vào:
   ```env
   GOOGLE_API_KEY=AIzaSy...
   ```
   *(Nếu chưa có API Key, bạn có thể tạo hoàn toàn miễn phí tại: https://aistudio.google.com/app/apikey)*.

#### Bước 3: Khởi chạy toàn bộ hệ thống bằng 1 lệnh duy nhất
Tại thư mục gốc dự án, chạy lệnh:
```bash
docker compose up --build -d
```
> **Giải thích:** Docker sẽ tự động kéo các gói container, biên dịch Spring Boot, cài đặt NeMo Guardrails và build giao diện React. Quá trình này chạy ngầm và mất khoảng 1 - 3 phút trong lần đầu tiên.

#### Bước 4: Mở trình duyệt và sử dụng
- **Giao diện Trò chuyện & Bảng điều khiển Admin:** [http://localhost:5173](http://localhost:5173)
  - **Tài khoản Quản trị viên (Admin mặc định):**
    - Tên đăng nhập: `admin`
    - Mật khẩu: `Admin@123456`
  - **Tài khoản người dùng mới:** Có thể tự bấm **"Đăng ký mới"** trên màn hình để tạo và trải nghiệm.
- **Tài liệu API Spring Boot Backend:** [http://localhost:8080/api/v1/alerts](http://localhost:8080/api/v1/alerts)
- **Tài liệu Swagger AI Proxy (Python FastAPI):** [http://localhost:8000/docs](http://localhost:8000/docs)

---

### 🛑 Cách tắt hệ thống khi dùng xong
Khi muốn dừng toàn bộ container, chỉ cần mở terminal tại thư mục dự án và chạy:
```bash
docker compose down
```

*(Nếu muốn xóa sạch cả dữ liệu database trong Docker để chạy lại từ đầu: `docker compose down -v`)*.
