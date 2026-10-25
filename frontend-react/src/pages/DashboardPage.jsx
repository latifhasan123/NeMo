import SecurityAlert from '../components/SecurityAlert.jsx'
import StatCard from '../components/StatCard.jsx'
import TrafficChart from '../components/TrafficChart.jsx'

// Trang dashboard ghép các thẻ chỉ số, biểu đồ và danh sách cảnh báo.
function DashboardPage({ dashboard, error, isLoading, onRefresh }) {
  return (
    <section className="dashboard-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">SECURITY OVERVIEW</div>
          <h1>Bảng điều khiển</h1>
          <p>Theo dõi hoạt động chat và các yêu cầu bị hệ thống bảo vệ chặn.</p>
        </div>
        <button
          className="refresh-button"
          type="button"
          onClick={onRefresh}
          disabled={isLoading}
        >
          <span aria-hidden="true">↻</span>
          {isLoading ? 'Đang tải...' : 'Làm mới dữ liệu'}
        </button>
      </div>

      {error && <div className="error-banner dashboard-error" role="alert">{error}</div>}
      {isLoading && !dashboard ? (
        <div className="dashboard-loading">Đang tải dữ liệu từ backend...</div>
      ) : dashboard ? (
        <>
          <div className="stats-grid">
            <StatCard
              label="Tổng lượt chat"
              value={dashboard.totalMessages}
              icon="▤"
              tone="blue"
            />
            <StatCard
              label="Tấn công bị chặn"
              value={dashboard.blockedAttacks}
              icon="⛨"
              tone="red"
            />
            <StatCard
              label="Yêu cầu an toàn"
              value={dashboard.allowedMessages}
              icon="✓"
              tone="green"
            />
            <StatCard
              label="Độ trễ trung bình"
              value={`${dashboard.avgLatencyMs} ms`}
              icon="◷"
              tone="purple"
            />
          </div>

          <div className="dashboard-grid">
            <section className="panel traffic-panel">
              <div className="panel-heading">
                <div>
                  <h2>Lưu lượng kiểm duyệt</h2>
                  <p>Số yêu cầu được xử lý theo mốc thời gian</p>
                </div>
                <span className="live-label"><i /> DỮ LIỆU BACKEND</span>
              </div>
              <TrafficChart traffic={dashboard.traffic} />
              <div className="chart-legend">
                <span><i className="legend-total" />Tổng yêu cầu</span>
                <span><i className="legend-blocked" />Bị chặn</span>
              </div>
            </section>

            <section className="panel alerts-panel">
              <div className="panel-heading">
                <div>
                  <h2>Cảnh báo bảo mật</h2>
                  <p>Các sự kiện mới nhất từ hệ thống</p>
                </div>
                <span className="alert-count">
                  {dashboard.recentAlerts.length} sự kiện
                </span>
              </div>
              {dashboard.recentAlerts.length ? (
                <div className="alerts-list">
                  {dashboard.recentAlerts.map((alert, index) => (
                    <SecurityAlert key={alert.id ?? index} alert={alert} />
                  ))}
                </div>
              ) : (
                <div className="empty-state">Chưa ghi nhận cảnh báo nào.</div>
              )}
            </section>
          </div>
        </>
      ) : (
        !error && (
          <div className="dashboard-loading">Chưa có dữ liệu dashboard.</div>
        )
      )}
      <p className="admin-security-note">
        Bản demo giao diện không thay thế xác thực. Backend cần kiểm tra quyền
        Admin cho API dashboard.
      </p>
    </section>
  )
}

export default DashboardPage
