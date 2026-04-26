import { useState } from 'react'
import type { Professor } from '../types'

interface Props {
  professor: Professor
  onEmailClick: (professor: Professor) => void
  saved: boolean
  onSaveClick: (professor: Professor) => void
}

function scoreColor(score: number): string {
  if (score >= 80) return '#059669'
  if (score >= 60) return '#d97706'
  return '#6b7280'
}

function scoreBg(score: number): string {
  if (score >= 80) return '#ecfdf5'
  if (score >= 60) return '#fffbeb'
  return '#f9fafb'
}

export default function ProfessorCard({ professor, onEmailClick, saved, onSaveClick }: Props) {
  const [papersOpen, setPapersOpen] = useState(false)
  const [hovered, setHovered] = useState(false)

  const nameUrl = professor.directory_url || professor.profile_url || professor.personal_website || professor.url
  const canOpenPapers = (professor.papers?.length ?? 0) > 0

  return (
    <div
      style={{
        ...styles.card,
        ...(canOpenPapers && !papersOpen ? styles.cardClickable : {}),
        ...(canOpenPapers && hovered && !papersOpen ? styles.cardHover : {}),
      }}
      onClick={() => {
        if (canOpenPapers) setPapersOpen(true)
      }}
      onMouseEnter={() => {
        if (!papersOpen) setHovered(true)
      }}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={styles.top}>
        <div style={styles.nameRow}>
          <div style={styles.titleWrap}>
            <div style={styles.name}>
              {nameUrl ? (
                <a
                  href={nameUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={styles.nameLink}
                  onClick={e => e.stopPropagation()}
                >
                  {professor.name}
                </a>
              ) : professor.name}
            </div>
            <div style={styles.subline}>
              {(professor.research_areas?.[0] || professor.type)} • {professor.university}
            </div>
            <div style={styles.meta}>
              <span style={typeStyle(professor.type)}>{professor.type}</span>
              {nameUrl && (
                <a href={nameUrl} target="_blank" rel="noopener noreferrer" style={styles.websiteChip} onClick={e => e.stopPropagation()}>
                  🔗 Website
                </a>
              )}
            </div>
          </div>
          <div style={{ ...styles.matchPill, background: scoreBg(professor.match_score), color: scoreColor(professor.match_score) }}>
            ✨ {professor.match_score}% match
          </div>
        </div>
      </div>

      <div style={styles.body}>
        {professor.research_summary && (
          <p style={styles.summary}>{professor.research_summary}</p>
        )}

        {professor.papers?.length > 0 && <div style={styles.hint}>Click card to view recent papers</div>}
      </div>

      <div style={styles.footer}>
        <button
          type="button"
          style={styles.emailBtn}
          onClick={e => {
            e.stopPropagation()
            onEmailClick(professor)
          }}
        >
          Generate Email ✉️
        </button>
        <button
          type="button"
          style={styles.saveBtn}
          onClick={e => {
            e.stopPropagation()
            onSaveClick(professor)
          }}
        >
          {saved ? '★ Saved' : '☆ Save'}
        </button>
      </div>

      {papersOpen && (
        <div
          style={styles.modalBackdrop}
          onClick={e => {
            e.stopPropagation()
            setPapersOpen(false)
          }}
        >
          <div style={styles.modal} onClick={e => e.stopPropagation()}>
            <button
              type="button"
              style={styles.modalClose}
              onClick={e => {
                e.stopPropagation()
                setPapersOpen(false)
              }}
            >
              ×
            </button>
            <div style={styles.modalTitle}>
              Recent papers by {professor.name}
            </div>
            <div style={styles.papers}>
              {professor.papers.map((paper, i) => (
                <div key={i} style={styles.paper}>
                  <div style={styles.paperTitle}>
                    <a
                      href={paper.url || `https://scholar.google.com/scholar?q=${encodeURIComponent(paper.title)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={styles.paperTitleLink}
                    >
                      {paper.title}
                    </a>
                  </div>
                  <span style={styles.paperYear}>
                    Published: {paper.year && paper.year.trim() ? paper.year : 'Unknown'}
                  </span>
                  {paper.one_line_summary && (
                    <div style={styles.paperSnippet}>{paper.one_line_summary}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function typeStyle(type: string): React.CSSProperties {
  const isPhD = type?.toLowerCase().includes('phd') || type?.toLowerCase().includes('student')
  return {
    display: 'inline-block',
    padding: '3px 9px',
    borderRadius: '99px',
    fontSize: '11px',
    fontWeight: 600,
    letterSpacing: '0',
    background: isPhD ? '#d9e7f2' : '#dae7d8',
    color: isPhD ? '#4f6776' : '#5d715d',
  }
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    background: '#fff',
    border: '2px solid #cfd8d2',
    borderRadius: '24px',
    overflow: 'visible',
    display: 'flex',
    flexDirection: 'column',
    transition: 'box-shadow 0.2s',
    boxShadow: '0 2px 8px rgba(15, 23, 42, 0.08)',
  },
  cardClickable: {
    cursor: 'pointer',
  },
  cardHover: {
    transform: 'translateY(-3px)',
    boxShadow: '0 14px 28px rgba(30, 41, 59, 0.2)',
  },
  top: {
    padding: '20px 22px 8px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  nameRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '12px',
  },
  name: {
    fontSize: '30px',
    fontWeight: 800,
    color: '#4b5563',
    lineHeight: 1.3,
  },
  nameLink: {
    color: '#4b5563',
    textDecoration: 'none',
    borderBottom: '1px solid #dbe3df',
    transition: 'border-color 0.15s, opacity 0.15s',
  },
  titleWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  subline: {
    fontSize: '13px',
    color: '#8b99a2',
    fontWeight: 600,
  },
  meta: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    alignItems: 'center',
    gap: '6px',
    marginTop: '3px',
  },
  websiteChip: {
    fontSize: '11px',
    color: '#64748b',
    textDecoration: 'none',
    background: '#f1f5f9',
    padding: '3px 8px',
    borderRadius: '99px',
    fontWeight: 600,
  },
  matchPill: {
    flexShrink: 0,
    padding: '7px 12px',
    borderRadius: '999px',
    textAlign: 'center',
    fontSize: '14px',
    fontWeight: 600,
  },
  body: {
    padding: '4px 22px 10px',
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  summary: {
    fontSize: '15px',
    color: '#4b5563',
    lineHeight: 1.55,
    margin: 0,
  },
  hint: {
    fontSize: '11px',
    color: '#93a2aa',
    fontWeight: 500,
  },
  papers: {
    marginTop: '10px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  paper: {
    padding: '10px 12px',
    background: '#ffffff',
    borderRadius: '10px',
    border: '1px solid #d8e0da',
  },
  paperTitle: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#1a1a2e',
    marginBottom: '2px',
  },
  paperTitleLink: {
    color: '#5f7380',
    textDecoration: 'none',
    borderBottom: '1px solid #c8d4ce',
  },
  paperYear: {
    fontSize: '11px',
    background: '#e6eeea',
    color: '#5f6d77',
    padding: '1px 6px',
    borderRadius: '99px',
    fontWeight: 600,
  },
  paperSnippet: {
    fontSize: '12px',
    color: '#6f7d86',
    marginTop: '4px',
    lineHeight: 1.5,
    
  },
  footer: {
    padding: '0 22px 18px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  emailBtn: {
    padding: '10px 18px',
    background: '#6f8fa3',
    border: 'none',
    borderRadius: '999px',
    color: '#fff',
    fontSize: '15px',
    fontWeight: 600,
    transition: 'opacity 0.15s',
  },
  saveBtn: {
    padding: '10px 18px',
    borderRadius: '999px',
    border: '1.5px solid #c8d4ce',
    background: '#fff',
    fontSize: '15px',
    color: '#5f6d77',
    cursor: 'pointer',
    fontWeight: 600,
  },
  modalBackdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(79, 103, 118, 0.35)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '16px',
    zIndex: 1000,
  },
  modal: {
    width: 'min(720px, 95vw)',
    maxHeight: '80vh',
    overflowY: 'auto',
    background: '#fbf8f0',
    borderRadius: '14px',
    padding: '18px 18px 16px',
    boxShadow: '0 18px 45px rgba(60, 72, 80, 0.2)',
    position: 'relative',
  },
  modalTitle: {
    fontSize: '16px',
    fontWeight: 700,
    color: '#4f6776',
    marginBottom: '12px',
    paddingRight: '28px',
  },
  modalClose: {
    position: 'absolute',
    top: '8px',
    right: '10px',
    border: 'none',
    background: 'transparent',
    fontSize: '26px',
    lineHeight: 1,
    color: '#7b8b94',
    cursor: 'pointer',
  },
}
