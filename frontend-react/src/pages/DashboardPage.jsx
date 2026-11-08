import StatCard from '../components/StatCard'

function formatLatency(value) {
  const milliseconds = Number(value)
  if (!Number.isFinite(milliseconds) || milliseconds < 0) return '—'
  return milliseconds >= 1000
    ? `${(milliseconds / 1000).toFixed(1)}s`
    : `${Math.round(milliseconds)}ms`
}

function formatCreatedAt(value) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString('vi-VN')
}

export default function DashboardPage({ dashboard, error, isLoading, onRefresh }) {
  const alerts = dashboard?.recentAlerts || []
  const highSeverityCount = alerts.filter((alert) =>
    ['HIGH', 'CRITICAL'].includes(String(alert.severityLevel || alert.severity || '').toUpperCase()),
  ).length
  const mediumSeverityCount = alerts.filter(
    (alert) => String(alert.severityLevel || alert.severity || '').toUpperCase() === 'MEDIUM',
  ).length

  return (
    <section className="dashboard-page">
      <div className="page-heading dashboard-heading">
        <div>
          <div className="eyebrow">SECURITY MONITORING</div>
          <h1>Bảng điều khiển An ninh</h1>
          <p>Nhật ký kiểm toán các sự kiện được NeMo Guardrails phát hiện.</p>
        </div>
        <button className="refresh-button" type="button" onClick={onRefresh} disabled={isLoading}>
          <span aria-hidden="true">↻</span> {isLoading ? 'Đang tải...' : 'Làm mới'}
        </button>
      </div>

      {error && <div className="error-banner dashboard-error" role="alert">{error}</div>}

      <div className="stats-grid">
        <StatCard label="TỔNG CẢNH BÁO" value={alerts.length} icon="⚑" tone="blue" />
        <StatCard label="MỨC ĐỘ CAO / NGHIÊM TRỌNG" value={highSeverityCount} icon="!" tone="red" />
        <StatCard label="MỨC ĐỘ TRUNG BÌNH" value={mediumSeverityCount} icon="◇" tone="purple" />
        <StatCard
          label="ĐỘ TRỄ TRUNG BÌNH"
          value={dashboard?.avgLatencyMs === undefined ? '—' : formatLatency(dashboard.avgLatencyMs)}
          icon="◷"
          tone="green"
        />
      </div>

      <section className="panel audit-panel">
        <div className="panel-heading">
          <div>
            <h2>Nhật ký Cảnh báo Bảo mật</h2>
            <p>Danh sách sự kiện lấy từ backend security alerts.</p>
          </div>
          <span className="alert-count">{alerts.length} SỰ KIỆN</span>
        </div>

        {isLoading ? (
          <div className="dashboard-loading">Đang tải dữ liệu kiểm toán...</div>
        ) : !error && alerts.length === 0 ? (
          <div className="empty-state">Chưa có sự kiện cảnh báo nào.</div>
        ) : (
          <div className="audit-table-scroll">
            <table className="audit-table">
              <thead>
                <tr>
                  <th>Thời gian</th>
                  <th>IP kẻ tấn công</th>
                  <th>Loại đòn tấn công</th>
                  <th>Mức độ</th>
                  <th>Prompt bị chặn</th>
                </tr>
              </thead>
              <tbody>
                {alerts.map((alert, index) => {
                  const severity = String(alert.severityLevel || alert.severity || 'UNKNOWN').toUpperCase()
                  const severityClass = severity.toLowerCase()
                  return (
                    <tr key={alert.id || `${alert.createdAt || alert.created_at}-${index}`}>
                      <td>{formatCreatedAt(alert.createdAt || alert.created_at)}</td>
                      <td className="audit-ip">{alert.ipAddress || alert.ip_address || '—'}</td>
                      <td>{alert.threatType || alert.threat_type || alert.label || '—'}</td>
                      <td><span className={`severity-label ${severityClass}`}>{severity}</span></td>
                      <td className="audit-payload" title={alert.blockedPayload || alert.blocked_payload || ''}>
                        {alert.blockedPayload || alert.blocked_payload || '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="admin-security-note">
        Dữ liệu chỉ hiển thị cho tài khoản ADMIN. Backend vẫn cần xác thực quyền truy cập cho API kiểm toán.
      </p>
    </section>
  )
}
