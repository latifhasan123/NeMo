import sys
import os
import glob
import time
import requests
import json
import re
from contextvars import ContextVar
from fastapi import FastAPI, BackgroundTasks, HTTPException, Request
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
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from fastapi.middleware.cors import CORSMiddleware

# Khởi tạo ứng dụng và nạp cấu hình Guardrails
app = FastAPI(title="AI Proxy Firewall")
config = RailsConfig.from_path("./config")
rails = LLMRails(config)

# Khởi tạo mô hình LLM trực tiếp (dùng khi tắt Guardrails để phục vụ chế độ Demo so sánh)
_main_model_cfg = next((m for m in (config.models or []) if getattr(m, "type", "") == "main"), None)
_raw_model_name = getattr(_main_model_cfg, "model", None) or "gemini-3.5-flash-lite"
raw_llm = ChatGoogleGenerativeAI(model=_raw_model_name)
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

# Context variable để bắt sự kiện bảo mật từ Colang action (mỗi request độc lập)
_security_event_ctx: ContextVar[dict | None] = ContextVar('security_event', default=None)

# 1. ĐỊNH NGHĨA HÀM ACTION MÀ CÁC FILE .CO ĐANG GỌI ĐẾN
async def action_log_security_event(event_type: str = "", **kwargs):
    # Hàm hứng lệnh execute log_security_event từ file .co
    print(f"\n[NE-MO ACTION] Đã bắt được sự kiện bảo mật từ Colang: {event_type}")
    # Lưu lại event_type để process_chat biết Colang đã kích hoạt flow bảo mật nào
    _security_event_ctx.set({"event_type": event_type})


# Đăng ký hàm action vào hệ thống Guardrails
rails.register_action(action_log_security_event, name="log_security_event")


class ChatRequest(BaseModel):
    user_id: str
    session_id: str
    message: str
    client_ip: str
    guardrails_enabled: bool = True


class ChatResponse(BaseModel):
    status: str
    is_blocked: bool
    session_id: str
    response: str
    block_reason: str | None = None
    threat_type: str | None = None
    alert_logged: bool = False
    guardrails_enabled: bool = True
    execution_time_ms: float


BACKEND_BASE_URL = os.getenv("BACKEND_BASE_URL", "http://localhost:8080").rstrip("/")
BACKEND_LOG_URL = f"{BACKEND_BASE_URL}/api/v1/alerts"
BACKEND_CHAT_RECORD_URL = f"{BACKEND_BASE_URL}/api/v1/chat/record"
BACKEND_MESSAGES_URL = f"{BACKEND_BASE_URL}/api/v1/chat/messages"
BACKEND_ACCOUNT_STATUS_URL = f"{BACKEND_BASE_URL}/api/v1/chat/account-status"


def is_user_account_active(username: str) -> bool:
    """Kiểm tra nhanh tài khoản có đang bị Quản trị viên khóa trong DB không."""
    if not username:
        return True
    try:
        resp = requests.get(
            BACKEND_ACCOUNT_STATUS_URL,
            params={"username": username.strip()},
            timeout=1.2,
        )
        if resp.status_code == 200:
            data = resp.json().get("data", {})
            if isinstance(data, dict) and data.get("active") is False:
                return False
    except Exception as e:
        print(f"-> [THÔNG BÁO] Không kiểm tra được trạng thái tài khoản: {e}")
    return True


def _resolve_client_ip(raw_request: Request, declared_ip: str) -> str:
    forwarded = raw_request.headers.get("x-forwarded-for", "").strip()
    if forwarded:
        return forwarded.split(",")[0].strip()
    if declared_ip and declared_ip not in ("127.0.0.1", "localhost", "::1"):
        return declared_ip
    if raw_request.client and raw_request.client.host:
        return raw_request.client.host
    return declared_ip or "127.0.0.1"


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


# ---------------------------------------------------------------------
# 1. BẢNG QUY TẮC PHÁT HIỆN VÀ CHUẨN HÓA VI PHẠM (CẢ 4 KỊCH BẢN AN NINH)
# ---------------------------------------------------------------------

