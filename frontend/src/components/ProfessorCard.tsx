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

  const nameUrl = professor.directory_url || professor.profile_url || professor.personal_website || professor.url

  return (
    <div style={styles.card}>
      <div style={styles.top}>
        <div style={styles.nameRow}>
          <div>
            <div style={styles.name}>
              {nameUrl ? (
                <a href={nameUrl} target="_blank" rel="noopener noreferrer" style={styles.nameLink}>
                  {professor.name}
                </a>
              ) : professor.name}
            </div>
            <div style={styles.meta}>
              <span style={typeStyle(professor.type)}>{professor.type}</span>
              <span style={styles.uni}>{professor.university}</span>
              {professor.email && (
                <a href={`mailto:${professor.email}`} style={styles.emailChip}>
                  {professor.email}
                </a>
              )}
            </div>
          </div>
          <div style={{ ...styles.scoreBadge, background: scoreBg(professor.match_score), color: scoreColor(professor.match_score) }}>
            <div style={styles.scoreNum}>{professor.match_score}</div>
            <div style={styles.scoreLabel}>match</div>
          </div>
        </div>

        {professor.match_reason && (
          <div style={styles.matchReason}>
            <span style={styles.matchIcon}>✦</span> {professor.match_reason}
          </div>
        )}
      </div>

      <div style={styles.body}>
        {professor.research_summary && (
          <p style={styles.summary}>{professor.research_summary}</p>
        )}

        {professor.research_areas?.length > 0 && (
          <div style={styles.tagRow}>
            {professor.research_areas.map((area, i) => (
              <span key={i} style={styles.tag}>{area}</span>
            ))}
          </div>
        )}

        {professor.papers?.length > 0 && (
          <div>
            <button type="button" style={styles.expandBtn} onClick={() => setPapersOpen(true)}>
              Show recent papers
            </button>
          </div>
        )}
      </div>

      <div style={styles.footer}>
        <button style={styles.emailBtn} onClick={() => onEmailClick(professor)}>
          ✉ Draft Cold Email
        </button>
        <button type="button" style={styles.saveBtn} onClick={() => onSaveClick(professor)}>
          {saved ? 'Saved' : 'Save'}
        </button>
      </div>

      {papersOpen && (
        <div style={styles.modalBackdrop} onClick={() => setPapersOpen(false)}>
          <div style={styles.modal} onClick={e => e.stopPropagation()}>
            <button type="button" style={styles.modalClose} onClick={() => setPapersOpen(false)}>
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
    padding: '2px 8px',
    borderRadius: '99px',
    fontSize: '11px',
    fontWeight: 600,
    letterSpacing: '0.03em',
    textTransform: 'uppercase' as const,
    background: isPhD ? '#ede9fe' : '#dbeafe',
    color: isPhD ? '#7c3aed' : '#1d4ed8',
  }
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    background: '#fff',
    border: '1.5px solid #e5e7eb',
    borderRadius: '16px',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    transition: 'box-shadow 0.2s',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
  },
  top: {
    padding: '20px 20px 0',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  nameRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '12px',
  },
  name: {
    fontSize: '18px',
    fontWeight: 700,
    color: '#1a1a2e',
    lineHeight: 1.3,
  },
  nameLink: {
    color: '#1a1a2e',
    textDecoration: 'none',
    borderBottom: '1.5px solid #e5e7eb',
    transition: 'border-color 0.15s',
  },
  meta: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    alignItems: 'center',
    gap: '6px',
    marginTop: '6px',
  },
  uni: {
    fontSize: '12px',
    color: '#6b7280',
  },
  emailChip: {
    fontSize: '11px',
    color: '#6366f1',
    textDecoration: 'none',
    background: '#eef2ff',
    padding: '2px 7px',
    borderRadius: '99px',
  },
  scoreBadge: {
    flexShrink: 0,
    minWidth: '56px',
    padding: '8px 10px',
    borderRadius: '12px',
    textAlign: 'center',
  },
  scoreNum: {
    fontSize: '22px',
    fontWeight: 800,
    lineHeight: 1,
  },
  scoreLabel: {
    fontSize: '10px',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    marginTop: '2px',
    opacity: 0.7,
  },
  matchReason: {
    fontSize: '13px',
    color: '#4b5563',
    background: '#f9fafb',
    padding: '8px 12px',
    borderRadius: '8px',
    lineHeight: 1.5,
  },
  matchIcon: {
    color: '#8b5cf6',
    fontSize: '11px',
  },
  body: {
    padding: '16px 20px',
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  summary: {
    fontSize: '14px',
    color: '#374151',
    lineHeight: 1.6,
  },
  tagRow: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '6px',
  },
  tag: {
    padding: '3px 10px',
    background: '#f3f4f6',
    borderRadius: '99px',
    fontSize: '12px',
    color: '#374151',
    fontWeight: 500,
  },
  expandBtn: {
    background: 'none',
    border: 'none',
    color: '#6366f1',
    fontSize: '13px',
    fontWeight: 500,
    padding: '0',
    cursor: 'pointer',
  },
  papers: {
    marginTop: '10px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  paper: {
    padding: '10px 12px',
    background: '#f9fafb',
    borderRadius: '8px',
    borderLeft: '3px solid #6366f1',
  },
  paperTitle: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#1a1a2e',
    marginBottom: '2px',
  },
  paperTitleLink: {
    color: '#4338ca',
    textDecoration: 'none',
    borderBottom: '1px solid #c7d2fe',
  },
  paperYear: {
    fontSize: '11px',
    background: '#e0e7ff',
    color: '#4338ca',
    padding: '1px 6px',
    borderRadius: '99px',
    fontWeight: 600,
  },
  paperSnippet: {
    fontSize: '12px',
    color: '#6b7280',
    marginTop: '4px',
    lineHeight: 1.5,
  },
  footer: {
    padding: '12px 20px 16px',
    borderTop: '1px solid #f3f4f6',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  emailBtn: {
    padding: '8px 16px',
    background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
    border: 'none',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '13px',
    fontWeight: 600,
    transition: 'opacity 0.15s',
  },
  saveBtn: {
    padding: '8px 14px',
    borderRadius: '8px',
    border: '1px solid #d1d5db',
    background: '#fff',
    fontSize: '13px',
    color: '#6b7280',
    cursor: 'pointer',
    fontWeight: 500,
  },
  modalBackdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(17,24,39,0.45)',
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
    background: '#fff',
    borderRadius: '14px',
    padding: '18px 18px 16px',
    boxShadow: '0 20px 50px rgba(0,0,0,0.25)',
    position: 'relative',
  },
  modalTitle: {
    fontSize: '16px',
    fontWeight: 700,
    color: '#111827',
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
    color: '#6b7280',
    cursor: 'pointer',
  },
}
