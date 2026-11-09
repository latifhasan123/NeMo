import { useCallback, useMemo, useState } from 'react'
import ConfirmModal from '../components/ConfirmModal'
import StatCard from '../components/StatCard'
import TrafficChart from '../components/TrafficChart'
import {
  ActivityIcon,
  DownloadIcon,
  LockIcon,
  MenuIcon,
  RefreshIcon,
  SearchIcon,
  ShieldAlertIcon,
  ShieldCheckIcon,
  ShieldOffIcon,
  SidebarToggleIcon,
  TrashIcon,
  UnlockIcon,
  UsersIcon,
} from '../components/Icons'
import { readApiPayload } from '../utils/api'

const BASE_THREAT_ORDER = ['JAILBREAK', 'PROMPT_LEAKAGE', 'MALICIOUS_INTENT', 'OFF_TOPIC']

const THREAT_META = {
  JAILBREAK: { label: 'Jailbreak / Vượt rào', tone: 'red' },
  PROMPT_LEAKAGE: { label: 'Rò rỉ System Prompt', tone: 'purple' },
  MALICIOUS_INTENT: { label: 'Mã độc & Tấn công mạng', tone: 'amber' },
  OFF_TOPIC: { label: 'Ngoài phạm vi (Off-topic)', tone: 'blue' },
  PROMPT_INJECTION: { label: 'Prompt Injection', tone: 'rose' },
}

function formatLatency(value) {
  if (value === null || value === undefined || value === '') return '—'
  const milliseconds = Number(value)
  if (!Number.isFinite(milliseconds) || milliseconds < 0) return '—'
  return milliseconds >= 1000
    ? `${(milliseconds / 1000).toFixed(1)}s`
    : `${Math.round(milliseconds)}ms`
}

function formatDateTime(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  const pad = (num) => String(num).padStart(2, '0')
  const timePart = `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  const datePart = `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`
  return `${timePart} ${datePart}`
}

function normalizeThreatKey(raw) {
  const value = String(raw || '').trim()
  if (!value) return 'UNKNOWN'
  return value.toUpperCase().replace(/\s+/g, '_')
}

function escapeCsvCell(value, { neutralizeFormula = true } = {}) {
  let str = String(value ?? '')
  if (neutralizeFormula && /^[=+\-@\t\r]/.test(str)) {
    str = ` ${str}`
  }
  return `"${str.replace(/"/g, '""')}"`
}

function formatCsvDateCell(value) {
  const formatted = formatDateTime(value)
  if (formatted === '—') return escapeCsvCell('')
  // Bọc công thức chuỗi ="HH:mm:ss DD/MM/YYYY" để Excel giữ nguyên định dạng Giờ trước - Ngày sau,
  // không tự chuyển thành số Date (gây lỗi ####### ở các cột hẹp) hoặc đảo ngày/tháng.
  return escapeCsvCell(`="${formatted}"`, { neutralizeFormula: false })
}

