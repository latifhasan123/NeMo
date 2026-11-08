import { useCallback, useEffect, useRef, useState } from 'react'
import './App.css'
import Sidebar from './components/Sidebar'
import ChatPage from './pages/ChatPage'
import DashboardPage from './pages/DashboardPage'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'
const PROXY_URL = import.meta.env.VITE_PROXY_URL || 'http://localhost:8000/api/v1/chat'
const AUTH_API_URL = import.meta.env.VITE_AUTH_API_URL || `${API_BASE_URL}/api/auth/login`
const REGISTER_API_URL = import.meta.env.VITE_REGISTER_API_URL || `${API_BASE_URL}/api/auth/register`
const SESSIONS_API_URL = import.meta.env.VITE_SESSIONS_API_URL || `${API_BASE_URL}/api/v1/chat/sessions`
const MESSAGES_API_URL = import.meta.env.VITE_MESSAGES_API_URL || `${API_BASE_URL}/api/v1/chat/messages`
const ADMIN_API_URL = import.meta.env.VITE_ADMIN_API_URL || `${API_BASE_URL}/api/v1/alerts`
const USER_ID = import.meta.env.VITE_DEMO_USER_ID || 'usr_123'

function parseJwt(token) {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const paddedBase64 = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')
    return JSON.parse(atob(paddedBase64))
  } catch {
    return null
  }
}

function getStoredToken() {
  const token = localStorage.getItem('accessToken') || ''
  if (!token) return ''

  const claims = parseJwt(token)
  const isExpired = Number.isFinite(Number(claims?.exp))
    && Number(claims.exp) * 1000 <= Date.now()
  if (!claims || isExpired) {
    localStorage.removeItem('accessToken')
    return ''
  }
  return token
}

function createSessionId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()

  const bytes = new Uint8Array(16)
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes)
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256)
    }
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

async function readApiPayload(response) {
  let payload
  try {
    payload = await response.json()
  } catch {
    throw new Error(`Máy chủ trả về dữ liệu không hợp lệ (HTTP ${response.status}).`)
  }

  if (!response.ok) {
    throw new Error(payload?.message || payload?.detail || `Máy chủ trả về HTTP ${response.status}.`)
  }
  if (payload?.status === 'error') {
    throw new Error(payload.message || 'Yêu cầu không thành công.')
  }
  return payload?.data ?? payload
}

function mapHistoryMessage(message, index) {
  const role = message.role || message.senderRole || message.sender_role || 'assistant'
  return {
    id: message.id ?? `${message.createdAt || message.created_at || 'history'}-${index}`,
    createdAt: message.createdAt || message.created_at || null,
    role: ['user', 'human'].includes(String(role).toLowerCase()) ? 'user' : 'assistant',
    content: message.content || message.message || '',
    blocked: message.blocked === true || message.isBlocked === true || message.is_blocked === true,
    reason: message.reason || message.blockReason || message.block_reason || '',
    latencyMs: message.latencyMs ?? message.proxy_latency_ms,
  }
}

function getJwtRole(claims) {
  const roles = [claims?.role, claims?.roles, claims?.authorities]
    .flat()
    .filter(Boolean)
    .map((role) => String(role).replace(/^ROLE_/, '').toUpperCase())
  return roles.includes('ADMIN')
}

