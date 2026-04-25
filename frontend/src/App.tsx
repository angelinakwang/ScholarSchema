import { useState } from 'react'
import type { Professor } from './types'
import { searchProfessors } from './api'
import SearchForm from './components/SearchForm'
import ProfessorCard from './components/ProfessorCard'
import EmailModal from './components/EmailModal'

export default function App() {
  const [results, setResults] = useState<Professor[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [fromCache, setFromCache] = useState(false)
  const [searched, setSearched] = useState(false)

  const [emailTarget, setEmailTarget] = useState<Professor | null>(null)
  const [resumeText] = useState('')

  const handleSearch = async (university: string, interests: string, resume: File | null) => {
    setLoading(true)
    setError('')
    setResults([])
    setSearched(true)

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
        a:hover { opacity: 0.8; }
        button:hover:not(:disabled) { opacity: 0.88; }
        button:disabled { opacity: 0.6; cursor: not-allowed; }
      `}</style>

      <header style={styles.header}>
        <div style={styles.headerInner}>
          <div style={styles.logo}>
            <span style={styles.logoIcon}>⬡</span>
            <span style={styles.logoText}>ResearchMatch</span>
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

        {results.length > 0 && (
          <section style={styles.results}>
            <div style={styles.resultsHeader}>
              <div style={styles.resultsTitle}>
                {results.length} researcher{results.length !== 1 ? 's' : ''} found
              </div>
              {fromCache && <span style={styles.cacheTag}>cached</span>}
            </div>

            <div style={styles.grid}>
              {results.map((prof, i) => (
                <ProfessorCard
                  key={i}
                  professor={prof}
                  onEmailClick={setEmailTarget}
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
          onClose={() => setEmailTarget(null)}
        />
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: '#f8f9fc',
  },
  header: {
    background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 60%, #4c1d95 100%)',
    padding: '40px 24px 48px',
  },
  headerInner: {
    maxWidth: '720px',
    margin: '0 auto',
    textAlign: 'center',
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    marginBottom: '12px',
  },
  logoIcon: {
    fontSize: '28px',
    color: '#a5b4fc',
  },
  logoText: {
    fontSize: '28px',
    fontWeight: 800,
    color: '#fff',
    letterSpacing: '-0.02em',
  },
  tagline: {
    fontSize: '16px',
    color: '#c7d2fe',
    maxWidth: '480px',
    margin: '0 auto',
    lineHeight: 1.5,
  },
  main: {
    maxWidth: '900px',
    margin: '0 auto',
    padding: '0 24px 80px',
  },
  searchCard: {
    background: '#fff',
    border: '1.5px solid #e5e7eb',
    borderRadius: '16px',
    padding: '28px',
    marginTop: '-24px',
    boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
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
  },
  resultsTitle: {
    fontSize: '18px',
    fontWeight: 700,
    color: '#1a1a2e',
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
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))',
    gap: '20px',
  },
}
