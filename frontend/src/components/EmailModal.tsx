import { useState, useEffect } from 'react'
import type { Professor } from '../types'
import { generateEmail } from '../api'

interface Props {
  professor: Professor
  resumeText: string
  resumeFileName?: string
  selectedPaperTitles: string[]
  onSelectedPaperTitlesChange: (titles: string[]) => void
  onClose: () => void
}

function draftStorageKey(professor: Professor): string {
  const base = `${professor.university}::${professor.name}`.toLowerCase()
  return `email_draft_v1::${base}`
}

export default function EmailModal({
  professor,
  resumeText,
  resumeFileName,
  selectedPaperTitles,
  onSelectedPaperTitlesChange,
  onClose,
}: Props) {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  const selectedPapers = (professor.papers || []).filter(
    p => selectedPaperTitles.includes(p.title)
  )

  const requestDraft = async (useSelectedOnly: boolean) => {
    const narrowedProfessor =
      useSelectedOnly && selectedPapers.length > 0
        ? { ...professor, papers: selectedPapers }
        : professor
    const r = await generateEmail(narrowedProfessor, resumeText)
    return r.email
  }

  useEffect(() => {
    const key = draftStorageKey(professor)
    const savedDraft = localStorage.getItem(key)
    if (savedDraft) {
      setEmail(savedDraft)
      setLoading(false)
      return
    }

    requestDraft(true)
      .then(text => setEmail(text))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [professor, resumeText])

  useEffect(() => {
    if (loading || error) return
    const key = draftStorageKey(professor)
    localStorage.setItem(key, email)
  }, [email, loading, error, professor])

  const handleCopy = () => {
    navigator.clipboard.writeText(email).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const togglePaper = (title: string) => {
    const next = selectedPaperTitles.includes(title)
      ? selectedPaperTitles.filter(t => t !== title)
      : [...selectedPaperTitles, title]
    onSelectedPaperTitlesChange(next)
  }

  const handleRegenerate = async () => {
    setLoading(true)
    setError('')
    try {
      const nextEmail = await requestDraft(true)
      setEmail(nextEmail)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to regenerate email')
    } finally {
      setLoading(false)
    }
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
            <div style={styles.paperPicker}>
              <div style={styles.paperPickerTitle}>Highlight papers to mention in your email:</div>
              {professor.papers?.length > 0 ? (
                <>
                  <div style={styles.paperPickerList}>
                    {professor.papers.slice(0, 4).map((paper, idx) => (
                      <label key={`${paper.title}-${idx}`} style={styles.paperOption}>
                        <input
                          type="checkbox"
                          checked={selectedPaperTitles.includes(paper.title)}
                          onChange={() => togglePaper(paper.title)}
                        />
                        <span>{paper.title}</span>
                      </label>
                    ))}
                  </div>
                  <button type="button" style={styles.regenBtn} onClick={handleRegenerate} disabled={loading}>
                    Regenerate with selected papers
                  </button>
                </>
              ) : (
                <div style={styles.noPapersText}>
                  No papers available for this professor yet, so specific paper selection is not available.
                </div>
              )}
            </div>
            <textarea
              style={styles.emailArea}
              value={email}
              onChange={e => setEmail(e.target.value)}
              rows={18}
            />
            {resumeFileName && (
              <div style={styles.resumeHint}>
                Resume uploaded: <strong>{resumeFileName}</strong>. Please attach it manually in your email client.
              </div>
            )}
            <div style={styles.footer}>
              <button style={styles.copyBtn} onClick={handleCopy}>
                {copied ? '✓ Copied!' : 'Copy to Clipboard'}
              </button>
              {professor.email && (
                <a
                  href={`mailto:${professor.email}?subject=Research Interest&body=${encodeURIComponent(email)}`}
                  style={styles.mailtoBtn}
                >
                  {resumeFileName ? 'Open in Mail (attach resume)' : 'Open in Mail'}
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
    background: 'rgba(79, 103, 118, 0.35)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '16px',
    backdropFilter: 'blur(2px)',
  },
  modal: {
    background: '#fbf8f0',
    border: '2px solid #cfd8d2',
    borderRadius: '20px',
    width: '100%',
    maxWidth: '600px',
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 18px 45px rgba(60, 72, 80, 0.2)',
    overflow: 'hidden',
  },
  header: {
    padding: '20px 24px',
    borderBottom: '1px solid #e4ece7',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  title: {
    fontSize: '18px',
    fontWeight: 700,
    color: '#3f4d57',
  },
  subtitle: {
    fontSize: '13px',
    color: '#6f7d86',
    marginTop: '2px',
  },
  closeBtn: {
    background: '#f0f5f2',
    border: '1px solid #d5dfd9',
    borderRadius: '8px',
    width: '32px',
    height: '32px',
    color: '#6f7d86',
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
    color: '#6f7d86',
    fontSize: '14px',
  },
  error: {
    padding: '24px',
    color: '#ef4444',
    fontSize: '14px',
  },
  paperPicker: {
    margin: '16px 24px 0',
    padding: '10px 12px',
    border: '1px solid #d5dfd9',
    borderRadius: '10px',
    background: '#f6f9f7',
  },
  paperPickerTitle: {
    fontSize: '12px',
    fontWeight: 700,
    color: '#4f6170',
    marginBottom: '8px',
  },
  paperPickerList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  paperOption: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '12px',
    color: '#5f6d77',
  },
  noPapersText: {
    fontSize: '12px',
    color: '#6f7d86',
  },
  regenBtn: {
    marginTop: '10px',
    padding: '8px 12px',
    border: '1px solid #c8d4ce',
    borderRadius: '8px',
    background: '#ffffff',
    color: '#4f6170',
    fontSize: '12px',
    fontWeight: 600,
  },
  emailArea: {
    flex: 1,
    margin: '0 24px',
    padding: '16px',
    border: '1.5px solid #cfd8d2',
    borderRadius: '10px',
    fontSize: '14px',
    lineHeight: 1.7,
    color: '#4b5563',
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
  resumeHint: {
    margin: '10px 24px 0',
    fontSize: '12px',
    color: '#647685',
    background: '#f6f9f7',
    border: '1px solid #d5dfd9',
    borderRadius: '8px',
    padding: '8px 10px',
  },
  copyBtn: {
    padding: '10px 20px',
    background: '#6f8fa3',
    border: 'none',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '14px',
    fontWeight: 600,
  },
  mailtoBtn: {
    padding: '10px 20px',
    background: '#f0f5f2',
    border: '1px solid #d5dfd9',
    borderRadius: '8px',
    color: '#4f6170',
    fontSize: '14px',
    fontWeight: 600,
    textDecoration: 'none',
    display: 'inline-flex',
    alignItems: 'center',
  },
}
