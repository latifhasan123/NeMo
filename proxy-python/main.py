import time
import requests
import json
from fastapi import FastAPI, BackgroundTasks, HTTPException
from pydantic import BaseModel
from nemoguardrails import RailsConfig, LLMRails
from dotenv import load_dotenv
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

# Khởi tạo ứng dụng và nạp cấu hình Guardrails
app = FastAPI(title="AI Proxy Firewall")
config = RailsConfig.from_path("./config")
rails = LLMRails(config)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Cho phép tất cả Frontend (cổng 3000, 5173...) gọi vào
    allow_credentials=True,
    allow_methods=["*"],  # Cho phép mọi phương thức POST, GET...
    allow_headers=["*"],
)

# 1. ĐỊNH NGHĨA HÀM ACTION MÀ CÁC FILE .CO ĐANG GỌI ĐẾN
async def action_log_security_event(event_type: str):
    # Hàm giả lập để hứng lệnh execute log_security_event từ file .co[cite: 6, 7, 8]
    # Ta không code xử lý ở đây vì đã có luồng gửi log riêng bên dưới
    pass


# Đăng ký hàm action vào hệ thống Guardrails
rails.register_action(action_log_security_event, name="log_security_event")


class ChatRequest(BaseModel):
    user_id: str
    session_id: str
    message: str
    client_ip: str


class ChatResponse(BaseModel):
    status: str
    is_blocked: bool
    session_id: str
    response: str
    block_reason: str = None
    threat_type: str = None
    alert_logged: bool = False
    execution_time_ms: float


BACKEND_LOG_URL = "http://localhost:8080/api/v1/alerts"


def send_log_to_backend(payload: dict):
    print("\n[CẢNH BÁO] Phát hiện tấn công. Payload chuẩn bị gửi sang Backend:")
    print(json.dumps(payload, indent=2, ensure_ascii=False))

    try:
        response = requests.post(BACKEND_LOG_URL, json=payload, timeout=3.0)
        print(f"-> Đã gửi log thành công. Mã trạng thái Backend: {response.status_code}\n")
    except requests.exceptions.Timeout:
        print("-> [LỖI] Backend phản hồi quá chậm (quá 3 giây). Đã hủy gửi log để không block luồng!\n")
    except requests.exceptions.RequestException as e:
        print(f"-> [LỖI] Không thể kết nối Backend (Khả năng Nhóm trưởng chưa bật server): {e}\n")


@app.post("/api/v1/chat", response_model=ChatResponse)
async def process_chat(request: ChatRequest, background_tasks: BackgroundTasks):
    start_time = time.time()

    try:
        # 1. Nhận kết quả thô từ Guardrails
        raw_response = await rails.generate_async(
            messages=[{"role": "user", "content": request.message}]
        )

        # 2. Trích xuất chính xác chuỗi text từ Dictionary
        if isinstance(raw_response, dict):
            response_text = raw_response.get("content", "")
        else:
            response_text = str(raw_response)

        execution_time = round((time.time() - start_time) * 1000, 2)

        # Kiểm tra từ khóa từ chối trong câu trả lời đã được trích xuất
        is_blocked = "bảo mật" in response_text or "an toàn" in response_text

        if is_blocked:
            alert_payload = {
                "sessionId": request.session_id,  # Khóa ngoại trỏ về chat_sessions
                "userId": request.user_id,  # Khóa ngoại trỏ về users
                "ipAddress": request.client_ip,
                "threatType": "PROMPT_INJECTION",
                "severityLevel": "HIGH",
                "blockedPayload": request.message,
                "actionTaken": "BLOCKED",  # Hành động thực thi
                "proxyLatencyMs": execution_time
            }

            background_tasks.add_task(send_log_to_backend, alert_payload)

            return ChatResponse(
                status="blocked",
                is_blocked=True,
                session_id=request.session_id,
                response=response_text,
                block_reason="prompt_injection_detected",
                threat_type="PROMPT_INJECTION",
                alert_logged=True,
                execution_time_ms=execution_time
            )

        return ChatResponse(
            status="success",
            is_blocked=False,
            session_id=request.session_id,
            response=response_text,
            execution_time_ms=execution_time
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))