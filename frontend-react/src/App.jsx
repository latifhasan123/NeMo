import { useEffect, useRef, useState } from 'react'
import './App.css'
import ChatPage from './pages/ChatPage.jsx'
import DashboardPage from './pages/DashboardPage.jsx'
import Sidebar from './components/Sidebar.jsx'
import Topbar from './components/Topbar.jsx'

const PROXY_URL =
  import.meta.env.VITE_PROXY_URL || 'http://localhost:8000/api/v1/chat'
const USER_ID = import.meta.env.VITE_DEMO_USER_ID || 'usr_123'
const DEMO_CLIENT_IP = '127.0.0.1'
const ADMIN_API_URL =
  import.meta.env.VITE_ADMIN_API_URL ||
  'http://localhost:8080/api/admin/dashboard'

const initialMessage = {
  id: 'welcome',
  createdAt: Date.now(),
  role: 'assistant',
  content:
    'Xin chào! Tôi là trợ lý AI được bảo vệ bởi NeMo Guardrails. Hãy đặt câu hỏi để bắt đầu cuộc trò chuyện.',
}

// Kiểm tra hợp đồng phản hồi của Proxy trước khi đưa dữ liệu vào giao diện.
function validateChatResponse(data) {
  if (!data || typeof data !== 'object') {
    throw new Error('Proxy trả về dữ liệu không hợp lệ.')
  }

  if (data.status !== 'success' && data.status !== 'blocked') {
    throw new Error('Trường "status" phải là "success" hoặc "blocked".')
  }

  if (typeof data.is_blocked !== 'boolean') {
    throw new Error('Phản hồi Proxy thiếu trường "is_blocked" dạng boolean.')
  }

  if ((data.status === 'blocked') !== data.is_blocked) {
    throw new Error('Trường "status" và "is_blocked" không nhất quán.')
  }

  if (typeof data.response !== 'string' || !data.response.trim()) {
    throw new Error('Phản hồi Proxy thiếu trường "response" dạng chuỗi.')
  }

  const executionTimeMs = Number(data.execution_time_ms)
  if (!Number.isFinite(executionTimeMs) || executionTimeMs < 0) {
    throw new Error('Trường "execution_time_ms" không hợp lệ.')
  }

  if (typeof data.session_id !== 'string' || !data.session_id.trim()) {
    throw new Error('Phản hồi Proxy thiếu trường "session_id".')
  }

  return { ...data, executionTimeMs }
}

// Kiểm tra dữ liệu dashboard để tránh hiển thị sai định dạng hoặc thiếu trường.
function validateDashboard(data) {
  const requiredNumbers = [
    'totalMessages',
    'blockedAttacks',
    'allowedMessages',
    'avgLatencyMs',
  ]

  if (!data || typeof data !== 'object') {
    throw new Error('API Dashboard trả về dữ liệu không hợp lệ.')
  }

  for (const key of requiredNumbers) {
    if (!Number.isFinite(Number(data[key]))) {
      throw new Error(`API Dashboard thiếu trường số "${key}".`)
    }
  }

  if (!Array.isArray(data.recentAlerts) || !Array.isArray(data.traffic)) {
    throw new Error('API Dashboard cần có mảng "recentAlerts" và "traffic".')
  }

  if (
    data.traffic.some(
      (item) =>
        !item ||
        typeof item.label !== 'string' ||
        !Number.isFinite(Number(item.requests)) ||
        (item.blocked !== undefined && !Number.isFinite(Number(item.blocked))),
    )
  ) {
    throw new Error('Mỗi phần tử "traffic" cần có label và requests hợp lệ.')
  }

  return data
}

