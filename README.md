# Sentinel AI - NeMo Guardrails Proxy Firewall

Hệ thống Tường lửa AI Proxy bảo vệ Mô hình Ngôn ngữ Lớn (LLM) chống lại các tấn công **Prompt Injection**, **Jailbreak**, **Prompt Leakage**, **Mã độc & Tấn công mạng** và **Off-topic**, tích hợp **NVIDIA NeMo Guardrails**, **Spring Boot 4 (Java 17)**, **FastAPI (Python)**, **MySQL 8.0** và **React 19 (Vite)**.

---

## 🚀 Hướng dẫn khởi chạy nhanh bằng Docker (Khuyên dùng)

### 📌 Yêu cầu trước khi chạy
Máy tính chỉ cần cài đặt và mở sẵn **[Docker Desktop](https://www.docker.com/products/docker-desktop/)**.  
*(Không cần cài đặt thêm Java, Python, Node.js hay MySQL vào máy cá nhân)*.

---

### 🛠️ Các bước thực hiện từ đầu đến cuối

#### Bước 1: Clone dự án về máy
Mở Terminal / PowerShell / Git Bash và chạy lệnh:
```bash
git clone https://github.com/latifhasan123/NeMo.git
cd NeMo
```

#### Bước 2: Tạo file cấu hình API Key (`.env`)
1. Nhân bản file mẫu `.env.example` thành file `.env`:
   - Trên **Windows (PowerShell hoặc CMD)**:
     ```powershell
     copy .env.example .env
     ```
   - Trên **Git Bash / macOS / Linux**:
     ```bash
     cp .env.example .env
     ```
   *(Hoặc nhấp chuột phải vào `.env.example` -> Copy -> Paste -> đổi tên thành `.env`)*.

2. Mở file `.env` vừa tạo bằng Notepad hoặc VS Code, điền mã API Key được Trưởng nhóm cấp:
   ```env
   GOOGLE_API_KEY=AIzaSy... (dán mã API Key được Trưởng nhóm gửi vào đây)
   ```

> [!IMPORTANT]
> **Quy định bảo mật nội bộ:**  
> Mã `GOOGLE_API_KEY` của hệ thống là thông tin tuyệt mật. **Trưởng nhóm sẽ gửi trực tiếp mã API Key qua tin nhắn riêng cho các thành viên trong nhóm**. Tuyệt đối không chia sẻ mã này ra bên ngoài hoặc tải lên các nền tảng công cộng.

#### Bước 3: Khởi chạy toàn bộ hệ thống bằng 1 lệnh duy nhất
Tại thư mục gốc dự án, chạy lệnh:
```bash
docker compose up --build -d
```
> **Giải thích:** Docker sẽ tự động tải container MySQL 8.0, biên dịch Spring Boot Java 17, nạp mô hình tường lửa NeMo Guardrails và build web React. Quá trình chạy ngầm mất khoảng 1 - 3 phút trong lần đầu tiên.

#### Bước 4: Mở trình duyệt và sử dụng
- **Giao diện Trò chuyện & Bảng điều khiển Admin:** [http://localhost:5173](http://localhost:5173)
  - **Tài khoản Quản trị viên (Admin mặc định):**
    - Tên đăng nhập: `admin`
    - Mật khẩu: `Admin@123456`
  - **Tài khoản người dùng mới:** Có thể tự bấm **"Đăng ký mới"** trên màn hình để tạo tài khoản riêng để chat.
- **Tài liệu API Spring Boot Backend:** [http://localhost:8080/api/v1/alerts](http://localhost:8080/api/v1/alerts)
- **Tài liệu Swagger AI Proxy (Python FastAPI):** [http://localhost:8000/docs](http://localhost:8000/docs)

---

### 🛑 Cách tắt hệ thống khi dùng xong
Khi muốn dừng toàn bộ container, chỉ cần mở terminal tại thư mục dự án và chạy:
```bash
docker compose down
```

*(Nếu muốn dọn sạch cả dữ liệu database trong Docker để chạy lại từ đầu: `docker compose down -v`)*.
