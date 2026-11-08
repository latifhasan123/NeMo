import sys
import os
import time
import requests
import json
from fastapi import FastAPI, BackgroundTasks, HTTPException
from pydantic import BaseModel

# Cấu hình UTF-8 cho console Windows để tránh UnicodeEncodeError khi in tiếng Việt
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

# 1. BẮT BUỘC PHẢI NẠP FILE .ENV VÀO HỆ THỐNG TRƯỚC
from dotenv import load_dotenv
load_dotenv()

# Yêu cầu NeMo Guardrails sử dụng framework LangChain cho Google GenAI
os.environ["NEMOGUARDRAILS_LLM_FRAMEWORK"] = "langchain"

# 2. SAU KHI ĐÃ CÓ BIẾN MÔI TRƯỜNG, MỚI GỌI NEMOGUARDRAILS RA
from nemoguardrails import RailsConfig, LLMRails
from fastapi.middleware.cors import CORSMiddleware

# Khởi tạo ứng dụng và nạp cấu hình Guardrails
app = FastAPI(title="AI Proxy Firewall")
config = RailsConfig.from_path("./config")
rails = LLMRails(config)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Cho phép tất cả các nguồn (hoặc cụ thể là "http://localhost:5173")
    allow_credentials=True,
    allow_methods=["*"], # Cho phép mọi method (bao gồm cả OPTIONS, POST, GET)
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {
        "status": "online",
        "service": "AI Proxy Firewall (NeMo Guardrails)",
        "docs_url": "/docs"
    }

# 1. ĐỊNH NGHĨA HÀM ACTION MÀ CÁC FILE .CO ĐANG GỌI ĐẾN
async def action_log_security_event(event_type: str = "", **kwargs):
    # Hàm hứng lệnh execute log_security_event từ file .co
    print(f"\n[NE-MO ACTION] Đã bắt được sự kiện bảo mật từ Colang: {event_type}")


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
    block_reason: str | None = None
    threat_type: str | None = None
    alert_logged: bool = False
    execution_time_ms: float


BACKEND_LOG_URL = "http://localhost:8080/api/v1/alerts"
BACKEND_CHAT_RECORD_URL = "http://localhost:8080/api/v1/chat/record"
BACKEND_MESSAGES_URL = "http://localhost:8080/api/v1/chat/messages"


def get_session_history(session_uuid: str, limit: int = 6):
    """
    Lấy các tin nhắn trước đó của phiên chat từ Backend để AI có ngữ cảnh trò chuyện liên tục
    """
    if not session_uuid:
        return []
    try:
        url = f"{BACKEND_MESSAGES_URL}?sessionId={session_uuid}"
        response = requests.get(url, timeout=1.5)
        if response.status_code == 200:
            payload = response.json()
            data = payload.get("data", []) if isinstance(payload, dict) else []
            history = []
            recent_msgs = data[-limit:] if len(data) > limit else data
            for item in recent_msgs:
                role = "user" if item.get("senderRole") in ["user", "human"] else "assistant"
                content = item.get("content", "")
                if content and isinstance(content, str) and content.strip():
                    history.append({"role": role, "content": content.strip()})
            return history
    except Exception as e:
        print(f"-> [THÔNG BÁO] Không thể lấy lịch sử phiên chat cũ: {e}")
    return []


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


def save_chat_to_backend(payload: dict):
    try:
        response = requests.post(BACKEND_CHAT_RECORD_URL, json=payload, timeout=2.0)
        if response.status_code == 200:
            print(f"-> [LỊCH SỬ CHAT] Đã tự động lưu phiên chat '{payload.get('sessionUuid')}' sang Spring Boot Backend.")
    except Exception as e:
        print(f"-> [THÔNG BÁO] Không thể lưu phiên chat sang Backend: {e}")


# Bản đồ nhận diện câu từ chối từ kịch bản Colang (.co)
SECURITY_CHECKS = [
    {
        "keyword": "không thể bỏ qua các quy tắc bảo mật",
        "threat_type": "JAILBREAK",
        "block_reason": "jailbreak_attempt_detected"
    },
    {
        "keyword": "bảo mật nghiêm ngặt",
        "threat_type": "PROMPT_LEAKAGE",
        "block_reason": "prompt_leakage_detected"
    },
    {
        "keyword": "vi phạm chính sách an toàn",
        "threat_type": "MALICIOUS_INTENT",
        "block_reason": "malicious_topic_detected"
    }
]


@app.post("/api/v1/chat", response_model=ChatResponse)
async def process_chat(request: ChatRequest, background_tasks: BackgroundTasks):
    start_time = time.time()

    try:
        # Lấy lịch sử hội thoại trước đó để AI có ngữ cảnh trò chuyện liên tục (Multi-turn Memory)
        conversation_messages = get_session_history(request.session_id, limit=6)
        conversation_messages.append({"role": "user", "content": request.message})

        # 1. Nhận kết quả từ Guardrails (gọi tới LLM gemini kèm toàn bộ ngữ cảnh hội thoại)
        response = await rails.generate_async(messages=conversation_messages)
        
        try:
            print("\nDEBUG KẾT QUẢ TỪ AI:", response)
        except Exception:
            pass

        # 2. Trích xuất chính xác chuỗi text từ response
        if isinstance(response, dict):
            response_text = response.get("content", "")
        else:
            response_text = str(response)

        # Nếu response rỗng (do không có flow nào bắt được hoặc LLM không phản hồi), dùng fallback
        if not response_text or not response_text.strip():
            response_text = "Xin lỗi, hệ thống không thể xử lý yêu cầu lúc này. Vui lòng thử lại sau ít giây."

        execution_time = round((time.time() - start_time) * 1000, 2)

        # 3. Kiểm tra xem câu trả lời có khớp với kịch bản từ chối bảo mật không
        lower_response = response_text.lower()
        matched_check = None
        for check in SECURITY_CHECKS:
            if check["keyword"] in lower_response:
                matched_check = check
                break

        # 4. Tự động lưu phiên chat và tin nhắn sang Spring Boot Backend trước khi trả về
        chat_payload = {
            "username": request.user_id,
            "sessionUuid": request.session_id,
            "userMessage": request.message,
            "botResponse": response_text,
            "latencyMs": int(execution_time),
            "isBlocked": matched_check is not None
        }
        save_chat_to_backend(chat_payload)

        if matched_check:
            threat_type = matched_check["threat_type"]
            block_reason = matched_check["block_reason"]

            alert_payload = {
                "ipAddress": request.client_ip,
                "threatType": threat_type,
                "severityLevel": "HIGH",
                "blockedPayload": request.message
            }

            background_tasks.add_task(send_log_to_backend, alert_payload)

            return ChatResponse(
                status="blocked",
                is_blocked=True,
                session_id=request.session_id,
                response=response_text,
                block_reason=block_reason,
                threat_type=threat_type,
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
        print(f"\n[LỖI SERVER PROXY] Đã xảy ra lỗi: {e}\n")
        raise HTTPException(status_code=500, detail=str(e))
