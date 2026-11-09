import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import SecurityAlert from './SecurityAlert'
import { AlertTriangleIcon, CheckIcon, CopyIcon, ShieldCheckIcon } from './Icons'

function formatLatency(value) {
  const milliseconds = Number(value)
  if (!Number.isFinite(milliseconds) || milliseconds < 0) return ''
  return milliseconds >= 1000
    ? `${(milliseconds / 1000).toFixed(1)}s`
    : `${Math.round(milliseconds)}ms`
}

function extractText(node) {
  if (node == null || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(extractText).join('')
  if (typeof node === 'object' && node.props?.children !== undefined) {
    return extractText(node.props.children)
  }
  return ''
}

function MarkdownCodeBlock({ children }) {
  const [copied, setCopied] = useState(false)
  const codeChild = Array.isArray(children) ? children[0] : children
  const className = codeChild?.props?.className || ''
  const match = /language-([\w-]+)/.exec(className)
  const language = match ? match[1] : 'code'
  const rawCode = extractText(children).replace(/\n$/, '')

  async function handleCopyCode() {
    try {
      await navigator.clipboard.writeText(rawCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      // Clipboard API may fail in insecure contexts
    }
  }

  return (
    <div className="md-code-block">
      <div className="md-code-header">
        <span>{language}</span>
        <button
          type="button"
          className="md-copy-btn"
          onClick={handleCopyCode}
          title="Sao chép mã nguồn"
        >
          {copied ? <CheckIcon size={13} /> : <CopyIcon size={13} />}
          <span>{copied ? 'Đã sao chép' : 'Sao chép'}</span>
        </button>
      </div>
      <pre>{children}</pre>
    </div>
  )
}

const markdownComponents = {
  pre: MarkdownCodeBlock,
}

export default function MessageBubble({ message }) {
  const [copied, setCopied] = useState(false)
  const isUser = message.role === 'user'
  const latencyLabel =
    message.latencyMs !== undefined && message.latencyMs !== null
      ? formatLatency(message.latencyMs)
      : ''

  async function handleCopyMessage() {
    try {
      await navigator.clipboard.writeText(message.content || '')
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      // Ignore clipboard failures
    }
  }

  if (isUser) {
    return (
      <div className="message-row user">
        <div className="message-stack user-stack">
          <div className="message-bubble user-bubble">
            {message.content}
          </div>
          <div className="message-hover-actions user-actions">
            <button
              type="button"
              className="msg-action-btn"
              onClick={handleCopyMessage}
              title="Sao chép tin nhắn"
              aria-label="Sao chép tin nhắn"
            >
              {copied ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="message-row assistant">
      <div className="message-stack assistant-stack">
        {message.blocked ? (
          <SecurityAlert content={message.content} reason={message.reason} />
        ) : (
          <div className="message-bubble ai-bubble">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
              {message.content || ''}
            </ReactMarkdown>
          </div>
        )}

        <div className="assistant-footer">
          <button
            type="button"
            className="msg-action-btn"
            onClick={handleCopyMessage}
            title="Sao chép phản hồi"
            aria-label="Sao chép phản hồi"
          >
            {copied ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
            <span>{copied ? 'Đã sao chép' : 'Sao chép'}</span>
          </button>

          {latencyLabel && (
            <div
              className={`message-security ${
                message.blocked
                  ? 'blocked'
                  : message.guardrailsEnabled === false
                    ? 'bypassed'
                    : ''
              }`}
            >
              {message.blocked ? (
                <span className="security-dot blocked" aria-hidden="true">⚑</span>
              ) : message.guardrailsEnabled === false ? (
                <span className="security-icon-warn" aria-hidden="true">
                  <AlertTriangleIcon size={13} />
                </span>
              ) : (
                <span className="security-icon-ok" aria-hidden="true">
                  <ShieldCheckIcon size={13} />
                </span>
              )}
              <span>
                {message.blocked
                  ? 'Yêu cầu đã bị chặn'
                  : message.guardrailsEnabled === false
                    ? 'Bypassed (Guardrails OFF)'
                    : 'NeMo Guardrails Verified'}
              </span>
              <span className="latency-sep">·</span>
              <span>{latencyLabel}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
