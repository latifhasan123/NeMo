import { useEffect } from 'react'
import { AlertTriangleIcon, CloseIcon, ShieldCheckIcon } from './Icons'

export default function ConfirmModal({
  isOpen,
  title,
  description,
  confirmLabel = 'Xác nhận xóa',
  cancelLabel = 'Hủy',
  loadingLabel = 'Đang xử lý...',
  tone = 'danger',
  isLoading = false,
  error = '',
  onConfirm,
  onCancel,
}) {
  useEffect(() => {
    if (!isOpen) return undefined
    function handleKeyDown(event) {
      if (event.key === 'Escape' && !isLoading) {
        onCancel()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, isLoading, onCancel])

  if (!isOpen) return null

  const isPrimary = tone === 'primary'

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onClick={() => {
        if (!isLoading) onCancel()
      }}
    >
      <div
        className="confirm-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="confirm-modal-top">
          <span className={`confirm-modal-icon ${isPrimary ? 'primary' : ''}`} aria-hidden="true">
            {isPrimary ? <ShieldCheckIcon size={20} /> : <AlertTriangleIcon size={20} />}
          </span>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onCancel}
            disabled={isLoading}
            aria-label="Đóng hộp thoại"
          >
            <CloseIcon size={17} />
          </button>
        </div>

        <h2 id="confirm-modal-title">{title}</h2>
        <p className="confirm-modal-desc">{description}</p>

        {error && (
          <div className="error-banner confirm-modal-error" role="alert">
            {error}
          </div>
        )}

        <div className="confirm-modal-actions">
          <button
            type="button"
            className="modal-btn-cancel"
            onClick={onCancel}
            disabled={isLoading}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={isPrimary ? 'modal-btn-primary' : 'modal-btn-danger'}
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading ? loadingLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