function App() {
  // App giữ trạng thái và điều phối; các trang chỉ nhận dữ liệu qua props.
  const [page, setPage] = useState('chat')
  const [messages, setMessages] = useState([initialMessage])
  const [draft, setDraft] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [chatError, setChatError] = useState('')
  const [lastLatency, setLastLatency] = useState(null)
  const [dashboard, setDashboard] = useState(null)
  const [dashboardError, setDashboardError] = useState('')
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(false)
  const conversationId = useRef(null)
  const endOfMessages = useRef(null)

  // Tự cuộn xuống cuối khi có tin nhắn mới hoặc trợ lý đang xử lý.
  useEffect(() => {
    endOfMessages.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isSending])

  // Lấy chỉ số và cảnh báo bảo mật từ API quản trị.
  async function loadDashboard() {
    setIsLoadingDashboard(true)
    setDashboardError('')

    try {
      const response = await fetch(ADMIN_API_URL)
      if (!response.ok) {
        throw new Error(`Máy chủ trả về HTTP ${response.status}.`)
      }
      setDashboard(validateDashboard(await response.json()))
    } catch (error) {
      setDashboardError(
        `Không tải được số liệu từ backend: ${error.message} Kiểm tra dịch vụ và URL ${ADMIN_API_URL}.`,
      )
    } finally {
      setIsLoadingDashboard(false)
    }
  }

  // Gửi tin nhắn qua Proxy, không gọi trực tiếp nhà cung cấp mô hình AI.
  async function sendMessage(event) {
    event.preventDefault()
    const text = draft.trim()
    if (!text || isSending) return

    setDraft('')
    setChatError('')
    setMessages((current) => [
      ...current,
      {
        id: `${Date.now()}-user`,
        createdAt: Date.now(),
        role: 'user',
        content: text,
      },
    ])
    setIsSending(true)

    if (!conversationId.current) {
      conversationId.current =
        `sess_${globalThis.crypto?.randomUUID?.() || Date.now()}`
    }

    try {
      const response = await fetch(PROXY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: USER_ID,
          session_id: conversationId.current,
          message: text,
          client_ip: DEMO_CLIENT_IP,
        }),
      })

      if (!response.ok) {
        throw new Error(`Proxy trả về HTTP ${response.status}.`)
      }

      const result = validateChatResponse(await response.json())
      conversationId.current = result.session_id
      const latencyMs = result.executionTimeMs
      setLastLatency(latencyMs)
      setMessages((current) => [
        ...current,
        {
          id: `${Date.now()}-assistant`,
          createdAt: Date.now(),
          role: 'assistant',
          content: result.response,
          blocked: result.is_blocked,
          reason: [result.block_reason, result.threat_type]
            .filter((part) => typeof part === 'string' && part.trim())
            .join(' · '),
          alertLogged: result.alert_logged === true,
          latencyMs,
        },
      ])
    } catch (error) {
      setChatError(
        `Không gửi được tin nhắn: ${error.message} Hãy kiểm tra Proxy tại ${PROXY_URL}.`,
      )
    } finally {
      setIsSending(false)
    }
  }

  function startNewChat() {
    conversationId.current = null
    setMessages([initialMessage])
    setChatError('')
    setLastLatency(null)
  }

  function navigateTo(nextPage) {
    setPage(nextPage)
    if (nextPage === 'dashboard') {
      loadDashboard()
    }
  }

  return (
    <div className="app-shell">
      <Sidebar page={page} onNavigate={navigateTo} />

      <main className="main-panel">
        <Topbar page={page} />
        {page === 'chat' ? (
          <ChatPage
            messages={messages}
            draft={draft}
            onDraftChange={setDraft}
            isSending={isSending}
            chatError={chatError}
            lastLatency={lastLatency}
            endOfMessages={endOfMessages}
            onSendMessage={sendMessage}
            onNewChat={startNewChat}
          />
        ) : (
          <DashboardPage
            dashboard={dashboard}
            error={dashboardError}
            isLoading={isLoadingDashboard}
            onRefresh={loadDashboard}
          />
        )}
      </main>
    </div>
  )
}

export default App
