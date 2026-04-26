import { useState, useRef } from 'react'

interface Props {
  onSearch: (university: string, interests: string, resume: File | null) => void
  loading: boolean
}

/** Values must match backend `_UNIVERSITY_DB_KEYS` in agents/discover.py (case-insensitive). */
const UNIVERSITIES: { value: string; label: string; disabled?: boolean; comingSoon?: boolean }[] = [
  { value: '', label: 'Select a university…', disabled: true },
  { value: 'UC Berkeley', label: 'UC Berkeley' },
  { value: 'Stanford', label: 'Stanford (coming soon)', comingSoon: true },
  { value: 'MIT', label: 'MIT (coming soon)', comingSoon: true },
  { value: 'CMU', label: 'Carnegie Mellon (coming soon)', comingSoon: true },
  { value: 'UCLA', label: 'UCLA (coming soon)', comingSoon: true },
  { value: 'Harvard', label: 'Harvard (coming soon)', comingSoon: true },
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
  'networking',
  'architecture',
] as const

export default function SearchForm({ onSearch, loading }: Props) {
  const [university, setUniversity] = useState('UC Berkeley')
  const [selectedTopics, setSelectedTopics] = useState<Set<string>>(new Set())
  const [interestsExtra, setInterestsExtra] = useState('')
  const [resume, setResume] = useState<File | null>(null)
  const [dbStatusMsg, setDbStatusMsg] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

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
    if (!interests) return
    setDbStatusMsg('')
    onSearch(university.trim(), interests, resume)
  }

  const interestsReady = buildInterests().length > 0
  const canSubmit = university.trim() && interestsReady

  return (
    <form onSubmit={handleSubmit} style={styles.form}>
      <div style={styles.field}>
        <label style={styles.label} htmlFor="university-select">
          University
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
            return (
              <button
                key={topic}
                type="button"
                onMouseDown={e => e.preventDefault()}
                onClick={e => {
                  toggleTopic(topic)
                  e.currentTarget.blur()
                }}
                style={{
                  ...styles.chip,
                  ...(on ? styles.chipOn : {}),
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
          placeholder="e.g. reinforcement learning, fairness, embedded systems"
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
      {!interestsReady && (
        <p style={styles.validationHint}>Choose at least one topic or add keywords above.</p>
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
    fontWeight: 600,
    color: '#7b8589',
  },
  subLabel: {
    fontSize: '13px',
    color: '#6b7280',
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
    color: '#8b99a2',
    margin: '2px 0 0 0',
  },
  optional: {
    fontWeight: 400,
    color: '#9ca3af',
  },
  select: {
    padding: '12px 16px',
    border: '2px solid #c7d4cf',
    borderRadius: '999px',
    fontSize: '15px',
    color: '#5f6a6f',
    background: '#ffffff',
    outline: 'none',
    cursor: 'pointer',
    width: '100%',
    maxWidth: '100%',
  },
  chipRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
  },
  chip: {
    padding: '6px 12px',
    border: '1.5px solid #d7deda',
    borderRadius: '999px',
    background: '#fcfcfa',
    color: '#667176',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.12s',
    outline: 'none',
    boxShadow: 'none',
  },
  chipOn: {
    borderColor: '#90a9b8',
    background: '#edf3f6',
    color: '#4f6776',
  },
  input: {
    padding: '12px 16px',
    border: '2px solid #c7d4cf',
    borderRadius: '18px',
    fontSize: '15px',
    color: '#5f6a6f',
    background: '#fff',
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
    border: '2px dashed #c8d3cd',
    borderRadius: '18px',
    background: '#ffffff',
    color: '#6b7280',
    fontSize: '14px',
    fontWeight: 500,
    transition: 'all 0.15s',
    textAlign: 'center',
  },
  clearBtn: {
    width: '28px',
    height: '28px',
    border: 'none',
    background: '#f3f4f6',
    borderRadius: '50%',
    color: '#6b7280',
    fontSize: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submit: {
    width: '100%',
    padding: '13px 24px',
    background: '#87a5b7',
    border: 'none',
    borderRadius: '999px',
    color: '#fff',
    fontSize: '18px',
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
