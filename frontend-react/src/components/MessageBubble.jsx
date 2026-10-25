// Hiển thị nội dung, thời gian và kết quả kiểm duyệt của một tin nhắn.
function MessageBubble({ message }) {
  const time = new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(message.createdAt))

  return (
    <article className={`message-row ${message.role}`} key={message.id}>
      {message.role === 'assistant' && (
        <div className="message-avatar" aria-hidden="true">✳</div>
      )}
      <div className="message-content">
        <div className="message-meta">
          <strong>{message.role === 'user' ? 'Bạn' : 'Sentinel AI'}</strong>
          <time>{time}</time>
        </div>
        <div className="message-bubble">{message.content}</div>
        {message.blocked && (
          <div className="message-security blocked">
            <span>⚑</span>
            Yêu cầu đã bị chặn
            {message.reason ? ` · ${message.reason}` : ''}
            {message.alertLogged ? ' · Đã ghi nhận cảnh báo' : ''}
          </div>
        )}
        {message.latencyMs !== undefined && !message.blocked && (
          <div className="message-security">
            <span>✓</span> Đã kiểm duyệt · {message.latencyMs} ms
          </div>
        )}
      </div>
      {message.role === 'user' && (
        <div className="message-avatar user-avatar" aria-hidden="true">QA</div>
      )}
    </article>
  )
}

export default MessageBubble
