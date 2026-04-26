import { useEffect, useRef, useState } from 'react'

interface Props {
  onSearch: (university: string, interests: string, resume: File | null) => void
  loading: boolean
}

const FORM_SESSION_KEY = 'search_form_session_v1'

/** Values must match backend `_UNIVERSITY_DB_KEYS` in agents/discover.py (case-insensitive). */
const UNIVERSITIES: { value: string; label: string; disabled?: boolean; comingSoon?: boolean }[] = [
  { value: '', label: 'Select a university…', disabled: true },
  { value: 'Stanford', label: 'Stanford' },
  { value: 'UC Berkeley', label: 'UC Berkeley' },
  { value: 'UCLA', label: 'UCLA' },
  { value: 'CMU', label: 'Carnegie Mellon (coming soon)', comingSoon: true },
  { value: 'Harvard', label: 'Harvard (coming soon)', comingSoon: true },
  { value: 'MIT', label: 'MIT (coming soon)', comingSoon: true },
  { value: 'Princeton', label: 'Princeton (coming soon)', comingSoon: true },
]

const TOPIC_CHIPS = [
  'machine learning',
  'computer vision',
  'NLP',
  'robotics',
  'systems',
  'theory',
  'HCI',
  'security',
  'graphics',
  'databases',
] as const