# Danh sách tiền tố vi phạm chuẩn hóa (được định nghĩa trong cả Colang .co và config.yml)
BLOCK_PREFIX_MAP = [
    ("[BLOCKED:OFF_TOPIC]",        "OFF_TOPIC",         "off_topic_detected"),
    ("[BLOCKED:MALICIOUS_INTENT]", "MALICIOUS_INTENT",  "malicious_intent_detected"),
    ("[BLOCKED:PROMPT_LEAKAGE]",    "PROMPT_LEAKAGE",    "prompt_leakage_detected"),
    ("[BLOCKED:JAILBREAK]",        "JAILBREAK",         "jailbreak_attempt_detected"),
]

# Bảng ánh xạ: event_type trong file .co → threat_type và block_reason gửi xuống Backend
EVENT_TYPE_MAP = {
    "JAILBREAK_ATTEMPT":      {"threat_type": "JAILBREAK",         "block_reason": "jailbreak_attempt_detected"},
    "PROMPT_LEAKAGE_ATTEMPT": {"threat_type": "PROMPT_LEAKAGE",    "block_reason": "prompt_leakage_detected"},
    "MALICIOUS_INTENT":       {"threat_type": "MALICIOUS_INTENT",  "block_reason": "malicious_intent_detected"},
    "OFF_TOPIC":              {"threat_type": "OFF_TOPIC",          "block_reason": "off_topic_detected"},
}

# Bản đồ nhận diện câu từ chối dự phòng (FALLBACK) khi Gemini từ chối tự do không kèm prefix
SECURITY_CHECKS = [
    # 1. Jailbreak
    {"keyword": "không thể bỏ qua các quy tắc bảo mật",      "threat_type": "JAILBREAK",        "block_reason": "jailbreak_attempt_detected"},
    {"keyword": "bỏ qua các quy tắc",                         "threat_type": "JAILBREAK",        "block_reason": "jailbreak_attempt_detected"},
    {"keyword": "không thể bỏ qua quy định",                  "threat_type": "JAILBREAK",        "block_reason": "jailbreak_attempt_detected"},
    # 2. Prompt Leakage
    {"keyword": "bảo mật nghiêm ngặt",                         "threat_type": "PROMPT_LEAKAGE",   "block_reason": "prompt_leakage_detected"},
    {"keyword": "không thể chia sẻ thông tin này",             "threat_type": "PROMPT_LEAKAGE",   "block_reason": "prompt_leakage_detected"},
    {"keyword": "không thể chia sẻ các chỉ thị",              "threat_type": "PROMPT_LEAKAGE",   "block_reason": "prompt_leakage_detected"},
    {"keyword": "không thể cung cấp chỉ thị",                 "threat_type": "PROMPT_LEAKAGE",   "block_reason": "prompt_leakage_detected"},
    {"keyword": "cấu hình nội bộ",                             "threat_type": "PROMPT_LEAKAGE",   "block_reason": "prompt_leakage_detected"},
    # 3. Malicious Intent
    {"keyword": "tấn công phá hoại",                           "threat_type": "MALICIOUS_INTENT", "block_reason": "malicious_intent_detected"},
    {"keyword": "không thể cung cấp mã nguồn",                 "threat_type": "MALICIOUS_INTENT", "block_reason": "malicious_intent_detected"},
    {"keyword": "không thể hướng dẫn thực hiện tấn công",      "threat_type": "MALICIOUS_INTENT", "block_reason": "malicious_intent_detected"},
    {"keyword": "brute-force",                                 "threat_type": "MALICIOUS_INTENT", "block_reason": "malicious_intent_detected"},
    # 4. Off-topic (Chỉ dùng các keyword đủ đặc trưng, TRÁNH false positive)
    # LƯU Ý: Không thêm keyword nào có thể xuất hiện trong câu trả lời hợp lệ của AI
    {"keyword": "ngoài phạm vi công nghệ",                     "threat_type": "OFF_TOPIC",        "block_reason": "off_topic_detected"},
    {"keyword": "không thể hỗ trợ bạn các chủ đề",            "threat_type": "OFF_TOPIC",        "block_reason": "off_topic_detected"},
    {"keyword": "nằm ngoài phạm vi",                           "threat_type": "OFF_TOPIC",        "block_reason": "off_topic_detected"},
    {"keyword": "không thể hướng dẫn bạn nấu",                 "threat_type": "OFF_TOPIC",        "block_reason": "off_topic_detected"},
    {"keyword": "không thể hướng dẫn trang điểm",              "threat_type": "OFF_TOPIC",        "block_reason": "off_topic_detected"},
    # Các keyword bị loại bỏ vì quá chung chung, dễ xuất hiện trong câu trả lời hợp lệ:
    # "ngoài chuyên môn", "chuyên biệt về an toàn thông tin", "chuyên trách về an toàn thông tin",
    # "nếu bạn có bất kỳ thắc mắc nào về bảo mật", "nếu bạn cần hỗ trợ về bảo mật",
    # "tôi luôn sẵn sàng hỗ trợ bạn về"
]


