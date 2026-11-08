function sessionIdOf(session) {
  return session.session_uuid || session.sessionUuid || session.sessionId || session.id
}

export default function Sidebar({
  page,
  onNavigate,
  sessions,
  currentSessionId,
  onSelectSession,
  onNewChat,
  isAdmin,
  username,
  sessionError,
  onLogout,
}) {
  return (
    <aside className="sidebar">
      <a className="brand" href="#" onClick={(event) => event.preventDefault()}>
        <span className="brand-mark" aria-hidden="true">✳</span>
        <span>
          <strong>Sentinel AI</strong>
          <small>SECURITY WORKSPACE</small>
        </span>
      </a>

      <div className="workspace-label">KHÔNG GIAN LÀM VIỆC</div>
      <nav className="main-nav" aria-label="Điều hướng chính">
        <button
          className={`nav-link ${page === 'chat' ? 'active' : ''}`}
          type="button"
          onClick={() => onNavigate('chat')}
        >
          <span className="nav-icon" aria-hidden="true">◉</span> Trò chuyện
        </button>
        {isAdmin && (
          <button
            className={`nav-link ${page === 'dashboard' ? 'active' : ''}`}
            type="button"
            onClick={() => onNavigate('dashboard')}
          >
            <span className="nav-icon" aria-hidden="true">▦</span> Bảng điều khiển
          </button>
        )}
      </nav>

      {page === 'chat' && (
        <section className="session-history" aria-label="Lịch sử hội thoại">
          <button className="new-chat-button sidebar-new-chat" type="button" onClick={onNewChat}>
            <span aria-hidden="true">＋</span> Cuộc trò chuyện mới
          </button>
          <div className="workspace-label history-label">LỊCH SỬ PHIÊN CHAT</div>
          {sessionError && <p className="sidebar-error" role="status">{sessionError}</p>}
          {sessions.length === 0 && !sessionError ? (
            <p className="sidebar-empty">Chưa có phiên trò chuyện</p>
          ) : (
            <div className="session-list">
              {sessions.map((session, index) => {
                const id = sessionIdOf(session)
                if (!id) return null
                const title = session.title || session.name || `Phiên ${index + 1}`
                return (
                  <button
                    className={`session-item ${String(currentSessionId) === String(id) ? 'active' : ''}`}
                    key={id}
                    type="button"
                    title={title}
                    onClick={() => onSelectSession(id)}
                  >
                    <span aria-hidden="true">◌</span>
                    <span>{title}</span>
                  </button>
                )
              })}
            </div>
          )}
        </section>
      )}

      <div className="sidebar-spacer" />
      <div className="protection-card">
        <span className="protection-indicator" />
        <div>
          <strong>Guardrails đang bật</strong>
          <span>Đang bảo vệ hội thoại</span>
        </div>
        <span className="status-pill">ACTIVE</span>
      </div>
      <div className="profile">
        <div className="avatar" aria-hidden="true">{(username || 'U').slice(0, 1).toUpperCase()}</div>
        <div className="profile-copy">
          <strong>{username}</strong>
          <span>{isAdmin ? 'ADMIN' : 'USER'}</span>
        </div>
        <button className="logout-button" type="button" onClick={onLogout}>Đăng xuất</button>
      </div>
    </aside>
  )
}
