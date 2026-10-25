import { useRef } from 'react'
import MessageBubble from '../components/MessageBubble.jsx'

const suggestions = [
  'Giải thích prompt injection là gì?',
  'Làm thế nào để bảo vệ ứng dụng dùng LLM?',
  'Tóm tắt vai trò của NeMo Guardrails.',
]

// Trang chat lo phần giao diện; trạng thái và gửi yêu cầu do App quản lý.
function ChatPage({
  messages,
  draft,
  onDraftChange,
  isSending,
  chatError,
  lastLatency,
  endOfMessages,
  onSendMessage,
  onNewChat,
}) {
  const textareaRef = useRef(null)

  function chooseSuggestion(text) {
    onDraftChange(text)
    textareaRef.current?.focus()
  }

  return (
    <section className="chat-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">AI SECURITY WORKSPACE</div>
          <h1>Trò chuyện an toàn</h1>
          <p>Tin nhắn được kiểm duyệt trước khi chuyển đến mô hình AI.</p>
        </div>
        <div className="guardrail-status"><span /> Kiểm duyệt qua Proxy</div>
      </div>

      <div className="chat-card">
        <div className="chat-card-header">
          <div className="assistant-identity">
            <div className="assistant-avatar">✳</div>
            <div>
              <strong>Trợ lý bảo mật AI</strong>
              <span><i /> Gửi yêu cầu qua Proxy Python</span>
            </div>
          </div>
          <button
            className="new-chat-button"
            type="button"
            onClick={onNewChat}
          >
            <span aria-hidden="true">＋</span> Cuộc trò chuyện mới
          </button>
        </div>

        <div className="message-list" aria-live="polite">
          {messages.map((message) => (
            <MessageBubble message={message} key={message.id} />
          ))}
          {isSending && (
            <div className="message-row assistant">
              <div className="message-avatar" aria-hidden="true">✳</div>
              <div className="typing-indicator" aria-label="Đang xử lý">
                <span /><span /><span />
                <small>Đang kiểm duyệt và xử lý...</small>
              </div>
            </div>
          )}
          <div ref={endOfMessages} />
        </div>

        {messages.length === 1 && (
          <div className="suggestions">
            <span>GỢI Ý BẮT ĐẦU</span>
            <div className="suggestion-list">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => chooseSuggestion(suggestion)}
                >
                  {suggestion}<span aria-hidden="true">↗</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {chatError && <div className="error-banner" role="alert">{chatError}</div>}
        <form className="chat-composer" onSubmit={onSendMessage}>
          <label className="sr-only" htmlFor="chat-input">Tin nhắn của bạn</label>
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
            placeholder="Nhập tin nhắn... (Enter để gửi, Shift + Enter để xuống dòng)"
            rows={2}
            disabled={isSending}
          />
          <div className="composer-footer">
            <div className="composer-hint">
              <span aria-hidden="true">◇</span> Được bảo vệ bởi NeMo Guardrails
              {lastLatency !== null && (
                <span className="latency-hint">
                  Proxy xử lý: {lastLatency} ms
                </span>
              )}
            </div>
            <button
              className="send-button"
              type="submit"
              disabled={!draft.trim() || isSending}
            >
              {isSending ? 'Đang gửi...' : 'Gửi tin nhắn'}
              <span aria-hidden="true">↑</span>
            </button>
          </div>
        </form>
      </div>
      <p className="privacy-note">
        Không nhập thông tin cá nhân hoặc dữ liệu nhạy cảm vào cuộc trò chuyện.
      </p>
    </section>
  )
}

export default ChatPage
