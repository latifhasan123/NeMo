import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import SecurityAlert from './SecurityAlert'

function formatLatency(value) {
  const milliseconds = Number(value)
  if (!Number.isFinite(milliseconds) || milliseconds < 0) return ''
  return milliseconds >= 1000
    ? `${(milliseconds / 1000).toFixed(1)}s`
    : `${Number(milliseconds.toFixed(1))}ms`
}

function formatTime(value) {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
}

export default function MessageBubble({ message }) {
  const isUser = message.role === 'user'
  const time = formatTime(message.createdAt)

  return (
    <div className={`message-row ${isUser ? 'user' : 'assistant'}`}>
      {!isUser && <div className="message-avatar" aria-hidden="true">✳</div>}
      <div className="message-content">
        <div className="message-meta">
          <strong>{isUser ? 'Bạn' : 'Trợ lý bảo mật AI'}</strong>
          {time && <time>{time}</time>}
        </div>
        {message.blocked ? (
          <SecurityAlert content={message.content} reason={message.reason} />
        ) : (
          <div className="message-bubble">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content || ''}</ReactMarkdown>
          </div>
        )}
        {message.latencyMs !== undefined && message.latencyMs !== null && !isUser && (
          <div className={`message-security ${message.blocked ? 'blocked' : ''}`}>
            <span aria-hidden="true">{message.blocked ? '⚑' : '✓'}</span>
            {message.blocked ? 'Yêu cầu đã bị chặn' : 'NeMo Guardrails Verified'}
            {' · '}{formatLatency(message.latencyMs)}
          </div>
        )}
      </div>
      {isUser && <div className="message-avatar user-avatar" aria-hidden="true">Bạn</div>}
    </div>
  )
}
