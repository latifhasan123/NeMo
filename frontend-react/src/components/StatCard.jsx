// Thẻ hiển thị một chỉ số tổng quan, dùng lại cho các số liệu dashboard.
function StatCard({ label, value, subtext, icon, tone }) {
  const displayValue =
    typeof value === 'number' && Number.isFinite(value)
      ? value.toLocaleString('vi-VN')
      : value

  return (
    <article className="stat-card">
      <div className={`stat-icon ${tone}`} aria-hidden="true">{icon}</div>
      <div className="stat-content">
        <span className="stat-label">{label}</span>
        <strong className="stat-value">{displayValue}</strong>
        {subtext && <small className="stat-subtext">{subtext}</small>}
      </div>
      <span className={`stat-accent ${tone}`} />
    </article>
  )
}

export default StatCard
