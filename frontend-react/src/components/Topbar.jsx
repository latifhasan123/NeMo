// Thanh trên cùng hiển thị vị trí của người dùng trong ứng dụng.
function Topbar({ page }) {
  const pageTitle = page === 'chat' ? 'Trò chuyện' : 'Bảng điều khiển'

  return (
    <header className="topbar">
      <div className="breadcrumb">
        <span>Không gian làm việc</span>
        <span className="breadcrumb-separator">/</span>
        <strong>{pageTitle}</strong>
      </div>
      <div className="topbar-right">
        <span className="environment"><i /> Môi trường Demo</span>
        <button
          className="icon-button"
          type="button"
          aria-label="Thông báo"
          title="Thông báo"
        >
          ♧<span className="notification-dot" />
        </button>
      </div>
    </header>
  )
}

export default Topbar
