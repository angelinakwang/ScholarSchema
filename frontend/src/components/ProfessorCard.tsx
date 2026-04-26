import { useState } from 'react'
import type { Professor } from '../types'

interface Props {
  professor: Professor
  onEmailClick: (professor: Professor) => void
  saved: boolean
  onSaveClick: (professor: Professor) => void
  selectedPaperTitles: string[]
  onSelectedPaperTitlesChange: (titles: string[]) => void
}

function scoreColor(score: number): string {
  if (score >= 80) return '#365fc4'
  if (score >= 60) return '#c85f39'
  return '#5d6986'
}

function scoreBg(score: number): string {
  if (score >= 80) return '#edf3ff'
  if (score >= 60) return '#fff1ea'
  return '#eef3ff'
}

export default function ProfessorCard({
  professor,
  onEmailClick,
  saved,
  onSaveClick,
  selectedPaperTitles,
  onSelectedPaperTitlesChange,
}: Props) {
  const [papersOpen, setPapersOpen] = useState(false)
  const [hovered, setHovered] = useState(false)

  const nameUrl = professor.directory_url || professor.profile_url || professor.personal_website || professor.url
  const canOpenPapers = (professor.papers?.length ?? 0) > 0

  const togglePaper = (title: string) => {
    const isSelected = selectedPaperTitles.includes(title)
    const next = isSelected ? [] : [title]
    onSelectedPaperTitlesChange(next)
  }

  return (
    <div
      style={{
        ...styles.card,
        ...(canOpenPapers && !papersOpen ? styles.cardClickable : {}),
        ...(canOpenPapers && (hovered || papersOpen) ? styles.cardHover : {}),
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
            {professor.title && <div style={styles.subline}>{professor.title}</div>}
            <div style={styles.meta}>
              <span style={styles.schoolTag}>{professor.university}</span>
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
                  <label style={styles.paperCheckRow}>
                    <input
                      type="checkbox"
                      checked={selectedPaperTitles.includes(paper.title)}
                      onChange={() => togglePaper(paper.title)}
                    />
                    <span style={styles.paperCheckLabel}>Mention in email</span>
                  </label>
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
  const lower = type?.toLowerCase() || ''

  let palette: React.CSSProperties
  if (lower.includes('phd') || lower.includes('student')) {
    palette = {
      background: 'linear-gradient(135deg, #f0faf4 0%, #e3f4ea 100%)',
      color: '#4f8168',
      border: '1px solid rgba(79, 129, 104, 0.14)',
    }
  } else if (lower.includes('postdoc')) {
    palette = {
      background: 'linear-gradient(135deg, #f7e8ff 0%, #efd9ff 100%)',
      color: '#8a49b7',
      border: '1px solid rgba(138, 73, 183, 0.14)',
    }
  } else if (lower.includes('faculty') || lower.includes('professor')) {
    palette = {
      background: 'linear-gradient(135deg, #fff0df 0%, #ffe4c8 100%)',
      color: '#cc6b2c',
      border: '1px solid rgba(204, 107, 44, 0.14)',
    }
  } else {
    palette = {
      background: 'linear-gradient(135deg, #eef2ff 0%, #e5ebff 100%)',
      color: '#5b638c',
      border: '1px solid rgba(91, 99, 140, 0.14)',
    }
  }

  return {
    display: 'inline-block',
    padding: '3px 9px',
    borderRadius: '99px',
    fontSize: '11px',
    fontWeight: 600,
    letterSpacing: '0',
    whiteSpace: 'nowrap',
    ...palette,
  }
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    background: 'linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(255,249,243,0.98) 100%)',
    border: '1px solid rgba(91, 105, 143, 0.12)',
    borderRadius: '22px',
    overflow: 'visible',
    display: 'flex',
    flexDirection: 'column',
    transition: 'transform 0.2s, box-shadow 0.2s',
    boxShadow: '0 16px 32px rgba(90, 73, 44, 0.1)',
  },
  cardClickable: {
    cursor: 'pointer',
  },
  cardHover: {
    transform: 'translateY(-3px)',
    boxShadow: '0 22px 40px rgba(84, 92, 137, 0.18)',
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
    fontSize: '28px',
    fontWeight: 900,
    color: '#2d3b57',
    lineHeight: 1.3,
  },
  nameLink: {
    color: '#2d3b57',
    textDecoration: 'none',
    borderBottom: '1px solid rgba(91, 105, 143, 0.2)',
    transition: 'border-color 0.15s, opacity 0.15s',
  },
  titleWrap: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  subline: {
    fontSize: '13px',
    color: '#7e88a3',
    fontWeight: 600,
  },
  schoolTag: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0 10px',
    minHeight: '26px',
    borderRadius: '99px',
    fontSize: '11px',
    fontWeight: 600,
    letterSpacing: '0',
    background: 'linear-gradient(135deg, #edf4ff 0%, #dce9ff 100%)',
    color: '#3f67c8',
    border: '1px solid rgba(63, 103, 200, 0.14)',
  },
  meta: {
    display: 'flex',
    flexWrap: 'nowrap',
    alignItems: 'center',
    gap: '6px',
    marginTop: '3px',
  },
  websiteChip: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '11px',
    color: '#d85b46',
    textDecoration: 'none',
    background: 'linear-gradient(135deg, #fff1ec 0%, #ffe0d5 100%)',
    padding: '0 9px',
    minHeight: '26px',
    borderRadius: '99px',
    fontWeight: 600,
    whiteSpace: 'nowrap',
    border: '1px solid rgba(216, 91, 70, 0.14)',
  },
  matchPill: {
    marginLeft: 'auto',
    flexShrink: 0,
    maxWidth: '42%',
    padding: '7px 12px',
    borderRadius: '999px',
    textAlign: 'center',
    fontSize: '14px',
    fontWeight: 800,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    border: '1px solid rgba(255,255,255,0.75)',
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
    color: '#536079',
    lineHeight: 1.55,
    margin: 0,
  },
  hint: {
    fontSize: '11px',
    color: '#d4643f',
    fontWeight: 700,
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
    borderRadius: '14px',
    border: '1px solid rgba(91, 105, 143, 0.12)',
  },
  paperCheckRow: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    marginBottom: '6px',
    fontSize: '11px',
    color: '#647685',
  },
  paperCheckLabel: {
    fontWeight: 600,
  },
  paperTitle: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#1a1a2e',
    marginBottom: '2px',
  },
  paperTitleLink: {
    color: '#425f7d',
    textDecoration: 'none',
    borderBottom: '1px solid rgba(91, 105, 143, 0.18)',
  },
  paperYear: {
    fontSize: '11px',
    background: '#edf4ff',
    color: '#4f66a0',
    padding: '1px 6px',
    borderRadius: '99px',
    fontWeight: 600,
  },
  paperSnippet: {
    fontSize: '12px',
    color: '#6d7591',
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
    background: 'linear-gradient(135deg, #ff8964 0%, #ff6f61 100%)',
    border: 'none',
    borderRadius: '999px',
    color: '#fff',
    fontSize: '15px',
    fontWeight: 800,
    transition: 'opacity 0.15s',
    boxShadow: '0 12px 24px rgba(255, 111, 97, 0.2)',
  },
  saveBtn: {
    padding: '10px 18px',
    borderRadius: '999px',
    border: '1px solid rgba(91, 105, 143, 0.14)',
    background: '#fffdf9',
    fontSize: '15px',
    color: '#4b5d79',
    cursor: 'pointer',
    fontWeight: 700,
  },
  modalBackdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(46, 58, 90, 0.48)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
    zIndex: 1000,
    animation: 'fadeIn 180ms ease-out',
  },
  modal: {
    width: 'min(1180px, calc(100vw - 40px))',
    height: 'min(90vh, 960px)',
    maxHeight: '90vh',
    overflowY: 'auto',
    background: 'linear-gradient(180deg, #fffaf4 0%, #fff 100%)',
    borderRadius: '26px',
    padding: '28px 28px 24px',
    boxShadow: '0 32px 72px rgba(60, 72, 80, 0.28)',
    position: 'relative',
    transformOrigin: 'center center',
    animation: 'cardPopOut 220ms cubic-bezier(0.2, 0.8, 0.2, 1)',
  },
  modalTitle: {
    fontSize: '16px',
    fontWeight: 800,
    color: '#35506c',
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
    color: '#7b88a3',
    cursor: 'pointer',
  },
}