# ---------------------------------------------------------------------
# 2. CHỐT CHẶN 1: KIỂM DUYỆT ĐẦU VÀO TỨC THÌ (FAST INPUT HEURISTICS)
# ---------------------------------------------------------------------
INPUT_GUARD_POLICIES = [
    {
        "threat_type": "JAILBREAK",
        "title": "Chống Jailbreak & Vượt rào vai trò",
        "block_reason": "jailbreak_attempt_detected",
        "colang_file": "anti_jailbreak.co",
        "default_response": "Xin lỗi, tôi không thể bỏ qua các quy tắc bảo mật và cấu hình hệ thống của mình. Tôi chỉ có thể hỗ trợ bạn trong phạm vi an toàn được cấp phép.",
        "defensive_bypass": False,
        "patterns": [
            r"admin_override",
            r"dan\s+mode",
            r"developer\s+mode",
            r"chế độ nhà phát triển",
            r"đóng vai dan",
            r"đóng vai người bà",
            r"bỏ qua (mọi|tất cả|các) (quy tắc|hướng dẫn|rào cản|chỉ thị)",
            r"ignore all (previous )?instructions",
            r"không (còn )?bị ràng buộc",
            r"quên hết (mọi )?(quy tắc|chỉ thị)",
            r"unrestricted\s+mode",
            r"god\s+mode",
        ],
    },
    {
        "threat_type": "PROMPT_LEAKAGE",
        "title": "Bảo vệ System Prompt & Cấu hình nội bộ",
        "block_reason": "prompt_leakage_detected",
        "colang_file": "protect_system_prompt.co",
        "default_response": "Các hướng dẫn nội bộ và cấu hình hệ thống được bảo mật nghiêm ngặt. Tôi không thể chia sẻ thông tin này với bạn.",
        "defensive_bypass": False,
        "patterns": [
            r"chỉ thị cốt lõi",
            r"core instructions",
            r"system prompt",
            r"system instruction",
            r"prompt gốc",
            r"bản rõ.*plain text",
            r"plain text.*chỉ thị",
            r"plain text.*cấu hình",
            r"file config\.yml",
            r"file \.co",
            r"nội dung file \.co",
            r"lệnh xuất dữ liệu",
            r"xuất dữ liệu.*chỉ thị",
            r"in ra.*system prompt",
            r"show me your hidden",
            r"cấu hình ẩn",
        ],
    },
    {
        "threat_type": "MALICIOUS_INTENT",
        "title": "Ngăn chặn Mã độc & Tấn công mạng",
        "block_reason": "malicious_intent_detected",
        "colang_file": "anti_malicious.co",
        "default_response": "Tôi là trợ lý AI của hệ thống. Yêu cầu của bạn mang tính chất tấn công phá hoại và vi phạm nghiêm trọng chính sách an toàn thông tin.",
        "defensive_bypass": True,
        "patterns": [
            r"(viết|tạo|tải|chạy|gửi)\s+.*(script|mã|tool|công cụ).*dò mật khẩu",
            r"(viết|tạo|tải|chạy|gửi)\s+.*(script|mã|tool|công cụ).*brute[- ]?force",
            r"script.*(requests|python).*dò mật khẩu",
            r"tấn công\s+(brute[- ]?force|sql injection|ddos|từ chối dịch vụ)",
            r"(tạo|viết|phát tán)\s+.*(mã độc|trojan|ransomware|keylogger|virus)",
            r"tạo trang web (giả mạo|phishing)",
            r"(hack|đánh cắp|chiếm đoạt)\s+(tài khoản|mật khẩu|facebook|wifi|database|dữ liệu)",
            r"khai thác lỗ hổng.*(đánh cắp|phá hoại|chiếm)",
        ],
    },
    {
        "threat_type": "OFF_TOPIC",
        "title": "Kiểm soát Phạm vi Chủ đề (IT & Bảo mật)",
        "block_reason": "off_topic_detected",
        "colang_file": "anti_off_topic.co",
        "default_response": "Xin lỗi, tôi là Trợ lý AI chuyên biệt về An toàn thông tin. Tôi không thể hỗ trợ bạn các chủ đề nằm ngoài phạm vi công nghệ và bảo mật.",
        "defensive_bypass": False,
        "patterns": [
            r"(hướng dẫn|cách|dạy|chỉ)\s+(tôi\s+)?(nấu|làm|chế biến)\s+(phở|bún|cơm|bánh|món|canh|thịt|cá)",
            r"nấu phở(\s+hà nội|\s+nam định|\s+bò|\s+gà)?",
            r"công thức (nấu|làm|chế biến)",
            r"địa điểm ăn uống",
            r"món (ăn )?ngon",
            r"(hướng dẫn|cách|dạy|tư vấn)\s+(tôi\s+)?(trang điểm|makeup|skincare|chăm sóc da|phối đồ)",
            r"(trang điểm|makeup).*dạ hội",
            r"son môi|kem chống nắng|thời trang mùa",
            r"(lịch trình|kế hoạch)\s+(đi\s+)?du lịch",
            r"du lịch (đà lạt|đà nẵng|nha trang|phú quốc|hạ long|vũng tàu|sa pa)",
            r"(đặt|thuê)\s+(vé máy bay|phòng khách sạn|homestay)",
            r"thời tiết hôm nay",
            r"dự báo thời tiết",
            r"kết quả (trận )?bóng đá",
            r"(bói|xem)\s+(bài tarot|tử vi|cung hoàng đạo)",
            r"(viết|làm)\s+(cho tôi\s+)?(bài thơ|thơ tình)",
            r"kể (cho tôi\s+)?(nghe\s+)?(câu\s+)?chuyện cổ tích",
            r"chơi game (liên quân|free fire|pubg)",
            r"giải (bài tập|toán|văn|hóa|lý)\s+lớp",
        ],
    },
]


