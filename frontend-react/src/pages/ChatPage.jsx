import { useEffect, useRef, useState } from 'react'
import MessageBubble from '../components/MessageBubble.jsx'
import {
  AlertTriangleIcon,
  ArrowDownIcon,
  ArrowUpIcon,
  BrandLogo,
  LockIcon,
  MenuIcon,
  NewChatIcon,
  ShieldCheckIcon,
  ShieldOffIcon,
  SidebarToggleIcon,
  SparkleIcon,
} from '../components/Icons.jsx'

const STARTER_PROMPTS = [
  {
    category: 'Khái niệm & Phòng thủ',
    text: 'Giải thích Prompt Injection là gì và cách phòng chống?',
    icon: 'shield',
  },
  {
    category: 'Bảo mật ứng dụng LLM',
    text: 'Làm thế nào để bảo vệ ứng dụng dùng LLM khỏi rò rỉ dữ liệu?',
    icon: 'lock',
  },
  {
    category: 'Phòng chống tấn công',
    text: 'Làm thế nào để phòng chống tấn công brute-force hiệu quả?',
    icon: 'sparkle',
  },
  {
    category: 'Cơ chế Guardrails',
    text: 'Tóm tắt vai trò và nguyên lý hoạt động của NeMo Guardrails.',
    icon: 'shield',
  },
]

function formatLatency(value) {
  const milliseconds = Number(value)
  if (!Number.isFinite(milliseconds) || milliseconds < 0) return ''
  return milliseconds >= 1000
    ? `${(milliseconds / 1000).toFixed(1)}s`
    : `${Math.round(milliseconds)}ms`
}

function PromptIcon({ type }) {
  if (type === 'lock') return <LockIcon size={16} />
  if (type === 'sparkle') return <SparkleIcon size={16} />
  return <ShieldCheckIcon size={16} />
}

