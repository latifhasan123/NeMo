// Biểu đồ cột CSS đơn giản cho tổng lưu lượng và số yêu cầu bị chặn.
function TrafficChart({ traffic }) {
  const maximumTraffic = Math.max(
    1,
    ...traffic.map((item) => Number(item.requests) || 0),
  )

  if (!traffic.length) {
    return <div className="empty-state">Chưa có dữ liệu lưu lượng.</div>
  }

  return (
    <div className="traffic-chart" aria-label="Biểu đồ lưu lượng">
      {traffic.map((item, index) => (
        <div className="chart-column" key={`${item.label}-${index}`}>
          <div className="bar-group">
            <span
              className="bar total-bar"
              style={{
                height: `${Math.max(
                  4,
                  (Number(item.requests) / maximumTraffic) * 100,
                )}%`,
              }}
              title={`${item.requests} yêu cầu`}
            />
            <span
              className="bar blocked-bar"
              style={{
                height: `${Math.max(
                  2,
                  ((Number(item.blocked) || 0) / maximumTraffic) * 100,
                )}%`,
              }}
              title={`${item.blocked || 0} yêu cầu bị chặn`}
            />
          </div>
          <span className="chart-label">{item.label}</span>
        </div>
      ))}
    </div>
  )
}

export default TrafficChart