export default function DashboardPage({
  dashboard,
  error,
  isLoading,
  onRefresh,
  currentUsername,
  authorizationHeaders,
  adminApiUrl,
  usersApiUrl,
  guardrailsEnabled,
  onToggleGuardrails,
  onToast,
  isSidebarCollapsed,
  onToggleSidebar,
  onOpenMobileMenu,
}) {
  const [activeTab, setActiveTab] = useState('monitor')

  // Audit Log states
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedThreat, setSelectedThreat] = useState('ALL')
  const [expandedAlertIds, setExpandedAlertIds] = useState(() => new Set())

  // IAM Users states
  const [users, setUsers] = useState([])
  const [usersError, setUsersError] = useState('')
  const [isLoadingUsers, setIsLoadingUsers] = useState(false)
  const [userSearch, setUserSearch] = useState('')

  // Shared Confirm Modal state
  const [confirmState, setConfirmState] = useState(null)
  const [isMutating, setIsMutating] = useState(false)
  const [mutationError, setMutationError] = useState('')

  const alerts = useMemo(() => dashboard?.recentAlerts || [], [dashboard])
  const traffic = useMemo(() => dashboard?.traffic || [], [dashboard])

  const lockedUsernames = useMemo(() => {
    const locked = new Set(
      (dashboard?.lockedUsernames || []).map((name) => String(name).toLowerCase()),
    )
    for (const user of users) {
      const uname = String(user.username || '').toLowerCase()
      if (!uname) continue
      if (user.isActive === false) locked.add(uname)
      else locked.delete(uname)
    }
    return locked
  }, [dashboard, users])

  const loadUsers = useCallback(async () => {
    if (!usersApiUrl) return
    setIsLoadingUsers(true)
    setUsersError('')
    try {
      const response = await fetch(usersApiUrl, { headers: authorizationHeaders() })
      const payload = await readApiPayload(response)
      setUsers(Array.isArray(payload) ? payload : [])
    } catch (err) {
      setUsersError(`Không tải được danh sách tài khoản: ${err.message}`)
    } finally {
      setIsLoadingUsers(false)
    }
  }, [usersApiUrl, authorizationHeaders])

  function handleSelectTab(nextTab) {
    setActiveTab(nextTab)
    if (nextTab === 'users') {
      loadUsers()
    }
  }

  function handleRefreshAll() {
    onRefresh()
    if (activeTab === 'users') {
      loadUsers()
    }
  }

  // 3 KPI trọng tâm cho Demo
  const highSeverityCount = useMemo(
    () =>
      alerts.filter((alert) =>
        ['HIGH', 'CRITICAL'].includes(String(alert.severityLevel || alert.severity || '').toUpperCase()),
      ).length,
    [alerts],
  )

  const totalUserPrompts = Number(dashboard?.totalUserPrompts ?? 0)
  const uniqueSourceIps = Number(dashboard?.uniqueSourceIps ?? 0)
  const blockRate =
    totalUserPrompts > 0 ? Math.min(100, Math.round((alerts.length / totalUserPrompts) * 100)) : 0

  const threatBreakdown = useMemo(() => {
    const counts = new Map()
    for (const alert of alerts) {
      const key = normalizeThreatKey(alert.threatType || alert.threat_type || alert.label)
      counts.set(key, (counts.get(key) || 0) + 1)
    }
    const entries = [...counts.entries()].map(([key, count]) => {
      const meta = THREAT_META[key] || { label: key, tone: 'slate' }
      const percent = alerts.length > 0 ? Math.round((count / alerts.length) * 100) : 0
      return { key, count, percent, label: meta.label, tone: meta.tone }
    })
    entries.sort((a, b) => b.count - a.count)
    return entries
  }, [alerts])

  const threatFilters = useMemo(() => {
    const dynamicExtras = threatBreakdown
      .map((item) => item.key)
      .filter((key) => key !== 'UNKNOWN' && !BASE_THREAT_ORDER.includes(key))
    return ['ALL', ...BASE_THREAT_ORDER, ...dynamicExtras]
  }, [threatBreakdown])

  const filteredAlerts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return alerts.filter((alert) => {
      const rawThreat = String(alert.threatType || alert.threat_type || alert.label || '')
      const normalized = normalizeThreatKey(rawThreat)
      if (selectedThreat !== 'ALL' && normalized !== selectedThreat) return false
      if (!query) return true
      const actor = String(alert.username || '').toLowerCase()
      const ip = String(alert.ipAddress || alert.ip_address || '').toLowerCase()
      const payload = String(alert.blockedPayload || alert.blocked_payload || '').toLowerCase()
      return (
        actor.includes(query)
        || rawThreat.toLowerCase().includes(query)
        || normalized.toLowerCase().includes(query)
        || ip.includes(query)
        || payload.includes(query)
      )
    })
  }, [alerts, searchQuery, selectedThreat])

  const filteredUsers = useMemo(() => {
    const query = userSearch.trim().toLowerCase()
    if (!query) return users
    return users.filter((u) => {
      const uname = String(u.username || '').toLowerCase()
      const role = String(u.role || '').toLowerCase()
      return uname.includes(query) || role.includes(query)
    })
  }, [users, userSearch])

  function handleExportCsv() {
    if (!filteredAlerts.length) return
    const headers = ['ID', 'Thoi gian', 'Tai khoan', 'IP nguon', 'Loai de doa', 'Muc do', 'Prompt bi chan']
    const rows = filteredAlerts.map((alert) => [
      escapeCsvCell(alert.id ?? ''),
      formatCsvDateCell(alert.createdAt || alert.created_at),
      escapeCsvCell(alert.username || '—'),
      escapeCsvCell(alert.ipAddress || alert.ip_address || ''),
      escapeCsvCell(normalizeThreatKey(alert.threatType || alert.threat_type || alert.label)),
      escapeCsvCell(String(alert.severityLevel || alert.severity || '').toUpperCase()),
      escapeCsvCell(alert.blockedPayload || alert.blocked_payload || ''),
    ])
    const csvContent =
      '\uFEFF' + [headers.map((h) => escapeCsvCell(h)).join(','), ...rows.map((r) => r.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `sentinel-security-audit-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
    onToast?.(`Đã xuất ${filteredAlerts.length} sự kiện ra file CSV.`, 'success')
  }

  function togglePayloadExpand(id) {
    setExpandedAlertIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleConfirmMutation() {
    if (!confirmState || isMutating) return
    setIsMutating(true)
    setMutationError('')

    try {
      if (confirmState.type === 'delete-alert') {
        const res = await fetch(`${adminApiUrl}/${encodeURIComponent(confirmState.alertId)}`, {
          method: 'DELETE',
          headers: authorizationHeaders(),
        })
        await readApiPayload(res)
        setConfirmState(null)
        onToast?.('Đã xóa bản ghi cảnh báo.', 'success')
        onRefresh()
      } else if (confirmState.type === 'clear-alerts') {
        const res = await fetch(adminApiUrl, {
          method: 'DELETE',
          headers: authorizationHeaders(),
        })
        await readApiPayload(res)
        setConfirmState(null)
        onToast?.('Đã dọn sạch toàn bộ nhật ký cảnh báo.', 'success')
        onRefresh()
      } else if (confirmState.type === 'toggle-user-status') {
        const res = await fetch(`${usersApiUrl}/${encodeURIComponent(confirmState.userId)}/status`, {
          method: 'PATCH',
          headers: authorizationHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ isActive: confirmState.nextActive }),
        })
        const updated = await readApiPayload(res)
        setUsers((prev) => prev.map((u) => (u.id === confirmState.userId ? updated : u)))
        setConfirmState(null)
        onToast?.(
          confirmState.nextActive
            ? `Đã mở khóa tài khoản ${confirmState.username}.`
            : `Đã khóa tài khoản ${confirmState.username}.`,
          confirmState.nextActive ? 'success' : 'warning',
        )
        onRefresh()
      } else if (confirmState.type === 'toggle-user-by-username') {
        const res = await fetch(
          `${usersApiUrl}/by-username/${encodeURIComponent(confirmState.username)}/status`,
          {
            method: 'PATCH',
            headers: authorizationHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ isActive: confirmState.nextActive }),
          },
        )
        const updated = await readApiPayload(res)
        setUsers((prev) =>
          prev.map((u) =>
            String(u.username || '').toLowerCase() === String(updated.username || '').toLowerCase()
              ? updated
              : u,
          ),
        )
        setConfirmState(null)
        onToast?.(
          confirmState.nextActive
            ? `Đã mở khóa tài khoản ${confirmState.username}.`
            : `Đã khóa tài khoản ${confirmState.username}.`,
          confirmState.nextActive ? 'success' : 'warning',
        )
        onRefresh()
      } else if (confirmState.type === 'toggle-user-role') {
        const res = await fetch(`${usersApiUrl}/${encodeURIComponent(confirmState.userId)}/role`, {
          method: 'PATCH',
          headers: authorizationHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ role: confirmState.nextRole }),
        })
        const updated = await readApiPayload(res)
        setUsers((prev) => prev.map((u) => (u.id === confirmState.userId ? updated : u)))
        setConfirmState(null)
        onToast?.(
          `Đã chuyển vai trò của ${confirmState.username} sang ${confirmState.nextRole === 'ROLE_ADMIN' ? 'ADMIN' : 'USER'}.`,
          'success',
        )
        onRefresh()
      }
    } catch (err) {
      setMutationError(err.message)
    } finally {
      setIsMutating(false)
    }
  }

  return (
    <section className="dashboard-page-wrap">
      <header className="chat-topbar">
        <div className="chat-topbar-left">
          <button
            className="topbar-icon-btn mobile-only"
            type="button"
            onClick={onOpenMobileMenu}
            aria-label="Mở menu"
            title="Mở menu"
          >
            <MenuIcon size={20} />
          </button>

          {isSidebarCollapsed && (
            <button
              className="topbar-icon-btn desktop-only"
              type="button"
              onClick={onToggleSidebar}
              aria-label="Mở rộng thanh bên"
              title="Mở rộng thanh bên"
            >
              <SidebarToggleIcon size={18} />
            </button>
          )}

          <div className="model-badge">
            <span className="model-name">Security Audit Console</span>
            <span className="model-tag">
              <i className="live-dot" aria-hidden="true" />
              Live Telemetry
            </span>
          </div>
        </div>

        <button
          type="button"
          className={`topbar-demo-chip ${guardrailsEnabled ? 'safe' : 'unsafe'}`}
          onClick={onToggleGuardrails}
          title="Nhấn để bật/tắt NeMo Guardrails cho chế độ Demo"
        >
          {guardrailsEnabled ? <ShieldCheckIcon size={14} /> : <ShieldOffIcon size={14} />}
          <span>{guardrailsEnabled ? 'NeMo Guardrails: BẬT' : 'NeMo Guardrails: TẮT (Demo)'}</span>
        </button>
      </header>

      <div className="dashboard-page">
        <div className="page-heading dashboard-heading">
          <div>
            <div className="eyebrow">SECURITY MONITORING & RBAC</div>
            <h1>Bảng điều khiển An ninh</h1>
            <p>
              Giám sát tấn công Prompt Injection theo thời gian thực, đo hiệu năng và khóa nhanh tài khoản vi phạm.
            </p>
          </div>
          <button
            className="refresh-button"
            type="button"
            onClick={handleRefreshAll}
            disabled={isLoading || isLoadingUsers}
          >
            <RefreshIcon size={15} />
            <span>{isLoading ? 'Đang tải...' : 'Làm mới dữ liệu'}</span>
          </button>
        </div>

        {error && <div className="error-banner dashboard-error" role="alert">{error}</div>}

        {/* 3 KPI Cards tinh gọn, dễ nhìn trên màn hình chiếu */}
        <div className="stats-grid stats-grid-3">
          <StatCard
            label="TỔNG CẢNH BÁO CHẶN"
            value={alerts.length}
            subtext={
              totalUserPrompts > 0
                ? `Tỷ lệ chặn ${blockRate}% trên ${totalUserPrompts} prompt`
                : 'Chưa ghi nhận lượt gửi'
            }
            icon={<ShieldAlertIcon size={18} />}
            tone="blue"
          />
          <StatCard
            label="MỨC ĐỘ CAO / NGHIÊM TRỌNG"
            value={highSeverityCount}
            subtext={`${uniqueSourceIps} IP nguồn đã bị chặn`}
            icon="!"
            tone="red"
          />
          <StatCard
            label="ĐỘ TRỄ XỬ LÝ TRUNG BÌNH"
            value={formatLatency(dashboard?.avgLatencyMs)}
            subtext={
              dashboard?.avgLatencyMs !== null && dashboard?.avgLatencyMs !== undefined
                ? 'Thời gian phản hồi Proxy + LLM'
                : 'Gửi 1 prompt mới để bắt đầu đo'
            }
            icon={<ActivityIcon size={18} />}
            tone="green"
          />
        </div>

        {/* 2 Tab gọn gàng: Giám sát & Nhật ký | Quản lý Tài khoản */}
        <div className="dashboard-tabs" role="tablist" aria-label="Phân hệ quản trị">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'monitor'}
            className={`dashboard-tab ${activeTab === 'monitor' ? 'active' : ''}`}
            onClick={() => handleSelectTab('monitor')}
          >
            <ActivityIcon size={15} />
            <span>Giám sát & Nhật ký Audit</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'users'}
            className={`dashboard-tab ${activeTab === 'users' ? 'active' : ''}`}
            onClick={() => handleSelectTab('users')}
          >
            <UsersIcon size={15} />
            <span>Quản lý Tài khoản (RBAC)</span>
          </button>
        </div>

        {/* TAB 1: GIÁM SÁT, BIỂU ĐỒ & NHẬT KÝ TẤN CÔNG */}
        {activeTab === 'monitor' && (
          <div className="tab-content-stack">
            <div className="dashboard-grid">
              <section className="panel chart-panel">
                <div className="panel-heading">
                  <div>
                    <h2>Lưu lượng & Cảnh báo theo ngày</h2>
                    <p>So sánh tổng prompt đầu vào và số yêu cầu bị NeMo Guardrails chặn.</p>
                  </div>
                  <span className="alert-count">{traffic.length} ngày</span>
                </div>
                <TrafficChart traffic={traffic} />
              </section>

              <section className="panel distribution-panel">
                <div className="panel-heading">
                  <div>
                    <h2>Phân bổ Loại đe dọa</h2>
                    <p>Tỷ trọng các kịch bản tấn công và ngoài phạm vi bị ngăn chặn.</p>
                  </div>
                </div>

                {threatBreakdown.length === 0 ? (
                  <div className="empty-state">Chưa có dữ liệu phân loại cảnh báo.</div>
                ) : (
                  <div className="threat-breakdown-list">
                    {threatBreakdown.map((item) => (
                      <div className="threat-breakdown-row" key={item.key}>
                        <div className="threat-breakdown-meta">
                          <span className="threat-breakdown-name">
                            <strong>{item.key}</strong>
                            <small>{item.label}</small>
                          </span>
                          <span className="threat-breakdown-stats">
                            <strong>{item.count}</strong> ({item.percent}%)
                          </span>
                        </div>
                        <div className="threat-bar-track">
                          <div
                            className={`threat-bar-fill ${item.tone}`}
                            style={{ width: `${Math.max(4, item.percent)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>

            <section className="panel audit-panel">
              <div className="panel-heading audit-panel-head">
                <div>
                  <h2>Nhật ký Cảnh báo Bảo mật</h2>
                  <p>Mới nhất xếp trên cùng · Xác định rõ tài khoản & IP để khóa ngay khi phát hiện tấn công.</p>
                </div>
                <div className="audit-header-actions">
                  <button
                    type="button"
                    className="soc-action-btn"
                    onClick={handleExportCsv}
                    disabled={filteredAlerts.length === 0}
                    title="Xuất danh sách ra file Excel CSV"
                  >
                    <DownloadIcon size={14} />
                    <span>Xuất CSV</span>
                  </button>
                  <button
                    type="button"
                    className="soc-action-btn danger"
                    disabled={alerts.length === 0}
                    onClick={() => {
                      setMutationError('')
                      setConfirmState({
                        type: 'clear-alerts',
                        title: 'Dọn sạch toàn bộ nhật ký cảnh báo?',
                        description: `Hành động này sẽ xóa vĩnh viễn ${alerts.length} bản ghi cảnh báo khỏi cơ sở dữ liệu.`,
                        confirmLabel: 'Xóa toàn bộ nhật ký',
                        tone: 'danger',
                      })
                    }}
                    title="Dọn sạch nhật ký cũ trước khi Demo"
                  >
                    <TrashIcon size={14} />
                    <span>Dọn nhật ký</span>
                  </button>
                </div>
              </div>

              <div className="audit-toolbar">
                <div className="audit-filter-pills" role="tablist" aria-label="Lọc theo loại đe dọa">
                  {threatFilters.map((filter) => (
                    <button
                      key={filter}
                      type="button"
                      role="tab"
                      aria-selected={selectedThreat === filter}
                      className={`audit-filter-pill ${selectedThreat === filter ? 'active' : ''}`}
                      onClick={() => setSelectedThreat(filter)}
                    >
                      {filter === 'ALL' ? 'Tất cả' : filter}
                    </button>
                  ))}
                </div>

                <div className="audit-search-box">
                  <SearchIcon size={15} />
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Tìm theo tài khoản, IP hoặc prompt..."
                    aria-label="Tìm kiếm cảnh báo"
                  />
                </div>
              </div>

              {isLoading ? (
                <div className="dashboard-loading">Đang tải dữ liệu kiểm toán...</div>
              ) : !error && filteredAlerts.length === 0 ? (
                <div className="empty-state">
                  {alerts.length === 0
                    ? 'Chưa có sự kiện cảnh báo nào.'
                    : 'Không tìm thấy cảnh báo phù hợp với bộ lọc.'}
                </div>
              ) : (
                <div className="audit-table-scroll">
                  <table className="audit-table">
                    <thead>
                      <tr>
                        <th>Thời gian</th>
                        <th>Tài khoản</th>
                        <th>IP nguồn</th>
                        <th>Loại đe dọa</th>
                        <th>Mức độ</th>
                        <th>Prompt bị chặn</th>
                        <th className="col-actions-alert">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAlerts.map((alert, index) => {
                        const alertKey = alert.id || `${alert.createdAt || alert.created_at}-${index}`
                        const severity = String(alert.severityLevel || alert.severity || 'UNKNOWN').toUpperCase()
                        const severityClass = severity.toLowerCase()
                        const normalizedThreat = normalizeThreatKey(
                          alert.threatType || alert.threat_type || alert.label,
                        )
                        const actorUsername = String(alert.username || '').trim()
                        const actorLower = actorUsername.toLowerCase()
                        const isSelfActor =
                          Boolean(actorLower) && actorLower === String(currentUsername || '').toLowerCase()
                        const isActorLocked = Boolean(actorLower) && lockedUsernames.has(actorLower)
                        const payload = String(alert.blockedPayload || alert.blocked_payload || '—')
                        const isLongPayload = payload.length > 140
                        const isExpanded = expandedAlertIds.has(alertKey)
                        const shownPayload =
                          isLongPayload && !isExpanded ? `${payload.slice(0, 140)}...` : payload

                        return (
                          <tr key={alertKey}>
                            <td className="audit-time">{formatDateTime(alert.createdAt || alert.created_at)}</td>
                            <td className="audit-actor">
                              {actorUsername ? (
                                <span className="audit-user-wrap">
                                  <span className={`alert-user-chip ${isActorLocked ? 'locked' : ''}`}>
                                    {actorUsername}
                                  </span>
                                  {isActorLocked && <span className="alert-locked-tag">Đã khóa</span>}
                                </span>
                              ) : (
                                <span className="muted-dash">—</span>
                              )}
                            </td>
                            <td className="audit-ip">{alert.ipAddress || alert.ip_address || '—'}</td>
                            <td>
                              <span className="threat-tag">{normalizedThreat}</span>
                            </td>
                            <td>
                              <span className={`severity-label ${severityClass}`}>{severity}</span>
                            </td>
                            <td className="audit-payload" title={payload}>
                              <span>{shownPayload}</span>
                              {isLongPayload && (
                                <button
                                  type="button"
                                  className="payload-expand-btn"
                                  onClick={() => togglePayloadExpand(alertKey)}
                                >
                                  {isExpanded ? 'Thu gọn' : 'Xem thêm'}
                                </button>
                              )}
                            </td>
                            <td className="col-actions-alert">
                              <div className="alert-row-actions">
                                {actorUsername && !isSelfActor && (
                                  <button
                                    type="button"
                                    className={`table-icon-btn ${isActorLocked ? 'unlock' : 'lock'}`}
                                    title={
                                      isActorLocked
                                        ? `Mở khóa tài khoản ${actorUsername}`
                                        : `Khóa ngay tài khoản ${actorUsername}`
                                    }
                                    aria-label={
                                      isActorLocked
                                        ? `Mở khóa ${actorUsername}`
                                        : `Khóa tài khoản ${actorUsername}`
                                    }
                                    onClick={() => {
                                      setMutationError('')
                                      setConfirmState({
                                        type: 'toggle-user-by-username',
                                        username: actorUsername,
                                        nextActive: isActorLocked,
                                        title: isActorLocked
                                          ? `Mở khóa tài khoản "${actorUsername}"?`
                                          : `Khóa tài khoản "${actorUsername}"?`,
                                        description: isActorLocked
                                          ? `Khôi phục quyền đăng nhập và chat cho tài khoản "${actorUsername}".`
                                          : `Tài khoản "${actorUsername}" sẽ bị khóa ngay lập tức và không thể tiếp tục gửi prompt tới AI Proxy.`,
                                        confirmLabel: isActorLocked ? 'Mở khóa' : 'Khóa tài khoản',
                                        tone: isActorLocked ? 'primary' : 'danger',
                                      })
                                    }}
                                  >
                                    {isActorLocked ? <UnlockIcon size={14} /> : <LockIcon size={14} />}
                                  </button>
                                )}

                                {alert.id && (
                                  <button
                                    type="button"
                                    className="table-icon-btn danger"
                                    title="Xóa bản ghi cảnh báo này"
                                    aria-label={`Xóa cảnh báo ${alert.id}`}
                                    onClick={() => {
                                      setMutationError('')
                                      setConfirmState({
                                        type: 'delete-alert',
                                        alertId: alert.id,
                                        title: `Xóa bản ghi cảnh báo #${alert.id}?`,
                                        description: 'Bản ghi cảnh báo này sẽ bị xóa khỏi nhật ký kiểm toán.',
                                        confirmLabel: 'Xóa bản ghi',
                                        tone: 'danger',
                                      })
                                    }}
                                  >
                                    <TrashIcon size={14} />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        )}

        {/* TAB 2: QUẢN LÝ TÀI KHOẢN & PHÂN QUYỀN RBAC */}
        {activeTab === 'users' && (
          <section className="panel iam-panel">
            <div className="panel-heading">
              <div>
                <h2>Quản lý Tài khoản & Phân quyền (RBAC)</h2>
                <p>Khóa/Mở khóa nhanh tài khoản vi phạm hoặc cấp quyền Quản trị viên (có hiệu lực ngay).</p>
              </div>
              <div className="audit-search-box">
                <SearchIcon size={15} />
                <input
                  type="search"
                  value={userSearch}
                  onChange={(event) => setUserSearch(event.target.value)}
                  placeholder="Tìm theo username..."
                  aria-label="Tìm kiếm tài khoản"
                />
              </div>
            </div>

            {usersError && <div className="error-banner iam-error" role="alert">{usersError}</div>}

            {isLoadingUsers ? (
              <div className="dashboard-loading">Đang tải danh sách tài khoản...</div>
            ) : filteredUsers.length === 0 ? (
              <div className="empty-state">Không tìm thấy tài khoản nào phù hợp.</div>
            ) : (
              <div className="audit-table-scroll">
                <table className="audit-table iam-table">
                  <thead>
                    <tr>
                      <th>Tên đăng nhập</th>
                      <th>Vai trò</th>
                      <th>Trạng thái</th>
                      <th>Ngày tạo</th>
                      <th className="col-actions-wide">Thao tác quản trị</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((user) => {
                      const isSelf =
                        String(user.username || '').toLowerCase() === String(currentUsername || '').toLowerCase()
                      const isUserAdmin = String(user.role || '').toUpperCase().includes('ADMIN')
                      const isActive = user.isActive !== false

                      return (
                        <tr key={user.id} className={!isActive ? 'row-locked' : ''}>
                          <td>
                            <div className="iam-username-cell">
                              <strong>{user.username}</strong>
                              {isSelf && <span className="self-pill">Bạn</span>}
                            </div>
                          </td>
                          <td>
                            <span className={`role-badge ${isUserAdmin ? 'admin' : 'user'}`}>
                              {isUserAdmin ? 'ADMIN' : 'USER'}
                            </span>
                          </td>
                          <td>
                            <span className={`status-badge ${isActive ? 'active' : 'locked'}`}>
                              {isActive ? 'Hoạt động' : 'Đã khóa'}
                            </span>
                          </td>
                          <td className="audit-time">{formatDateTime(user.createdAt)}</td>
                          <td className="col-actions-wide">
                            <div className="iam-actions-group">
                              <button
                                type="button"
                                className={`iam-btn ${isActive ? 'warn' : 'ok'}`}
                                disabled={isSelf}
                                title={
                                  isSelf
                                    ? 'Không thể tự khóa tài khoản đang đăng nhập'
                                    : isActive
                                      ? 'Khóa tài khoản này'
                                      : 'Mở khóa tài khoản này'
                                }
                                onClick={() => {
                                  setMutationError('')
                                  setConfirmState({
                                    type: 'toggle-user-status',
                                    userId: user.id,
                                    username: user.username,
                                    nextActive: !isActive,
                                    title: isActive
                                      ? `Khóa tài khoản "${user.username}"?`
                                      : `Mở khóa tài khoản "${user.username}"?`,
                                    description: isActive
                                      ? `Tài khoản "${user.username}" sẽ bị chặn đăng nhập và thu hồi quyền truy cập ngay lập tức.`
                                      : `Khôi phục quyền đăng nhập cho tài khoản "${user.username}".`,
                                    confirmLabel: isActive ? 'Khóa tài khoản' : 'Mở khóa',
                                    tone: isActive ? 'danger' : 'primary',
                                  })
                                }}
                              >
                                {isActive ? <LockIcon size={13} /> : <UnlockIcon size={13} />}
                                <span>{isActive ? 'Khóa' : 'Mở khóa'}</span>
                              </button>

                              <button
                                type="button"
                                className="iam-btn neutral"
                                disabled={isSelf}
                                title={
                                  isSelf
                                    ? 'Không thể tự hạ quyền của chính mình'
                                    : isUserAdmin
                                      ? 'Hạ xuống tài khoản USER'
                                      : 'Cấp quyền Quản trị viên (ADMIN)'
                                }
                                onClick={() => {
                                  const nextRole = isUserAdmin ? 'ROLE_USER' : 'ROLE_ADMIN'
                                  setMutationError('')
                                  setConfirmState({
                                    type: 'toggle-user-role',
                                    userId: user.id,
                                    username: user.username,
                                    nextRole,
                                    title: isUserAdmin
                                      ? `Hạ quyền "${user.username}" xuống USER?`
                                      : `Cấp quyền ADMIN cho "${user.username}"?`,
                                    description: isUserAdmin
                                      ? `Người dùng "${user.username}" sẽ không còn quyền vào Bảng điều khiển Admin.`
                                      : `Người dùng "${user.username}" sẽ có quyền truy cập Bảng điều khiển An ninh Admin.`,
                                    confirmLabel: isUserAdmin ? 'Hạ về USER' : 'Cấp ADMIN',
                                    tone: isUserAdmin ? 'danger' : 'primary',
                                  })
                                }}
                              >
                                <span>{isUserAdmin ? 'Hạ User' : 'Cấp Admin'}</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        <p className="admin-security-note">
          Chỉ tài khoản ADMIN (xác thực chữ ký JWT HMAC-SHA256 & trạng thái DB) mới có quyền truy cập và thao tác trên Bảng điều khiển.
        </p>
      </div>

      <ConfirmModal
        isOpen={Boolean(confirmState)}
        title={confirmState?.title || ''}
        description={confirmState?.description || ''}
        confirmLabel={confirmState?.confirmLabel || 'Xác nhận'}
        tone={confirmState?.tone || 'danger'}
        isLoading={isMutating}
        error={mutationError}
        onConfirm={handleConfirmMutation}
        onCancel={() => setConfirmState(null)}
      />
    </section>
  )
}
