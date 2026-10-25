// Thẻ hiển thị một chỉ số tổng quan, dùng lại cho các số liệu dashboard.
function StatCard({ label, value, icon, tone }) {
  const displayValue = Number(value)
    ? Number(value).toLocaleString('vi-VN')
    : value

  return (
    <article className="stat-card">
      <div className={`stat-icon ${tone}`} aria-hidden="true">{icon}</div>
      <div>
        <span>{label}</span>
        <strong>{displayValue}</strong>
      </div>
      <span className={`stat-accent ${tone}`} />
    </article>
  )
}

export default StatCard
