import { useState, useEffect } from 'react'
import type { Professor } from '../types'
import { generateEmail } from '../api'

interface Props {
  professor: Professor
  resumeText: string
  onClose: () => void
}

export default function EmailModal({ professor, resumeText, onClose }: Props) {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    generateEmail(professor, resumeText)
      .then(r => setEmail(r.email))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [professor, resumeText])

  const handleCopy = () => {
    navigator.clipboard.writeText(email).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div style={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={styles.modal}>
        <div style={styles.header}>
          <div>
            <div style={styles.title}>Cold Email Draft</div>
            <div style={styles.subtitle}>To: {professor.name}</div>
          </div>
          <button style={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        {loading && (
          <div style={styles.center}>
            <div style={styles.spinner} />
            <div style={styles.loadingText}>Drafting email…</div>
          </div>
        )}

        {error && (
          <div style={styles.error}>{error}</div>
        )}

        {!loading && !error && (
          <>
            <textarea
              style={styles.emailArea}
              value={email}
              onChange={e => setEmail(e.target.value)}
              rows={18}
            />
            <div style={styles.footer}>
              <button style={styles.copyBtn} onClick={handleCopy}>
                {copied ? '✓ Copied!' : 'Copy to Clipboard'}
              </button>
              {professor.email && (
                <a
                  href={`mailto:${professor.email}?subject=Research Interest&body=${encodeURIComponent(email)}`}
                  style={styles.mailtoBtn}
                >
                  Open in Mail
                </a>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.45)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '16px',
    backdropFilter: 'blur(2px)',
  },
  modal: {
    background: '#fff',
    borderRadius: '16px',
    width: '100%',
    maxWidth: '600px',
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
    overflow: 'hidden',
  },
  header: {
    padding: '20px 24px',
    borderBottom: '1px solid #f3f4f6',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  title: {
    fontSize: '18px',
    fontWeight: 700,
    color: '#1a1a2e',
  },
  subtitle: {
    fontSize: '13px',
    color: '#6b7280',
    marginTop: '2px',
  },
  closeBtn: {
    background: '#f3f4f6',
    border: 'none',
    borderRadius: '8px',
    width: '32px',
    height: '32px',
    color: '#6b7280',
    fontSize: '14px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    padding: '48px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
  },
  spinner: {
    width: '32px',
    height: '32px',
    border: '3px solid #e5e7eb',
    borderTopColor: '#6366f1',
    borderRadius: '50%',
    animation: 'spin 0.7s linear infinite',
  },
  loadingText: {
    color: '#6b7280',
    fontSize: '14px',
  },
  error: {
    padding: '24px',
    color: '#ef4444',
    fontSize: '14px',
  },
  emailArea: {
    flex: 1,
    margin: '0 24px',
    padding: '16px',
    border: '1.5px solid #e5e7eb',
    borderRadius: '10px',
    fontSize: '14px',
    lineHeight: 1.7,
    color: '#1a1a2e',
    resize: 'none',
    fontFamily: 'inherit',
    outline: 'none',
    marginTop: '20px',
    marginBottom: '0',
    overflowY: 'auto',
  },
  footer: {
    padding: '16px 24px 24px',
    display: 'flex',
    gap: '12px',
  },
  copyBtn: {
    padding: '10px 20px',
    background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
    border: 'none',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '14px',
    fontWeight: 600,
  },
  mailtoBtn: {
    padding: '10px 20px',
    background: '#f3f4f6',
    border: 'none',
    borderRadius: '8px',
    color: '#374151',
    fontSize: '14px',
    fontWeight: 600,
    textDecoration: 'none',
    display: 'inline-flex',
    alignItems: 'center',
  },
}
