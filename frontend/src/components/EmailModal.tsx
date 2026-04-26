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
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [hasGenerated, setHasGenerated] = useState(false)

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
    if (!hasGenerated || loading || error) return
    const key = draftStorageKey(professor)
    localStorage.setItem(key, email)
  }, [email, hasGenerated, loading, error, professor])

  const handleCopy = () => {
    navigator.clipboard.writeText(email).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const togglePaper = (title: string) => {
    const isSelected = selectedPaperTitles.includes(title)
    const next = isSelected ? [] : [title]
    onSelectedPaperTitlesChange(next)
  }

  const handleRegenerate = async () => {
    setLoading(true)
    setError('')
    try {
      const nextEmail = await requestDraft(true)
      setEmail(nextEmail)
      setHasGenerated(true)
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

        {!error && (
          <>
            <div style={styles.paperPicker}>
              <div style={styles.paperPickerTitle}>Select one paper to mention in your email:</div>
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
                    {hasGenerated ? 'Regenerate with selected paper' : 'Generate email'}
                  </button>
                </>
              ) : (
                <div style={styles.noPapersText}>
                  No papers available for this professor yet, so specific paper selection is not available.
                </div>
              )}
            </div>
            {hasGenerated && !loading && (
              <>
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
    background: 'rgba(46, 58, 90, 0.3)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '16px',
    backdropFilter: 'blur(2px)',
  },
  modal: {
    background: 'linear-gradient(180deg, #fffaf4 0%, #ffffff 100%)',
    border: '1px solid rgba(96, 109, 148, 0.12)',
    borderRadius: '24px',
    width: '100%',
    maxWidth: '600px',
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 28px 56px rgba(60, 72, 80, 0.22)',
    overflow: 'hidden',
  },
  header: {
    padding: '20px 24px',
    borderBottom: '1px solid rgba(96, 109, 148, 0.12)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  title: {
    fontSize: '18px',
    fontWeight: 800,
    color: '#31415d',
  },
  subtitle: {
    fontSize: '13px',
    color: '#73809b',
    marginTop: '2px',
  },
  closeBtn: {
    background: '#fff1ec',
    border: '1px solid rgba(255, 111, 97, 0.16)',
    borderRadius: '8px',
    width: '32px',
    height: '32px',
    color: '#b35336',
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
    borderTopColor: '#547df0',
    borderRadius: '50%',
    animation: 'spin 0.7s linear infinite',
  },
  loadingText: {
    color: '#73809b',
    fontSize: '14px',
  },
  error: {
    padding: '24px',
    color: '#b35336',
    fontSize: '14px',
  },
  paperPicker: {
    margin: '16px 24px 0',
    padding: '12px 14px',
    border: '1px solid rgba(96, 109, 148, 0.12)',
    borderRadius: '16px',
    background: '#f8fcff',
  },
  paperPickerTitle: {
    fontSize: '12px',
    fontWeight: 800,
    color: '#425f7d',
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
    color: '#73809b',
  },
  regenBtn: {
    marginTop: '10px',
    padding: '10px 14px',
    border: '1px solid rgba(84, 125, 240, 0.16)',
    borderRadius: '12px',
    background: '#f2f6ff',
    color: '#456ad1',
    fontSize: '12px',
    fontWeight: 800,
  },
  emailArea: {
    flex: 1,
    margin: '0 24px',
    padding: '16px',
    border: '1px solid rgba(96, 109, 148, 0.14)',
    borderRadius: '16px',
    fontSize: '14px',
    lineHeight: 1.7,
    color: '#44506a',
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
    color: '#55627e',
    background: '#f7fbff',
    border: '1px solid rgba(96, 109, 148, 0.12)',
    borderRadius: '12px',
    padding: '8px 10px',
  },
  copyBtn: {
    padding: '10px 20px',
    background: 'linear-gradient(135deg, #ff8964 0%, #ff6f61 100%)',
    border: 'none',
    borderRadius: '12px',
    color: '#fff',
    fontSize: '14px',
    fontWeight: 800,
  },
  mailtoBtn: {
    padding: '10px 20px',
    background: '#fffdfa',
    border: '1px solid rgba(96, 109, 148, 0.14)',
    borderRadius: '12px',
    color: '#4a5d79',
    fontSize: '14px',
    fontWeight: 700,
    textDecoration: 'none',
    display: 'inline-flex',
    alignItems: 'center',
  },
}