export default function SearchForm({ onSearch, loading }: Props) {
  const [university, setUniversity] = useState('')
  const [selectedTopics, setSelectedTopics] = useState<Set<string>>(new Set())
  const [hoveredTopic, setHoveredTopic] = useState<string | null>(null)
  const [interestsExtra, setInterestsExtra] = useState('')
  const [animatedPlaceholder, setAnimatedPlaceholder] = useState('')
  const [resume, setResume] = useState<File | null>(null)
  const [dbStatusMsg, setDbStatusMsg] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(FORM_SESSION_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as {
        university?: string
        selectedTopics?: string[]
        interestsExtra?: string
      }
      setUniversity(parsed.university ?? '')
      setSelectedTopics(new Set(parsed.selectedTopics ?? []))
      setInterestsExtra(parsed.interestsExtra ?? '')
    } catch {
      sessionStorage.removeItem(FORM_SESSION_KEY)
    }
  }, [])

  useEffect(() => {
    const payload = {
      university,
      selectedTopics: [...selectedTopics],
      interestsExtra,
    }
    sessionStorage.setItem(FORM_SESSION_KEY, JSON.stringify(payload))
  }, [university, selectedTopics, interestsExtra])

  useEffect(() => {
    const samples = [
      'reinforcement learning, fairness, embedded systems',
      'cancer genomics, bioinformatics, computational biology',
      'climate science, energy systems, public policy',
    ]
    let sampleIdx = 0
    let charIdx = 0
    let deleting = false

    const tick = () => {
      const current = samples[sampleIdx]
      if (!deleting) {
        charIdx = Math.min(current.length, charIdx + 1)
        setAnimatedPlaceholder(current.slice(0, charIdx))
        if (charIdx === current.length) deleting = true
      } else {
        charIdx = Math.max(0, charIdx - 1)
        setAnimatedPlaceholder(current.slice(0, charIdx))
        if (charIdx === 0) {
          deleting = false
          sampleIdx = (sampleIdx + 1) % samples.length
        }
      }
    }

    const timer = window.setInterval(tick, 70)
    return () => window.clearInterval(timer)
  }, [])

  const toggleTopic = (topic: string) => {
    setSelectedTopics(prev => {
      const next = new Set(prev)
      if (next.has(topic)) next.delete(topic)
      else next.add(topic)
      return next
    })
  }

  const buildInterests = () => {
    const fromChips = [...selectedTopics].join(' ')
    const extra = interestsExtra.trim()
    return [fromChips, extra].filter(Boolean).join(' ').trim()
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!university.trim()) return
    const selected = UNIVERSITIES.find(u => u.value === university.trim())
    if (selected?.comingSoon) {
      setDbStatusMsg(`The ${selected.value} database isn't up yet. Please use UC Berkeley for now.`)
      return
    }
    const interests = buildInterests()
    if (!interests && !resume) return
    setDbStatusMsg('')
    onSearch(university.trim(), interests, resume)
  }

  const handleFindAllResearchers = () => {
    if (!university.trim()) return
    const selected = UNIVERSITIES.find(u => u.value === university.trim())
    if (selected?.comingSoon) {
      setDbStatusMsg(`The ${selected.value} database isn't up yet. Please use UC Berkeley for now.`)
      return
    }
    setDbStatusMsg('')
    onSearch(university.trim(), '', resume)
  }

  const interestsReady = buildInterests().length > 0
  const canSubmit = Boolean(university.trim() && (interestsReady || resume))

  return (
    <form onSubmit={handleSubmit} style={styles.form}>
      <div style={styles.field}>
        <label style={styles.label} htmlFor="university-select">
          Select your university
        </label>
        <select
          id="university-select"
          style={styles.select}
          value={university}
          onChange={e => {
            setUniversity(e.target.value)
            setDbStatusMsg('')
          }}
          required
        >
          {UNIVERSITIES.map(opt => (
            <option key={opt.value || 'placeholder'} value={opt.value} disabled={opt.disabled}>
              {opt.label}
            </option>
          ))}
        </select>
        
        {dbStatusMsg && <p style={styles.validationHint}>{dbStatusMsg}</p>}
      </div>

      <div style={styles.field}>
        <span style={styles.label}>Research topics</span>
        <p style={styles.subLabel}>Pick one or more areas (optional to combine with text below).</p>
        <div style={styles.chipRow}>
          {TOPIC_CHIPS.map(topic => {
            const on = selectedTopics.has(topic)
            const hovered = hoveredTopic === topic
            return (
              <button
                key={topic}
                type="button"
                onMouseEnter={() => setHoveredTopic(topic)}
                onMouseLeave={() => setHoveredTopic(null)}
                onMouseDown={e => e.preventDefault()}
                onClick={e => {
                  toggleTopic(topic)
                  e.currentTarget.blur()
                }}
                style={{
                  ...styles.chip,
                  ...(on ? styles.chipOn : {}),
                  ...(!on && hovered ? styles.chipHover : {}),
                }}
              >
                {topic}
              </button>
            )
          })}
        </div>
      </div>

      <div style={styles.field}>
        <label style={styles.label} htmlFor="interests-extra">
          Additional keywords <span style={styles.optional}>(optional)</span>
        </label>
        <textarea
          id="interests-extra"
          style={{ ...styles.input, ...styles.textarea }}
          placeholder={`e.g. ${animatedPlaceholder}`}
          value={interestsExtra}
          onChange={e => setInterestsExtra(e.target.value)}
          rows={2}
        />
      </div>

      <div style={styles.field}>
        <label style={styles.label}>
          Resume <span style={styles.optional}>(optional — improves match scoring)</span>
        </label>
        <div style={styles.fileRow}>
          <button
            type="button"
            style={styles.fileBtn}
            onClick={() => fileRef.current?.click()}
          >
            {resume ? '📄 ' + resume.name : 'Upload PDF'}
          </button>
          {resume && (
            <button
              type="button"
              style={styles.clearBtn}
              onClick={() => {
                setResume(null)
                if (fileRef.current) fileRef.current.value = ''
              }}
            >
              ✕
            </button>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".pdf"
          style={{ display: 'none' }}
          onChange={e => setResume(e.target.files?.[0] ?? null)}
        />
      </div>

      <button type="submit" style={styles.submit} disabled={loading || !canSubmit}>
        {loading ? (
          <span style={styles.loadingRow}>
            <span style={styles.spinner} /> Finding matches…
          </span>
        ) : (
          'Find Researchers'
        )}
      </button>
      <button
        type="button"
        style={styles.allBtn}
        disabled={loading || !university.trim()}
        onClick={handleFindAllResearchers}
      >
        All researchers from this school
      </button>
      {!interestsReady && !resume && (
        <p style={styles.validationHint}>Choose at least one topic/add keywords, or upload a resume.</p>
      )}
    </form>
  )
}

const styles: Record<string, React.CSSProperties> = {
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  label: {
    fontSize: '14px',
    fontWeight: 800,
    color: '#40506c',
  },
  subLabel: {
    fontSize: '13px',
    color: '#6d7591',
    margin: 0,
    marginBottom: '4px',
  },
  hint: {
    fontSize: '12px',
    color: '#9ca3af',
    margin: 0,
    marginTop: '4px',
  },
  validationHint: {
    fontSize: '13px',
    color: '#b35336',
    margin: '2px 0 0 0',
  },
  optional: {
    fontWeight: 400,
    color: '#8995ad',
  },
  select: {
    padding: '14px 18px',
    border: '1px solid rgba(88, 103, 143, 0.18)',
    borderRadius: '999px',
    fontSize: '15px',
    color: '#41506c',
    background: 'rgba(255,255,255,0.88)',
    outline: 'none',
    cursor: 'pointer',
    width: '100%',
    maxWidth: '100%',
    appearance: 'none',
    WebkitAppearance: 'none',
    MozAppearance: 'none',
    backgroundImage: 'none',
  },
  chipRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
  },
  chip: {
    padding: '8px 14px',
    border: '1px solid rgba(100, 115, 155, 0.16)',
    borderColor: 'rgba(100, 115, 155, 0.16)',
    borderStyle: 'solid',
    borderRadius: '999px',
    background: 'rgba(255,255,255,0.76)',
    color: '#55627c',
    fontSize: '13px',
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'all 0.12s',
    outline: 'none',
    boxShadow: 'none',
    appearance: 'none',
    WebkitAppearance: 'none',
    WebkitTapHighlightColor: 'transparent',
  },
  chipOn: {
    border: '1px solid rgba(84, 125, 240, 0.2)',
    borderColor: 'rgba(84, 125, 240, 0.2)',
    background: 'linear-gradient(135deg, #f0f5ff 0%, #dfeaff 100%)',
    color: '#456ad1',
    boxShadow: '0 8px 18px rgba(84, 125, 240, 0.14)',
  },
  chipHover: {
    borderColor: 'rgba(91, 130, 197, 0.22)',
    background: '#f5fbff',
    color: '#45627d',
    transform: 'translateY(-1px)',
  },
  input: {
    padding: '14px 16px',
    border: '1px solid rgba(88, 103, 143, 0.18)',
    borderRadius: '18px',
    fontSize: '15px',
    color: '#41506c',
    background: 'rgba(255,255,255,0.88)',
    outline: 'none',
    transition: 'border-color 0.15s',
    width: '100%',
  },
  textarea: {
    resize: 'vertical',
    minHeight: '56px',
  },
  fileRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  fileBtn: {
    width: '100%',
    padding: '28px 18px',
    border: '2px dashed rgba(98, 118, 159, 0.26)',
    borderRadius: '22px',
    background: 'linear-gradient(135deg, rgba(255,255,255,0.94) 0%, rgba(239, 245, 255, 0.92) 100%)',
    color: '#51627e',
    fontSize: '14px',
    fontWeight: 700,
    transition: 'all 0.15s',
    textAlign: 'center',
  },
  clearBtn: {
    width: '28px',
    height: '28px',
    border: 'none',
    background: '#fff0eb',
    borderRadius: '50%',
    color: '#b35336',
    fontSize: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submit: {
    width: '100%',
    padding: '15px 24px',
    background: 'linear-gradient(135deg, #ff8964 0%, #ff6f61 100%)',
    border: 'none',
    borderRadius: '999px',
    color: '#fff',
    fontSize: '18px',
    fontWeight: 800,
    letterSpacing: '0.01em',
    transition: 'opacity 0.15s, transform 0.1s',
    alignSelf: 'stretch',
    boxShadow: '0 14px 28px rgba(255, 111, 97, 0.24)',
  },
  allBtn: {
    width: '100%',
    padding: '11px 18px',
    background: 'rgba(255,255,255,0.75)',
    border: '1px solid rgba(88, 103, 143, 0.16)',
    borderRadius: '999px',
    color: '#4a5c77',
    fontSize: '14px',
    fontWeight: 700,
    letterSpacing: '0.01em',
    transition: 'opacity 0.15s, transform 0.1s',
    alignSelf: 'stretch',
  },
  loadingRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  spinner: {
    width: '14px',
    height: '14px',
    border: '2px solid rgba(255,255,255,0.3)',
    borderTopColor: '#fff',
    borderRadius: '50%',
    animation: 'spin 0.7s linear infinite',
    display: 'inline-block',
  },
}