def check_defensive_intent(text: str) -> bool:
    """Kiểm tra xem người dùng đang hỏi để học tập/phòng thủ an toàn hay không"""
    safe_words = [
        "phòng chống", "phòng ngừa", "phòng thủ", "ngăn chặn", "bảo vệ",
        "chống lại", "là gì", "giải thích", "nguyên lý", "tìm hiểu",
        "như thế nào", "làm sao để tránh", "cách phát hiện"
    ]
    lower = text.lower()
    return any(w in lower for w in safe_words)


def inspect_input_security(prompt: str) -> dict | None:
    """
    Quét siêu tốc câu hỏi đầu vào (Chốt chặn 1).
    Phủ đầy đủ cả 4 kịch bản an ninh: JAILBREAK, PROMPT_LEAKAGE, MALICIOUS_INTENT, OFF_TOPIC.
    """
    p = prompt.strip().lower()

    for policy in INPUT_GUARD_POLICIES:
        for pat in policy["patterns"]:
            if re.search(pat, p, re.IGNORECASE):
                if policy.get("defensive_bypass") and check_defensive_intent(p):
                    continue
                return {
                    "threat_type": policy["threat_type"],
                    "block_reason": policy["block_reason"],
                    "default_response": policy["default_response"],
                }

    return None


def _inspect_colang_files() -> list[dict]:
    """Đọc thống kê metadata các file luật Colang (.co) trong ./config"""
    config_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "config")
    files = []
    for file_path in sorted(glob.glob(os.path.join(config_dir, "*.co"))):
        filename = os.path.basename(file_path)
        description = ""
        user_intents = 0
        flows = 0
        sample_utterances = 0
        line_count = 0
        in_user_block = False

        try:
            with open(file_path, "r", encoding="utf-8") as f:
                lines = f.readlines()
            line_count = len(lines)
            for raw_line in lines:
                stripped = raw_line.strip()
                if not description and stripped.startswith("# Nhiệm vụ:"):
                    description = stripped.replace("# Nhiệm vụ:", "", 1).strip()
                if stripped.startswith("define user "):
                    user_intents += 1
                    in_user_block = True
                elif stripped.startswith("define bot ") or stripped.startswith("define flow "):
                    in_user_block = False
                    if stripped.startswith("define flow "):
                        flows += 1
                elif in_user_block and stripped.startswith('"'):
                    sample_utterances += 1
        except Exception:
            pass

        files.append({
            "filename": filename,
            "description": description or "Quy tắc kiểm soát hội thoại Colang",
            "userIntentCount": user_intents,
            "flowCount": flows,
            "sampleUtteranceCount": sample_utterances,
            "lineCount": line_count,
        })
    return files


