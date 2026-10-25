// Thanh điều hướng chính, nhận trang hiện tại và hàm đổi trang từ App.
function Sidebar({ page, onNavigate }) {
  return (
    <aside className="sidebar">
      <a className="brand" href="#home" onClick={(event) => event.preventDefault()}>
        <span className="brand-mark" aria-hidden="true">S</span>
        <span>
          <strong>Sentinel AI</strong>
          <small>GUARDRAILS CONSOLE</small>
        </span>
      </a>

      <div className="workspace-label">WORKSPACE</div>
      <nav className="main-nav" aria-label="Điều hướng chính">
        <button
          className={page === 'chat' ? 'nav-link active' : 'nav-link'}
          type="button"
          onClick={() => onNavigate('chat')}
        >
          <span className="nav-icon" aria-hidden="true">◉</span>
          Trò chuyện
        </button>
        <button
          className={page === 'dashboard' ? 'nav-link active' : 'nav-link'}
          type="button"
          onClick={() => onNavigate('dashboard')}
        >
          <span className="nav-icon" aria-hidden="true">▦</span>
          Bảng điều khiển
        </button>
      </nav>

      <div className="sidebar-spacer" />
      <div className="protection-card">
        <span className="protection-indicator" />
        <div>
          <strong>Lớp bảo vệ</strong>
          <span>NeMo Guardrails</span>
        </div>
        <span className="status-pill">PROXY</span>
      </div>
      <div className="profile">
        <div className="avatar">QA</div>
        <div className="profile-copy">
          <strong>Quốc Anh</strong>
          <span>Quản trị viên</span>
        </div>
        <span className="profile-menu" aria-hidden="true">•••</span>
      </div>
    </aside>
  )
}

export default Sidebar
