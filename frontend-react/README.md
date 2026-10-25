# AI Security Frontend

React + Vite frontend for the prompt-injection protection demo. It provides a
chat page that calls the Python Guardrails proxy and an admin dashboard that
reads aggregate data from the Spring Boot backend.

## Run locally

Mở PowerShell tại thư mục `ai-security-frontend`, sau đó chạy:

```sh
npm install
npm run dev
```

Vite sẽ in địa chỉ local (thường là `http://localhost:5173`) để mở ứng dụng.
Các lệnh kiểm tra mã nguồn và tạo bản build production:

```sh
npm run lint
npm run build
```

## Cấu trúc mã nguồn

```text
src/
├── App.jsx                       # Trạng thái ứng dụng và gọi API
├── components/                   # Các phần giao diện nhỏ, có thể tái sử dụng
│   ├── MessageBubble.jsx         # Một tin nhắn và trạng thái kiểm duyệt
│   ├── SecurityAlert.jsx         # Một cảnh báo bảo mật
│   ├── Sidebar.jsx               # Thanh điều hướng
│   ├── StatCard.jsx              # Thẻ chỉ số dashboard
│   ├── Topbar.jsx                # Thanh tiêu đề trên cùng
│   └── TrafficChart.jsx          # Biểu đồ lưu lượng
└── pages/
    ├── ChatPage.jsx              # Giao diện trò chuyện và nhập tin nhắn
    └── DashboardPage.jsx         # Ghép các chỉ số, biểu đồ, cảnh báo
```

`App.jsx` chịu trách nhiệm điều phối trạng thái, phiên chat, gọi Proxy/API và
truyền dữ liệu xuống trang bằng props. `ChatPage.jsx` và `DashboardPage.jsx`
chỉ dựng giao diện của từng trang; các phần dùng lại được đặt trong
`components/`. CSS hiện tại vẫn nằm trong `App.css`, nên việc tách file không
thay đổi giao diện hoặc luồng hoạt động.

The app expects the following local services by default:

| Service | Default URL | Purpose |
| --- | --- | --- |
| Python Guardrails proxy | `http://localhost:8000/api/v1/chat` | Chat request/response |
| Spring Boot API | `http://localhost:8080/api/admin/dashboard` | Admin metrics and security alerts |

Override the URLs with Vite environment variables in a local `.env` file:

```dotenv
VITE_PROXY_URL=http://localhost:8000/api/v1/chat
VITE_DEMO_USER_ID=usr_123
VITE_ADMIN_API_URL=http://localhost:8080/api/admin/dashboard
```

Restart Vite after changing `.env`. Do not put API keys or other secrets in
`VITE_*` variables; those values are included in browser code.

## Frontend API contracts

### Chat proxy

The frontend sends a JSON `POST` request to `http://localhost:8000/api/v1/chat`:

```json
{
  "user_id": "usr_123",
  "session_id": "sess_...",
  "message": "Nội dung chat của user",
  "client_ip": "127.0.0.1"
}
```

For a local demo, the frontend sends `127.0.0.1` as `client_ip` because the
proxy contract requires the field. This is a demo value, not a trustworthy
client address. The proxy/backend must derive the actual peer IP from the
request when recording security logs; never trust a client-supplied IP for
security decisions.

For a successful request, the proxy returns:

```json
{
  "status": "success",
  "is_blocked": false,
  "session_id": "sess_...",
  "response": "Nội dung AI trả lời bình thường...",
  "execution_time_ms": 520.4
}
```

For a blocked request, the proxy returns:

```json
{
  "status": "blocked",
  "is_blocked": true,
  "session_id": "sess_...",
  "response": "Yêu cầu của bạn đã bị từ chối do vi phạm chính sách an toàn bảo mật hệ thống.",
  "block_reason": "prompt_injection_detected",
  "threat_type": "jailbreak_attempt",
  "alert_logged": true,
  "execution_time_ms": 150.2
}
```

The frontend checks `status`, `is_blocked`, `session_id`, `response`, and
`execution_time_ms`. It displays `block_reason` and `threat_type` when a request
is blocked. The displayed execution time is the proxy's timing, not a browser
round-trip measurement.

### Admin dashboard

The dashboard expects this JSON response from the Spring Boot API:

```json
{
  "totalMessages": 120,
  "blockedAttacks": 8,
  "allowedMessages": 112,
  "avgLatencyMs": 240,
  "traffic": [
    { "label": "09:00", "requests": 24, "blocked": 2 }
  ],
  "recentAlerts": [
    {
      "id": 1,
      "createdAt": "2026-10-12T09:00:00",
      "ipAddress": "127.0.0.1",
      "label": "Prompt injection bị chặn",
      "severity": "HIGH"
    }
  ]
}
```

The backend must enforce Admin authorization on this endpoint. Hiding a
dashboard in React is not an access-control mechanism. Configure CORS on both
services to allow the Vite development origin when running locally.

## Quốc Anh's frontend responsibilities

1. Keep the chat flow connected to the Python proxy, not directly to the LLM
   provider. Display proxy errors instead of silently substituting a fake AI
   answer.
2. Agree on request and response field names with the proxy developer. The
   current contract is documented above; update both implementations together
   if the proxy uses different names.
3. Connect dashboard metrics and alerts to Spring Boot. Coordinate the response
   schema and Admin authorization with the backend developer.
4. Measure end-to-end latency in the browser and keep the reported metric
   distinct from model-only or guardrail-only timings returned by the proxy.
5. Test normal messages, blocked requests, service/network errors, dashboard
   empty states, and narrow mobile layouts before the live demo.

## Scripts

- `npm run dev` — start the Vite development server.
- `npm run lint` — run Oxlint.
- `npm run build` — create the production bundle.
