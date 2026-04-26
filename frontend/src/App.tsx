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
          <div style={styles.logo}>
            <img src={LOGO_SRC} alt="ScholarSchema logo" style={styles.logoImage} />
            <span style={styles.logoText}>ScholarSchema</span>
          </div>
          <div style={styles.tagline}>Find researchers who match your interests — and reach out in seconds</div>
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
    background: '#f5f1e7',
  },
  header: {
    background: 'transparent',
    padding: '42px 24px 18px',
  },
  headerInner: {
    maxWidth: '960px',
    margin: '0 auto',
    animation: 'fadeDown 320ms ease-out',
  },
  scrollWrap: {
    position: 'relative',
    textAlign: 'center',
    padding: '28px 28px 26px',
    borderRadius: '22px',
    background: 'linear-gradient(180deg, #f7f1de 0%, #efe5cf 100%)',
    border: '1px solid #deceb2',
    boxShadow: '0 10px 24px rgba(107, 93, 70, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.55)',
  },
  scrollRollLeft: {
    position: 'absolute',
    top: '-14px',
    left: '22px',
    width: '54px',
    height: '26px',
    borderRadius: '999px',
    background: 'linear-gradient(180deg, #e8d8b8 0%, #d8c39a 100%)',
    border: '1px solid #ccb187',
    boxShadow: '0 3px 8px rgba(95, 75, 44, 0.2)',
  },
  scrollRollRight: {
    position: 'absolute',
    top: '-14px',
    right: '22px',
    width: '54px',
    height: '26px',
    borderRadius: '999px',
    background: 'linear-gradient(180deg, #e8d8b8 0%, #d8c39a 100%)',
    border: '1px solid #ccb187',
    boxShadow: '0 3px 8px rgba(95, 75, 44, 0.2)',
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    marginBottom: '10px',
  },
  logoImage: {
    width: '56px',
    height: '56px',
    borderRadius: '12px',
    objectFit: 'cover',
  },
  logoText: {
    fontSize: 'clamp(2.1rem, 6vw, 3.1rem)',
    fontWeight: 800,
    color: '#3f5567',
    letterSpacing: '-0.02em',
  },
  tagline: {
    fontSize: 'clamp(1rem, 2.4vw, 1.2rem)',
    color: '#6f6552',
    maxWidth: '620px',
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
    background: '#f5f1e7',
    border: 'none',
    borderRadius: '20px',
    padding: 'clamp(22px, 3vw, 36px) clamp(10px, 2vw, 18px)',
    marginTop: '0',
    boxShadow: 'none',
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
    borderTopColor: '#6366f1',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  loadingMsg: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#374151',
  },
  loadingHint: {
    fontSize: '13px',
    color: '#9ca3af',
  },
  errorBox: {
    marginTop: '24px',
    padding: '16px',
    background: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: '10px',
    color: '#b91c1c',
    fontSize: '14px',
  },
  emptyState: {
    marginTop: '40px',
    textAlign: 'center',
    color: '#6b7280',
    fontSize: '15px',
    padding: '40px',
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
    fontWeight: 700,
    color: '#3f4d57',
  },
  cacheTag: {
    padding: '2px 8px',
    background: '#f0fdf4',
    color: '#16a34a',
    borderRadius: '99px',
    fontSize: '11px',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  savedToggle: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '13px',
    color: '#4b5563',
    marginLeft: '4px',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: '16px',
  },
}
