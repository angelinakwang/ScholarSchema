import { useState, useRef } from 'react'

interface Props {
  onSearch: (university: string, interests: string, resume: File | null) => void
  loading: boolean
}

/** Values must match backend `_UNIVERSITY_DB_KEYS` in agents/discover.py (case-insensitive). */
const UNIVERSITIES: { value: string; label: string; disabled?: boolean }[] = [
  { value: '', label: 'Select a university…', disabled: true },
  { value: 'UC Berkeley', label: 'UC Berkeley' },
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
    const interests = buildInterests()
    if (!interests) return
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
          onChange={e => setUniversity(e.target.value)}
          required
        >
          {UNIVERSITIES.map(opt => (
            <option key={opt.value || 'placeholder'} value={opt.value} disabled={opt.disabled}>
              {opt.label}
            </option>
          ))}
        </select>
        <p style={styles.hint}>Only schools with a local researcher database are listed.</p>
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
                onClick={() => toggleTopic(topic)}
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
    gap: '20px',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  label: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#374151',
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
    marginTop: '2px',
  },
  validationHint: {
    fontSize: '13px',
    color: '#b45309',
    margin: '-8px 0 0 0',
  },
  optional: {
    fontWeight: 400,
    color: '#9ca3af',
  },
  select: {
    padding: '10px 14px',
    border: '1.5px solid #e5e7eb',
    borderRadius: '8px',
    fontSize: '15px',
    color: '#1a1a2e',
    background: '#fff',
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
    border: '1.5px solid #e5e7eb',
    borderRadius: '999px',
    background: '#fafafa',
    color: '#4b5563',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.12s',
  },
  chipOn: {
    borderColor: '#818cf8',
    background: '#eef2ff',
    color: '#4338ca',
  },
  input: {
    padding: '10px 14px',
    border: '1.5px solid #e5e7eb',
    borderRadius: '8px',
    fontSize: '15px',
    color: '#1a1a2e',
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
    padding: '9px 16px',
    border: '1.5px dashed #d1d5db',
    borderRadius: '8px',
    background: '#fafafa',
    color: '#374151',
    fontSize: '14px',
    fontWeight: 500,
    transition: 'all 0.15s',
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
    padding: '12px 24px',
    background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
    border: 'none',
    borderRadius: '10px',
    color: '#fff',
    fontSize: '15px',
    fontWeight: 600,
    letterSpacing: '0.01em',
    transition: 'opacity 0.15s, transform 0.1s',
    alignSelf: 'flex-start',
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
