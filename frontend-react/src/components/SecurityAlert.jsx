import { ShieldAlertIcon } from './Icons'

const THREAT_LABELS = {
  JAILBREAK: 'JAILBREAK',
  PROMPT_LEAKAGE: 'PROMPT LEAKAGE',
  MALICIOUS_INTENT: 'MALICIOUS INTENT',
  OFF_TOPIC: 'OFF-TOPIC',
}

function parseThreatInfo(reason) {
  if (!reason) return { code: '', threatBadge: '' }
  const parts = String(reason)
    .split('·')
    .map((part) => part.trim())
    .filter(Boolean)

  const threatKey = parts.find((part) => THREAT_LABELS[part]) || ''
  const code = parts.find((part) => !THREAT_LABELS[part]) || parts[0] || ''

  return {
    code,
    threatBadge: THREAT_LABELS[threatKey] || threatKey,
  }
}

export default function SecurityAlert({ content, reason }) {
  const { code, threatBadge } = parseThreatInfo(reason)

  return (
    <div className="security-alert-card" role="status" aria-label="Cảnh báo bảo mật">
      <div className="security-alert-header">
        <div className="security-alert-title">
          <span className="security-alert-icon">
            <ShieldAlertIcon size={17} />
          </span>
          <strong>[BLOCKED] YÊU CẦU BỊ NGĂN CHẶN</strong>
        </div>
        {threatBadge && <span className="security-threat-badge">{threatBadge}</span>}
      </div>

      <p className="security-alert-body">
        {content || 'Yêu cầu bị ngăn chặn do phát hiện vi phạm chính sách an toàn thông tin.'}
      </p>

      {code && (
        <div className="security-alert-meta">
          <span>Mã kiểm duyệt:</span>
          <code>{code}</code>
        </div>
      )}
    </div>
  )
}