function ChatPage({
  messages,
  isLoadingHistory,
  draft,
  onDraftChange,
  isSending,
  chatError,
  lastLatency,
  endOfMessages,
  onSendMessage,
  onNewChat,
  guardrailsEnabled,
  onToggleGuardrails,
  username,
  isSidebarCollapsed,
  onToggleSidebar,
  onOpenMobileMenu,
}) {
  const textareaRef = useRef(null)
  const viewportRef = useRef(null)
  const [showScrollBottom, setShowScrollBottom] = useState(false)

  // Auto-resize textarea height cleanly as user types or clears draft
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    const nextHeight = Math.min(el.scrollHeight, 180)
    el.style.height = `${Math.max(nextHeight, 26)}px`
  }, [draft])

  function handleViewportScroll() {
    const el = viewportRef.current
    if (!el) return
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    setShowScrollBottom(distanceFromBottom > 120)
  }

  function scrollToBottom() {
    endOfMessages.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }

  function chooseSuggestion(text) {
    onDraftChange(text)
    requestAnimationFrame(() => {
      textareaRef.current?.focus()
    })
  }

  const showWelcome = messages.length === 0 && !isLoadingHistory && !isSending

  return (
    <section className="chat-page">
      <header className="chat-topbar">
        <div className="chat-topbar-left">
          <button
            className="topbar-icon-btn mobile-only"
            type="button"
            onClick={onOpenMobileMenu}
            aria-label="Mở menu"
            title="Mở menu"
          >
            <MenuIcon size={20} />
          </button>

          {isSidebarCollapsed && (
            <button
              className="topbar-icon-btn desktop-only"
              type="button"
              onClick={onToggleSidebar}
              aria-label="Mở rộng thanh bên"
              title="Mở rộng thanh bên"
            >
              <SidebarToggleIcon size={18} />
            </button>
          )}

          <div className="model-badge">
            <span className="model-name">Sentinel AI</span>
            <button
              type="button"
              className={`model-tag interactive ${guardrailsEnabled ? '' : 'is-bypassed'}`}
              onClick={onToggleGuardrails}
              title={
                guardrailsEnabled
                  ? 'Nhấn để tắt tường lửa (Chế độ Demo)'
                  : 'Nhấn để bật lại NeMo Guardrails'
              }
            >
              <i className={`live-dot ${guardrailsEnabled ? '' : 'warn'}`} aria-hidden="true" />
              {guardrailsEnabled ? 'NeMo Guardrails ON' : 'Guardrails OFF (Demo)'}
            </button>
          </div>
        </div>

        <div className="chat-topbar-right">
          {lastLatency !== null && (
            <span className="topbar-latency" title="Thời gian xử lý phản hồi gần nhất">
              {formatLatency(lastLatency)}
            </span>
          )}
          <button
            className="topbar-new-chat-btn"
            type="button"
            onClick={onNewChat}
            title="Cuộc trò chuyện mới"
          >
            <NewChatIcon size={15} />
            <span>Mới</span>
          </button>
        </div>
      </header>

      {!guardrailsEnabled && (
        <div className="demo-warning-banner" role="status">
          <div className="demo-warning-text">
            <AlertTriangleIcon size={16} />
            <span>
              <strong>Chế độ Demo:</strong> NeMo Guardrails đang tạm tắt — Mọi prompt sẽ đi thẳng tới mô hình AI mà không qua tường lửa kiểm duyệt.
            </span>
          </div>
          <button
            type="button"
            className="demo-restore-btn"
            onClick={onToggleGuardrails}
          >
            Bật lại bảo vệ
          </button>
        </div>
      )}

      <div
        className="chat-viewport"
        ref={viewportRef}
        onScroll={handleViewportScroll}
        aria-live="polite"
      >
        <div className={`message-list ${showWelcome ? 'is-welcome' : ''}`}>
          {isLoadingHistory && messages.length === 0 && (
            <div className="history-loading-state">
              <div className="spinner-ring" aria-hidden="true" />
              <p>Đang tải lịch sử hội thoại...</p>
            </div>
          )}

          {showWelcome && (
            <div className="empty-chat-state">
              <div className="welcome-logo-wrap">
                <BrandLogo size={54} />
              </div>
              <h1 className="welcome-title">
                Xin chào, <span>{username || 'bạn'}</span>
              </h1>
              <p className="welcome-subtitle">
                Tôi có thể hỗ trợ gì về an toàn thông tin cho bạn hôm nay?
              </p>

              <div className="welcome-suggestions">
                {STARTER_PROMPTS.map((item) => (
                  <button
                    key={item.text}
                    type="button"
                    className="suggestion-card"
                    onClick={() => chooseSuggestion(item.text)}
                  >
                    <span className="suggestion-card-icon">
                      <PromptIcon type={item.icon} />
                    </span>
                    <span className="suggestion-card-body">
                      <small>{item.category}</small>
                      <span>{item.text}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((message) => (
            <MessageBubble message={message} key={message.id} />
          ))}

          {isSending && (
            <div className="message-row assistant">
              <div className="typing-indicator" aria-label="Đang xử lý">
                <span className="typing-logo">
                  <SparkleIcon size={16} />
                </span>
                <div className="typing-dots">
                  <span /><span /><span />
                </div>
                <small>
                  {guardrailsEnabled
                    ? 'Đang kiểm duyệt bảo mật và tạo phản hồi...'
                    : 'Đang gửi trực tiếp tới LLM (Guardrails OFF)...'}
                </small>
              </div>
            </div>
          )}

          <div ref={endOfMessages} className="messages-end-anchor" />
        </div>
      </div>

      <div className="composer-region">
        {showScrollBottom && (
          <button
            type="button"
            className="scroll-bottom-btn"
            onClick={scrollToBottom}
            aria-label="Cuộn xuống cuối"
            title="Cuộn xuống mới nhất"
          >
            <ArrowDownIcon size={17} />
          </button>
        )}

        {chatError && (
          <div className="error-banner chat-error-banner" role="alert">
            {chatError}
          </div>
        )}

        <form className="chat-composer" onSubmit={onSendMessage}>
          <label className="sr-only" htmlFor="chat-input">Tin nhắn</label>
          <textarea
            ref={textareaRef}
            id="chat-input"
            value={draft}
            onChange={(event) => onDraftChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                event.currentTarget.form.requestSubmit()
              }
            }}
            placeholder={
              guardrailsEnabled
                ? 'Hỏi Sentinel AI về an toàn thông tin, bảo mật hệ thống...'
                : 'Chế độ Demo (Guardrails OFF): Thử gửi bất kỳ prompt nào để kiểm chứng...'
            }
            rows={1}
            disabled={isSending || isLoadingHistory}
          />
          <div className="composer-toolbar">
            <div className="composer-meta">
              <span className={`composer-shield-pill ${guardrailsEnabled ? '' : 'is-off'}`}>
                {guardrailsEnabled ? <ShieldCheckIcon size={14} /> : <ShieldOffIcon size={14} />}
                <span>
                  {guardrailsEnabled ? 'Bảo vệ bởi NeMo Guardrails' : 'Tường lửa đang tắt (Demo)'}
                </span>
              </span>
              <span className="composer-shortcut">Enter để gửi · Shift + Enter xuống dòng</span>
            </div>
            <button
              className={`send-button ${isSending ? 'is-sending' : ''}`}
              type="submit"
              disabled={!draft.trim() || isSending || isLoadingHistory}
              aria-label="Gửi tin nhắn"
              title="Gửi tin nhắn"
            >
              {isSending ? (
                <span className="btn-spinner" aria-hidden="true" />
              ) : (
                <ArrowUpIcon size={18} />
              )}
            </button>
          </div>
        </form>

        <p className="privacy-note">
          Sentinel AI có thể mắc sai sót. Mọi yêu cầu đều được kiểm duyệt qua NeMo Guardrails.
        </p>
      </div>
    </section>
  )
}

export default ChatPage