@app.get("/api/v1/policies")
async def get_firewall_policies():
    """Trả về cấu hình chính sách Tường lửa 3 tầng trực tiếp cho Admin Policy Inspector"""
    colang_files = _inspect_colang_files()
    colang_by_name = {item["filename"]: item for item in colang_files}

    categories = []
    total_heuristic_rules = 0
    for policy in INPUT_GUARD_POLICIES:
        rule_count = len(policy["patterns"])
        total_heuristic_rules += rule_count
        co_meta = colang_by_name.get(policy["colang_file"], {})
        fallback_count = sum(1 for item in SECURITY_CHECKS if item["threat_type"] == policy["threat_type"])
        categories.append({
            "threatType": policy["threat_type"],
            "title": policy["title"],
            "blockReason": policy["block_reason"],
            "defensiveBypass": policy["defensive_bypass"],
            "heuristicRuleCount": rule_count,
            "colangFile": policy["colang_file"],
            "colangUtteranceCount": co_meta.get("sampleUtteranceCount", 0),
            "colangFlowCount": co_meta.get("flowCount", 0),
            "fallbackKeywordCount": fallback_count,
        })

    return {
        "status": "success",
        "data": {
            "service": "Sentinel AI Proxy Firewall",
            "engine": "NVIDIA NeMo Guardrails + LangChain Google GenAI",
            "model": _raw_model_name,
            "layers": [
                {
                    "id": "layer1",
                    "name": "Chốt chặn 1: Input Heuristic Guard",
                    "description": "Quét Regex siêu tốc trước khi gọi LLM để chặn các mẫu tấn công rõ ràng với độ trễ < 5ms.",
                    "ruleCount": total_heuristic_rules,
                },
                {
                    "id": "layer2",
                    "name": "Chốt chặn 2: NeMo Guardrails Colang Engine",
                    "description": "Phân tích ngữ nghĩa ý định người dùng bằng Embedding & Colang Flows, kích hoạt action log_security_event.",
                    "ruleCount": sum(item["sampleUtteranceCount"] for item in colang_files),
                },
                {
                    "id": "layer3",
                    "name": "Chốt chặn 3: Multi-Layer Output Inspection",
                    "description": "Kiểm duyệt đầu ra theo tiền tố chuẩn hóa [BLOCKED:*], Colang ContextVar và từ khóa dự phòng.",
                    "ruleCount": len(BLOCK_PREFIX_MAP) + len(SECURITY_CHECKS),
                },
            ],
            "colangFiles": colang_files,
            "categories": categories,
        },
    }


def _extract_llm_text(ai_message) -> str:
    content = getattr(ai_message, "content", ai_message)
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for item in content:
            if isinstance(item, str):
                parts.append(item)
            elif isinstance(item, dict) and item.get("text"):
                parts.append(str(item["text"]))
        return "\n".join(parts)
    return str(content or "")


