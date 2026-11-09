import {
  BrandLogo,
  ChatBubbleIcon,
  CloseIcon,
  DashboardIcon,
  LogOutIcon,
  NewChatIcon,
  ShieldCheckIcon,
  ShieldOffIcon,
  SidebarToggleIcon,
  TrashIcon,
} from './Icons'

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
  onRequestDeleteSession,
  onRequestClearSessions,
  guardrailsEnabled,
  onToggleGuardrails,
  isAdmin,
  username,
  sessionError,
  onLogout,
  isCollapsed,
  onToggleCollapse,
  isMobileOpen,
  onCloseMobile,
}) {
  return (
    <>
      {isMobileOpen && (
        <div
          className="sidebar-backdrop"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      <aside
        className={`sidebar ${isCollapsed ? 'collapsed' : ''} ${isMobileOpen ? 'mobile-open' : ''}`}
        aria-label="Thanh điều hướng"
      >
        <div className="sidebar-top">
          <a
            className="brand"
            href="#"
            onClick={(event) => {
              event.preventDefault()
              onNavigate('chat')
              onCloseMobile?.()
            }}
          >
            <BrandLogo size={34} />
            <span className="brand-copy">
              <strong>Sentinel AI</strong>
              <small>GUARDRAILS CONSOLE</small>
            </span>
          </a>

          <button
            className="sidebar-icon-btn desktop-only"
            type="button"
            onClick={onToggleCollapse}
            title="Thu gọn thanh bên"
            aria-label="Thu gọn thanh bên"
          >
            <SidebarToggleIcon size={18} />
          </button>

          <button
            className="sidebar-icon-btn mobile-only"
            type="button"
            onClick={onCloseMobile}
            title="Đóng menu"
            aria-label="Đóng menu"
          >
            <CloseIcon size={18} />
          </button>
        </div>

        <div className="sidebar-actions">
          <button
            className="sidebar-new-chat"
            type="button"
            onClick={() => {
              onNewChat()
              onCloseMobile?.()
            }}
          >
            <NewChatIcon size={17} />
            <span>Cuộc trò chuyện mới</span>
          </button>

          <nav className="main-nav" aria-label="Điều hướng chính">
            <button
              className={`nav-link ${page === 'chat' ? 'active' : ''}`}
              type="button"
              onClick={() => {
                onNavigate('chat')
                onCloseMobile?.()
              }}
            >
              <ChatBubbleIcon size={17} />
              <span>Trò chuyện</span>
            </button>
            {isAdmin && (
              <button
                className={`nav-link ${page === 'dashboard' ? 'active' : ''}`}
                type="button"
                onClick={() => {
                  onNavigate('dashboard')
                  onCloseMobile?.()
                }}
              >
                <DashboardIcon size={17} />
                <span>Bảng điều khiển</span>
              </button>
            )}
          </nav>
        </div>

        {page === 'chat' ? (
          <section className="session-history" aria-label="Lịch sử hội thoại">
            <div className="history-header">
              <div className="history-title-group">
                <span className="history-label">Lịch sử chat</span>
                {sessions.length > 0 && (
                  <span className="history-count">{sessions.length}</span>
                )}
              </div>

              {sessions.length > 0 && (
                <button
                  type="button"
                  className="history-clear-btn"
                  onClick={onRequestClearSessions}
                  title="Xóa toàn bộ lịch sử chat"
                >
                  <TrashIcon size={13} />
                  <span>Xóa hết</span>
                </button>
              )}
            </div>

            {sessionError && (
              <p className="sidebar-error" role="status">{sessionError}</p>
            )}

            {sessions.length === 0 && !sessionError ? (
              <p className="sidebar-empty">
                Các cuộc trò chuyện của bạn sẽ hiển thị đầy đủ tại đây.
              </p>
            ) : (
              <div className="session-list">
                {sessions.map((session, index) => {
                  const id = sessionIdOf(session)
                  if (!id) return null
                  const title = session.title || session.name || `Phiên ${index + 1}`
                  const isActive = String(currentSessionId) === String(id)
                  return (
                    <div
                      className={`session-item-wrap ${isActive ? 'active' : ''}`}
                      key={id}
                    >
                      <button
                        className="session-item"
                        type="button"
                        title={title}
                        onClick={() => {
                          onSelectSession(id)
                          onCloseMobile?.()
                        }}
                      >
                        <span className="session-title">{title}</span>
                      </button>

                      <button
                        type="button"
                        className="session-delete-btn"
                        title="Xóa cuộc trò chuyện này"
                        aria-label={`Xóa ${title}`}
                        onClick={(event) => {
                          event.stopPropagation()
                          onRequestDeleteSession(id, title)
                        }}
                      >
                        <TrashIcon size={14} />
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        ) : (
          <div className="sidebar-spacer" />
        )}

        <div className="sidebar-footer">
          <button
            type="button"
            role="switch"
            aria-checked={guardrailsEnabled}
            className={`guardrail-toggle ${guardrailsEnabled ? 'is-active' : 'is-off'}`}
            onClick={onToggleGuardrails}
            title={
              guardrailsEnabled
                ? 'NeMo Guardrails đang BẬT — Nhấn để tắt (Chế độ Demo)'
                : 'NeMo Guardrails đang TẮT — Nhấn để bật lại bảo vệ'
            }
          >
            <span className="guardrail-toggle-icon" aria-hidden="true">
              {guardrailsEnabled ? <ShieldCheckIcon size={16} /> : <ShieldOffIcon size={16} />}
            </span>
            <span className="guardrail-toggle-copy">
              <strong>
                {guardrailsEnabled ? 'NeMo Guardrails Active' : 'Guardrails Đã Tắt'}
              </strong>
              <small>
                {guardrailsEnabled ? 'Đang bật · Nhấn để tắt Demo' : 'Chế độ Demo · Nhấn để bật'}
              </small>
            </span>
            <span className={`toggle-track ${guardrailsEnabled ? 'on' : ''}`} aria-hidden="true">
              <span className="toggle-thumb" />
            </span>
          </button>

          <div className="profile">
            <div className="avatar" aria-hidden="true">
              {(username || 'U').slice(0, 1).toUpperCase()}
            </div>
            <div className="profile-copy">
              <strong title={username}>{username}</strong>
              <span>{isAdmin ? 'Quản trị viên (Admin)' : 'Thành viên'}</span>
            </div>
            <button
              className="logout-icon-button"
              type="button"
              onClick={onLogout}
              title="Đăng xuất"
              aria-label="Đăng xuất"
            >
              <LogOutIcon size={16} />
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}