export default function App() {
  const [token, setToken] = useState(getStoredToken)
  const [authMode, setAuthMode] = useState('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [authNotice, setAuthNotice] = useState('')
  const [isAuthenticating, setIsAuthenticating] = useState(false)

  const [page, setPage] = useState('chat')
  const [sessions, setSessions] = useState([])
  const [sessionError, setSessionError] = useState('')
  const [currentSessionId, setCurrentSessionId] = useState(null)
  const [messages, setMessages] = useState([])
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const [draft, setDraft] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [chatError, setChatError] = useState('')
  const [lastLatency, setLastLatency] = useState(null)
  const [dashboard, setDashboard] = useState(null)
  const [dashboardError, setDashboardError] = useState('')
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(false)
  const endOfMessages = useRef(null)
  const historyRequestId = useRef(0)

  const claims = token ? parseJwt(token) : null
  const isAdmin = getJwtRole(claims)
  const authorizationHeaders = useCallback(
    (headers = {}) => ({ ...headers, Authorization: `Bearer ${token}` }),
    [token],
  )

  const loadSessions = useCallback(async () => {
    const response = await fetch(SESSIONS_API_URL, {
      headers: authorizationHeaders(),
    })
    const payload = await readApiPayload(response)
    const list = Array.isArray(payload) ? payload : payload.sessions
    if (!Array.isArray(list)) {
      throw new Error('API danh sách phiên cần trả về một mảng sessions.')
    }
    return list
  }, [authorizationHeaders])

  const fetchSessions = useCallback(async () => {
    try {
      setSessions(await loadSessions())
      setSessionError('')
    } catch (error) {
      setSessionError(`Không tải được lịch sử phiên: ${error.message}`)
    }
  }, [loadSessions])

  useEffect(() => {
    if (!token) return undefined
    let active = true
    async function syncSessions() {
      try {
        const list = await loadSessions()
        if (active) {
          setSessions(list)
          setSessionError('')
        }
      } catch (error) {
        if (active) setSessionError(`Không tải được lịch sử phiên: ${error.message}`)
      }
    }
    syncSessions()
    return () => { active = false }
  }, [token, loadSessions])

  useEffect(() => {
    endOfMessages.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, isSending])

  async function handleAuthentication(event) {
    event.preventDefault()
    setAuthError('')
    setAuthNotice('')
    setIsAuthenticating(true)

    try {
      const isRegistering = authMode === 'register'
      const response = await fetch(isRegistering ? REGISTER_API_URL : AUTH_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      const payload = await readApiPayload(response)
      const jwtToken = payload?.token || payload?.accessToken || payload?.access_token

      if (jwtToken) {
        localStorage.setItem('accessToken', jwtToken)
        setToken(jwtToken)
        setPassword('')
      } else if (isRegistering) {
        setAuthMode('login')
        setAuthNotice('Tạo tài khoản thành công. Hãy đăng nhập để tiếp tục.')
        setPassword('')
      } else {
        throw new Error('Phản hồi đăng nhập không có JWT token.')
      }
    } catch (error) {
      setAuthError(error.message)
    } finally {
      setIsAuthenticating(false)
    }
  }

  function handleLogout() {
    localStorage.removeItem('accessToken')
    setToken('')
    setPage('chat')
    setSessions([])
    setMessages([])
    setCurrentSessionId(null)
    setDashboard(null)
  }

  async function handleSelectSession(sessionId) {
    if (!sessionId) return
    const requestId = historyRequestId.current + 1
    historyRequestId.current = requestId
    setCurrentSessionId(sessionId)
    setMessages([])
    setChatError('')
    setIsLoadingHistory(true)

    try {
      const url = `${MESSAGES_API_URL}?sessionId=${encodeURIComponent(sessionId)}`
      const response = await fetch(url, { headers: authorizationHeaders() })
      const payload = await readApiPayload(response)
      const history = Array.isArray(payload) ? payload : payload.messages
      if (!Array.isArray(history)) {
        throw new Error('API lịch sử cần trả về một mảng messages.')
      }
      if (historyRequestId.current === requestId) {
        setMessages(history.map(mapHistoryMessage))
      }
    } catch (error) {
      if (historyRequestId.current === requestId) {
        setChatError(`Không tải được lịch sử hội thoại: ${error.message}`)
      }
    } finally {
      if (historyRequestId.current === requestId) setIsLoadingHistory(false)
    }
  }

  function handleNewChat() {
    historyRequestId.current += 1
    setCurrentSessionId(createSessionId())
    setMessages([])
    setIsLoadingHistory(false)
    setDraft('')
    setChatError('')
    setLastLatency(null)
    setPage('chat')
  }

  async function handleSendMessage(event) {
    event.preventDefault()
    const text = draft.trim()
    if (!text || isSending) return

    const sessionId = currentSessionId || createSessionId()
    setCurrentSessionId(sessionId)
    setDraft('')
    setChatError('')
    setMessages((current) => [
      ...current,
      { id: `${Date.now()}-user`, createdAt: new Date().toISOString(), role: 'user', content: text },
    ])
    setIsSending(true)

    try {
      const response = await fetch(PROXY_URL, {
        method: 'POST',
        headers: authorizationHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          user_id: claims?.sub || USER_ID,
          session_id: sessionId,
          message: text,
          client_ip: '127.0.0.1',
        }),
      })
      const result = await readApiPayload(response)
      if (!['success', 'blocked'].includes(result.status)) {
        throw new Error('Proxy trả về trạng thái không hợp lệ.')
      }
      if (typeof result.response !== 'string' || !result.response.trim()) {
        throw new Error('Proxy không trả về nội dung phản hồi.')
      }

      const latencyMs = Number(result.execution_time_ms ?? result.proxy_latency_ms)
      const validLatency = Number.isFinite(latencyMs) && latencyMs >= 0 ? latencyMs : null
      setLastLatency(validLatency)
      setMessages((current) => [
        ...current,
        {
          id: `${Date.now()}-assistant`,
          createdAt: new Date().toISOString(),
          role: 'assistant',
          content: result.response,
          blocked: result.is_blocked === true || result.status === 'blocked',
          reason: [result.block_reason, result.threat_type].filter(Boolean).join(' · '),
          latencyMs: validLatency,
        },
      ])
      fetchSessions()
    } catch (error) {
      setChatError(`Không gửi được tin nhắn: ${error.message} Kiểm tra Proxy tại ${PROXY_URL}.`)
    } finally {
      setIsSending(false)
    }
  }

  const fetchDashboard = useCallback(async () => {
    setIsLoadingDashboard(true)
    setDashboardError('')
    try {
      const response = await fetch(ADMIN_API_URL, {
        headers: authorizationHeaders(),
      })
      const payload = await readApiPayload(response)
      const alerts = Array.isArray(payload)
        ? payload
        : payload.recentAlerts || payload.alerts
      if (!Array.isArray(alerts)) {
        throw new Error('API kiểm toán cần trả về mảng alerts hoặc recentAlerts.')
      }
      setDashboard({
        ...(!Array.isArray(payload) ? payload : {}),
        recentAlerts: alerts,
      })
    } catch (error) {
      setDashboard(null)
      setDashboardError(`Không tải được dữ liệu kiểm toán: ${error.message}`)
    } finally {
      setIsLoadingDashboard(false)
    }
  }, [authorizationHeaders])

  function navigateTo(nextPage) {
    setPage(nextPage)
    if (nextPage === 'dashboard') fetchDashboard()
  }

  if (!token) {
    const isRegistering = authMode === 'register'
    return (
      <main className="auth-page">
        <form className="auth-card" onSubmit={handleAuthentication}>
          <div className="auth-brand-mark" aria-hidden="true">🛡️</div>
          <p className="eyebrow">AI SECURITY WORKSPACE</p>
          <h1>{isRegistering ? 'Tạo tài khoản' : 'Đăng nhập hệ thống'}</h1>
          <p className="auth-description">
            {isRegistering ? 'Đăng ký để bắt đầu sử dụng không gian bảo mật AI.' : 'Đăng nhập để tiếp tục cuộc trò chuyện an toàn.'}
          </p>
          {authError && <div className="error-banner auth-message" role="alert">{authError}</div>}
          {authNotice && <div className="success-banner auth-message" role="status">{authNotice}</div>}
          <label htmlFor="username">Username</label>
          <input
            id="username"
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            required
          />
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            autoComplete={isRegistering ? 'new-password' : 'current-password'}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          <button className="auth-submit" type="submit" disabled={isAuthenticating}>
            {isAuthenticating ? 'Đang xử lý...' : isRegistering ? 'Đăng ký' : 'Đăng nhập'}
          </button>
          <button
            className="auth-switch"
            type="button"
            onClick={() => {
              setAuthMode(isRegistering ? 'login' : 'register')
              setAuthError('')
              setAuthNotice('')
            }}
          >
            {isRegistering ? 'Đã có tài khoản? Đăng nhập' : 'Chưa có tài khoản? Đăng ký'}
          </button>
        </form>
      </main>
    )
  }

  return (
    <div className="app-shell">
      <Sidebar
        page={page}
        onNavigate={navigateTo}
        sessions={sessions}
        currentSessionId={currentSessionId}
        onSelectSession={handleSelectSession}
        onNewChat={handleNewChat}
        isAdmin={isAdmin}
        username={claims?.username || claims?.sub || username || 'Người dùng'}
        sessionError={sessionError}
        onLogout={handleLogout}
      />
      <main className="main-panel">
        {page === 'chat' ? (
          <ChatPage
            messages={messages}
            isLoadingHistory={isLoadingHistory}
            draft={draft}
            onDraftChange={setDraft}
            isSending={isSending}
            chatError={chatError}
            lastLatency={lastLatency}
            endOfMessages={endOfMessages}
            onSendMessage={handleSendMessage}
            onNewChat={handleNewChat}
          />
        ) : (
          <DashboardPage
            dashboard={dashboard}
            error={dashboardError}
            isLoading={isLoadingDashboard}
            onRefresh={fetchDashboard}
          />
        )}
      </main>
    </div>
  )
}