@app.post("/api/v1/chat", response_model=ChatResponse)
async def process_chat(request: ChatRequest, background_tasks: BackgroundTasks, raw_request: Request):
    start_perf = time.perf_counter()
    resolved_ip = _resolve_client_ip(raw_request, request.client_ip)

    if not is_user_account_active(request.user_id):
        raise HTTPException(
            status_code=403,
            detail="Tài khoản của bạn đã bị Quản trị viên khóa do vi phạm chính sách an toàn thông tin.",
        )

    try:
        # Reset context variable trước mỗi request để tránh dùng nhầm kết quả cũ
        _security_event_ctx.set(None)

        # -------------------------------------------------------------
        # CHẾ ĐỘ DEMO TẮT TƯỜNG LỬA (BYPASS GUARDRAILS)
        # Khi guardrails_enabled=False, bỏ qua Chốt chặn 1 và NeMo Guardrails,
        # gửi thẳng tới LLM gốc để phục vụ demo so sánh trước/sau khi bật bảo vệ.
        # -------------------------------------------------------------
        if not request.guardrails_enabled:
            print("[DEMO MODE - GUARDRAILS OFF] Đang bỏ qua kiểm duyệt NeMo Guardrails...")
            history = get_session_history(request.session_id, limit=6)
            lc_messages = [
                SystemMessage(
                    content=(
                        "Bạn là một trợ lý AI thông thường, thân thiện và hữu ích. "
                        "Hãy trả lời câu hỏi của người dùng bằng tiếng Việt một cách tự nhiên, trực tiếp và chi tiết."
                    )
                )
            ]
            for item in history:
                if item["role"] == "user":
                    lc_messages.append(HumanMessage(content=item["content"]))
                else:
                    lc_messages.append(AIMessage(content=item["content"]))
            lc_messages.append(HumanMessage(content=request.message))

            ai_msg = await raw_llm.ainvoke(lc_messages)
            response_text = _extract_llm_text(ai_msg).strip()
            if not response_text:
                response_text = "Xin lỗi, mô hình không trả về nội dung phản hồi."

            execution_time = round((time.perf_counter() - start_perf) * 1000, 2)
            chat_payload = {
                "username": request.user_id,
                "sessionUuid": request.session_id,
                "userMessage": request.message,
                "botResponse": response_text,
                "latencyMs": max(1, round(execution_time)),
                "isBlocked": False
            }
            save_chat_to_backend(chat_payload)

            return ChatResponse(
                status="success",
                is_blocked=False,
                session_id=request.session_id,
                response=response_text,
                guardrails_enabled=False,
                execution_time_ms=execution_time
            )

        # -------------------------------------------------------------
        # CHỐT CHẶN 1: Quét siêu tốc đầu vào (Fast Input Heuristic Guard)
        # Bắt dứt điểm cả 4 kịch bản (JAILBREAK, PROMPT_LEAKAGE, MALICIOUS, OFF_TOPIC)
        # -------------------------------------------------------------
        input_violation = inspect_input_security(request.message)
        if input_violation:
            threat_type = input_violation["threat_type"]
            block_reason = input_violation["block_reason"]
            response_text = input_violation["default_response"]
            execution_time = round((time.perf_counter() - start_perf) * 1000, 2)
            stored_latency_ms = max(1, round(execution_time))
            print(f"[PHÁT HIỆN TẤN CÔNG] User: {request.user_id} | Nguồn: Chốt chặn đầu vào | Loại: {threat_type}")

            # Lưu phiên chat vi phạm sang Spring Boot Backend
            chat_payload = {
                "username": request.user_id,
                "sessionUuid": request.session_id,
                "userMessage": request.message,
                "botResponse": response_text,
                "latencyMs": stored_latency_ms,
                "isBlocked": True
            }
            save_chat_to_backend(chat_payload)

            # Gửi cảnh báo vi phạm an ninh sang Spring Boot Backend (kèm username & độ trễ)
            alert_payload = {
                "username": request.user_id,
                "ipAddress": resolved_ip,
                "threatType": threat_type,
                "severityLevel": "HIGH",
                "blockedPayload": request.message,
                "latencyMs": stored_latency_ms,
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
                guardrails_enabled=True,
                execution_time_ms=execution_time
            )

        # -------------------------------------------------------------
        # CHỐT CHẶN 2: Xử lý qua NeMo Guardrails + Gemini
        # LƯU Ý: Chỉ truyền tin nhắn hiện tại vào NeMo để ngăn lịch sử hội thoại
        # làm nhiễu Colang intent matching (gây false positive khi câu hợp lệ
        # xuất hiện sau câu off-topic trong cùng một phiên)
        # -------------------------------------------------------------
        nemo_messages = [{"role": "user", "content": request.message}]

        # 1. Nhận kết quả từ Guardrails (chỉ dùng tin nhắn hiện tại để kiểm tra intent)
        response = await rails.generate_async(messages=nemo_messages)
        
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

        execution_time = round((time.perf_counter() - start_perf) * 1000, 2)
        stored_latency_ms = max(1, round(execution_time))

        # 3. KIỂM DUYỆT BẢO MẬT ĐA TẦNG (KẾT HỢP PREFIX CHUẨN HÓA + COLANG EVENT + FALLBACK KEYWORD)
        matched_check = None

        # 3a. Tầng 1: Kiểm tra tiền tố chuẩn hóa [BLOCKED:...] từ phản hồi của AI / Colang
        for prefix, threat_type, block_reason in BLOCK_PREFIX_MAP:
            if prefix in response_text:
                matched_check = {"threat_type": threat_type, "block_reason": block_reason}
                # Xóa sạch tiền tố để giao diện người dùng hiển thị thông điệp tự nhiên
                response_text = response_text.replace(prefix, "").strip()
                print(f"[PHÁT HIỆN TẤN CÔNG] User: {request.user_id} | Nguồn: Tiền tố ({prefix}) | Loại: {threat_type}")
                break

        # 3b. Tầng 2: Kiểm tra xem Colang flow có kích hoạt log_security_event không
        if not matched_check:
            colang_event = _security_event_ctx.get()
            if colang_event:
                event_info = EVENT_TYPE_MAP.get(colang_event["event_type"])
                if event_info:
                    matched_check = event_info
                    print(f"[PHÁT HIỆN TẤN CÔNG] User: {request.user_id} | Nguồn: Colang flow | Loại: {colang_event['event_type']}")
        
        # 3c. Tầng 3: Kiểm tra từ khóa từ chối dự phòng (FALLBACK)
        if not matched_check:
            lower_response = response_text.lower()
            for check in SECURITY_CHECKS:
                if check["keyword"] in lower_response:
                    matched_check = check
                    print(f"[PHÁT HIỆN TẤN CÔNG] User: {request.user_id} | Nguồn: Keyword fallback | Keyword: '{check['keyword']}'")
                    break

        # Đảm bảo xóa bất kỳ tiền tố [BLOCKED:...] nào còn sót lại trong chuỗi
        for prefix, _, _ in BLOCK_PREFIX_MAP:
            if prefix in response_text:
                response_text = response_text.replace(prefix, "").strip()

        # 4. Tự động lưu phiên chat và tin nhắn sang Spring Boot Backend trước khi trả về
        chat_payload = {
            "username": request.user_id,
            "sessionUuid": request.session_id,
            "userMessage": request.message,
            "botResponse": response_text,
            "latencyMs": stored_latency_ms,
            "isBlocked": matched_check is not None
        }
        save_chat_to_backend(chat_payload)

        if matched_check:
            threat_type = matched_check["threat_type"]
            block_reason = matched_check["block_reason"]

            alert_payload = {
                "username": request.user_id,
                "ipAddress": resolved_ip,
                "threatType": threat_type,
                "severityLevel": "HIGH",
                "blockedPayload": request.message,
                "latencyMs": stored_latency_ms,
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
                guardrails_enabled=True,
                execution_time_ms=execution_time
            )

        return ChatResponse(
            status="success",
            is_blocked=False,
            session_id=request.session_id,
            response=response_text,
            guardrails_enabled=True,
            execution_time_ms=execution_time
        )

    except HTTPException:
        raise
    except Exception as e:
        print(f"\n[LỖI SERVER PROXY] Đã xảy ra lỗi: {e}\n")
        raise HTTPException(status_code=500, detail=str(e))
