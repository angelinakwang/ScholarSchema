import { useEffect, useState } from 'react'
import type { Professor } from './types'
import { searchProfessors } from './api'
import SearchForm from './components/SearchForm'
import ProfessorCard from './components/ProfessorCard'
import EmailModal from './components/EmailModal'

const SAVED_PROFESSOR_KEY = 'saved_professors_v1'
const SEARCH_SESSION_KEY = 'search_session_v1'
const LOGO_SRC = '/logo.png'
function professorKey(prof: Professor): string {
  return `${prof.university}::${prof.name}`.toLowerCase()
}

export default function App() {
  const [results, setResults] = useState<Professor[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [fromCache, setFromCache] = useState(false)
  const [searched, setSearched] = useState(false)
  const [showSavedOnly, setShowSavedOnly] = useState(false)
  const [savedKeys, setSavedKeys] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(SAVED_PROFESSOR_KEY)
      const parsed = raw ? (JSON.parse(raw) as string[]) : []
      return new Set(parsed)
    } catch {
      return new Set()
    }
  })

  const [emailTarget, setEmailTarget] = useState<Professor | null>(null)
  const [resumeText, setResumeText] = useState('')
  const [resumeFileName, setResumeFileName] = useState('')
  const [paperSelections, setPaperSelections] = useState<Record<string, string[]>>({})

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(SEARCH_SESSION_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as {
        results?: Professor[]
        fromCache?: boolean
        searched?: boolean
        showSavedOnly?: boolean
        resumeText?: string
        resumeFileName?: string
        paperSelections?: Record<string, string[]>
      }
      setResults(parsed.results ?? [])
      setFromCache(Boolean(parsed.fromCache))
      setSearched(Boolean(parsed.searched))
      setShowSavedOnly(Boolean(parsed.showSavedOnly))
      setResumeText(parsed.resumeText ?? '')
      setResumeFileName(parsed.resumeFileName ?? '')
      setPaperSelections(parsed.paperSelections ?? {})
    } catch {
      sessionStorage.removeItem(SEARCH_SESSION_KEY)
    }
  }, [])

  useEffect(() => {
    const payload = {
      results,
      fromCache,
      searched,
      showSavedOnly,
      resumeText,
      resumeFileName,
      paperSelections,
    }
    sessionStorage.setItem(SEARCH_SESSION_KEY, JSON.stringify(payload))
  }, [results, fromCache, searched, showSavedOnly, resumeText, resumeFileName, paperSelections])

  const toggleSaved = (prof: Professor) => {
    const key = professorKey(prof)
    setSavedKeys(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      localStorage.setItem(SAVED_PROFESSOR_KEY, JSON.stringify([...next]))
      return next
    })
  }

  const visibleResults = showSavedOnly
    ? results.filter(prof => savedKeys.has(professorKey(prof)))
    : results

  const selectedPapersFor = (prof: Professor): string[] => {
    const key = professorKey(prof)
    return paperSelections[key] ?? []
  }

  const setSelectedPapersFor = (prof: Professor, titles: string[]) => {
    const key = professorKey(prof)
    setPaperSelections(prev => ({ ...prev, [key]: titles }))
  }

  const handleOpenEmail = (prof: Professor) => {
    const key = professorKey(prof)
    if (!paperSelections[key]) {
      setPaperSelections(prev => ({ ...prev, [key]: [] }))
    }
    setEmailTarget(prof)
  }

  const handleSearch = async (university: string, interests: string, resume: File | null) => {
    setLoading(true)
    setError('')
    setResults([])
    setSearched(true)
    setResumeFileName(resume?.name || '')
    setResumeText(
      resume
        ? `Resume was uploaded by the student (${resume.name}). Mention that the resume is attached.`
        : ''
    )

    try {
      const data = await searchProfessors(university, interests, resume)
      const sorted = [...data.results].sort((a, b) => b.match_score - a.match_score)
      setResults(sorted)
      setFromCache(data.from_cache)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={styles.page}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes cardPopOut {
          from {
            opacity: 0;
            transform: translateY(18px) scale(0.92);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        @keyframes fadeDown {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        a:hover { opacity: 0.8; }
        button:hover:not(:disabled) {
          opacity: 0.94;
          transform: translateY(-1px);
          box-shadow: 0 6px 14px rgba(79, 103, 118, 0.18);
        }
        button:disabled { opacity: 0.6; cursor: not-allowed; }
        button {
          appearance: none;
          -webkit-appearance: none;
          -webkit-tap-highlight-color: transparent;
        }
        button:focus,
        button:focus-visible,
        button:active {
          outline: none !important;
          box-shadow: none !important;
        }
      `}</style>

      <header style={styles.header}>
        <div style={styles.headerInner}>
          <div style={styles.heroShell}>
            <div style={styles.heroGlowA} />
            <div style={styles.heroGlowB} />
            <div style={styles.heroSparkleOne}>+</div>
            <div style={styles.heroSparkleTwo}>+</div>
            <div style={styles.logo}>
              <img src={LOGO_SRC} alt="ScholarSchema logo" style={styles.logoImage} />
              <span style={styles.logoText}>ScholarSchema</span>
            </div>
            <div style={styles.tagline}>Find researchers who match your interests and turn that shortlist into polished outreach in one pass.</div>
          </div>
        </div>
      </header>

      <main style={styles.main}>
        <div style={styles.searchCard}>
          <SearchForm onSearch={handleSearch} loading={loading} />
        </div>

        {loading && (
          <div style={styles.loadingState}>
            <div style={styles.bigSpinner} />
            <div style={styles.loadingMsg}>Searching and scoring researchers…</div>
            <div style={styles.loadingHint}>This can take 30–60 seconds on the first search</div>
          </div>
        )}

        {error && (
          <div style={styles.errorBox}>
            <strong>Error:</strong> {error}
          </div>
        )}

        {!loading && searched && results.length === 0 && !error && (
          <div style={styles.emptyState}>
            No researchers found. Try different keywords or a different university.
          </div>
        )}

        {!loading && searched && showSavedOnly && results.length > 0 && visibleResults.length === 0 && !error && (
          <div style={styles.emptyState}>
            No saved researchers in these results yet.
          </div>
        )}

        {results.length > 0 && (
          <section style={styles.results}>
            <div style={styles.resultsHeader}>
              <div style={styles.resultsTitle}>
                {visibleResults.length} researcher{visibleResults.length !== 1 ? 's' : ''} found
              </div>
              <label style={styles.savedToggle}>
                <input
                  type="checkbox"
                  checked={showSavedOnly}
                  onChange={e => setShowSavedOnly(e.target.checked)}
                />
                Saved only
              </label>
              {fromCache && <span style={styles.cacheTag}>cached</span>}
            </div>

            <div style={styles.grid}>
              {visibleResults.map((prof, i) => (
                <ProfessorCard
                  key={i}
                  professor={prof}
                  onEmailClick={handleOpenEmail}
                  saved={savedKeys.has(professorKey(prof))}
                  onSaveClick={toggleSaved}
                  selectedPaperTitles={selectedPapersFor(prof)}
                  onSelectedPaperTitlesChange={titles => setSelectedPapersFor(prof, titles)}
                />
              ))}
            </div>
          </section>
        )}
      </main>

      {emailTarget && (
        <EmailModal
          professor={emailTarget}
          resumeText={resumeText}
          resumeFileName={resumeFileName}
          selectedPaperTitles={selectedPapersFor(emailTarget)}
          onSelectedPaperTitlesChange={titles => setSelectedPapersFor(emailTarget, titles)}
          onClose={() => setEmailTarget(null)}
        />
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: 'transparent',
  },
  header: {
    background: 'transparent',
    padding: '34px 24px 18px',
  },
  headerInner: {
    maxWidth: 'calc(1160px - clamp(32px, 8vw, 72px))',
    margin: '0 auto',
    animation: 'fadeDown 320ms ease-out',
  },
  heroShell: {
    position: 'relative',
    textAlign: 'center',
    padding: '28px clamp(20px, 4vw, 38px) 30px',
    borderRadius: '28px',
    background: 'linear-gradient(135deg, rgba(255,255,255,0.85) 0%, rgba(254,243,231,0.92) 45%, rgba(235,248,255,0.92) 100%)',
    border: '1px solid rgba(106, 119, 158, 0.14)',
    boxShadow: '0 24px 60px rgba(126, 104, 67, 0.14)',
    overflow: 'hidden',
  },
  heroGlowA: {
    position: 'absolute',
    width: '180px',
    height: '180px',
    borderRadius: '999px',
    background: 'radial-gradient(circle, rgba(255, 140, 110, 0.24) 0%, rgba(255, 140, 110, 0) 72%)',
    top: '-72px',
    left: '-36px',
    pointerEvents: 'none',
  },
  heroGlowB: {
    position: 'absolute',
    width: '210px',
    height: '210px',
    borderRadius: '999px',
    background: 'radial-gradient(circle, rgba(84, 125, 240, 0.2) 0%, rgba(84, 125, 240, 0) 74%)',
    right: '-64px',
    bottom: '-104px',
    pointerEvents: 'none',
  },
  heroSparkleOne: {
    position: 'absolute',
    top: '18px',
    right: '24px',
    color: '#4e72d6',
    fontSize: '24px',
    fontWeight: 700,
    opacity: 0.7,
    lineHeight: 1,
    transform: 'rotate(18deg)',
    pointerEvents: 'none',
  },
  heroSparkleTwo: {
    position: 'absolute',
    bottom: '22px',
    left: '26px',
    color: '#df7751',
    fontSize: '20px',
    fontWeight: 700,
    opacity: 0.6,
    lineHeight: 1,
    transform: 'rotate(-10deg)',
    pointerEvents: 'none',
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    marginBottom: '10px',
  },
  logoImage: {
    width: '64px',
    height: '64px',
    borderRadius: '18px',
    objectFit: 'cover',
    boxShadow: '0 10px 24px rgba(90, 102, 142, 0.2)',
  },
  logoText: {
    fontSize: 'clamp(2.1rem, 6vw, 3.1rem)',
    fontWeight: 900,
    color: '#263454',
    letterSpacing: '0',
  },
  tagline: {
    fontSize: 'clamp(1rem, 2.4vw, 1.2rem)',
    color: '#5b6280',
    maxWidth: '700px',
    margin: '0 auto',
    lineHeight: 1.55,
    textAlign: 'center',
  },
  main: {
    maxWidth: 'min(1160px, 100%)',
    width: '100%',
    margin: '0 auto',
    padding: '0 clamp(16px, 4vw, 36px) 96px',
  },
  searchCard: {
    background: 'linear-gradient(180deg, rgba(255,255,255,0.88) 0%, rgba(255,245,237,0.96) 100%)',
    border: '1px solid rgba(96, 109, 148, 0.12)',
    borderRadius: '28px',
    padding: 'clamp(22px, 3vw, 36px) clamp(16px, 2vw, 24px)',
    marginTop: '0',
    boxShadow: '0 18px 40px rgba(94, 74, 46, 0.1)',
    animation: 'fadeDown 420ms ease-out',
  },
  loadingState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '60px 0',
    gap: '12px',
  },
  bigSpinner: {
    width: '40px',
    height: '40px',
    border: '3px solid #e5e7eb',
    borderTopColor: '#547df0',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  loadingMsg: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#33415f',
  },
  loadingHint: {
    fontSize: '13px',
    color: '#7b88a3',
  },
  errorBox: {
    marginTop: '24px',
    padding: '16px',
    background: '#fff3f0',
    border: '1px solid #ffcec1',
    borderRadius: '16px',
    color: '#b35336',
    fontSize: '14px',
  },
  emptyState: {
    marginTop: '40px',
    textAlign: 'center',
    color: '#6d7591',
    fontSize: '15px',
    padding: '34px',
    background: 'rgba(255,255,255,0.58)',
    borderRadius: '20px',
    border: '1px dashed rgba(98, 113, 148, 0.18)',
  },
  results: {
    marginTop: '32px',
  },
  resultsHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '20px',
    flexWrap: 'wrap',
  },
  resultsTitle: {
    fontSize: '18px',
    fontWeight: 800,
    color: '#31415d',
  },
  cacheTag: {
    padding: '4px 10px',
    background: '#edf4ff',
    color: '#416bcb',
    borderRadius: '99px',
    fontSize: '11px',
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  savedToggle: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '13px',
    color: '#55627e',
    marginLeft: '4px',
    background: 'rgba(255,255,255,0.72)',
    padding: '8px 12px',
    borderRadius: '999px',
    border: '1px solid rgba(96, 109, 148, 0.12)',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: '16px',
  },
}
