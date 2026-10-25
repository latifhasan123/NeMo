function formatDate(value) {
  if (!value) return 'Không rõ thời gian'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('vi-VN', {
        dateStyle: 'short',
        timeStyle: 'short',
      }).format(date)
}

// Một cảnh báo riêng biệt gồm mức độ, nội dung, IP và thời gian phát sinh.
function SecurityAlert({ alert }) {
  const severity = (alert.severity || 'medium').toLowerCase()

  return (
    <article className="alert-item">
      <span className={`severity-dot ${severity}`} />
      <div className="alert-copy">
        <strong>{alert.label || 'Sự kiện bảo mật'}</strong>
        <span>{alert.ipAddress || 'Không có IP'} · {formatDate(alert.createdAt)}</span>
      </div>
      <span className={`severity-label ${severity}`}>
        {alert.severity || 'MEDIUM'}
      </span>
    </article>
  )
}

export default SecurityAlert
