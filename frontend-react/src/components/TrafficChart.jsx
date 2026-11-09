// Biểu đồ cột so sánh tổng lưu lượng prompt và số yêu cầu bị NeMo Guardrails chặn theo ngày.
export default function TrafficChart({ traffic = [] }) {
  if (!traffic.length) {
    return (
      <div className="empty-state chart-empty">
        Chưa có dữ liệu lưu lượng theo ngày. Hãy gửi một vài tin nhắn để hệ thống ghi nhận telemetry.
      </div>
    )
  }

  const maximumTraffic = Math.max(
    1,
    ...traffic.map((item) => Math.max(Number(item.requests) || 0, Number(item.blocked) || 0)),
  )

  return (
    <div className="traffic-chart-wrap">
      <div className="chart-legend" aria-hidden="true">
        <span className="legend-item">
          <i className="legend-dot total" />
          Tổng Prompt
        </span>
        <span className="legend-item">
          <i className="legend-dot blocked" />
          Bị chặn (Attack/Off-topic)
        </span>
      </div>

      <div className="traffic-chart" role="img" aria-label="Biểu đồ lưu lượng và cảnh báo theo ngày">
        {traffic.map((item, index) => {
          const requests = Number(item.requests) || 0
          const blocked = Number(item.blocked) || 0
          const reqHeight = requests > 0 ? Math.max(8, (requests / maximumTraffic) * 100) : 2
          const blockedHeight = blocked > 0 ? Math.max(8, (blocked / maximumTraffic) * 100) : 2

          return (
            <div className="chart-column" key={`${item.label}-${index}`}>
              <div className="chart-values">
                <span>{requests}</span>
                {blocked > 0 && <span className="blocked-num">/{blocked}</span>}
              </div>
              <div className="bar-group">
                <span
                  className="bar total-bar"
                  style={{ height: `${reqHeight}%` }}
                  title={`${item.label}: ${requests} tổng prompt`}
                />
                <span
                  className="bar blocked-bar"
                  style={{ height: `${blockedHeight}%` }}
                  title={`${item.label}: ${blocked} bị chặn`}
                />
              </div>
              <span className="chart-label">{item.label}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
