import React from 'react'

export default function SecurityAlert({ content, reason }) {
  return (
    <div style={{
      background: '#fff5f5',
      border: '1px solid #feb2b2',
      borderRadius: '8px',
      padding: '12px 16px',
      color: '#c53030',
      marginTop: '8px',
      boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold', fontSize: '14px' }}>
        <span>⚑</span>
        <span>[BLOCKED] PROMPT INJECTION DETECTED</span>
      </div>
      <p style={{ margin: '6px 0 0', fontSize: '13px', color: '#9b2c2c', lineHeight: 1.5 }}>
        {content || 'Yêu cầu bị ngăn chặn do phát hiện nguy cơ tấn công an ninh thông tin.'}
      </p>
      {reason && (
        <small style={{ display: 'block', marginTop: '6px', color: '#e53e3e', fontSize: '11px', fontStyle: 'italic' }}>
          Mã kiểm duyệt: {reason}
        </small>
      )}
    </div>
  )
}