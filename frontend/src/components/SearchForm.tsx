import { useState, useRef } from 'react'

interface Props {
  onSearch: (university: string, interests: string, resume: File | null) => void
  loading: boolean
}

export default function SearchForm({ onSearch, loading }: Props) {
  const [university, setUniversity] = useState('')
  const [interests, setInterests] = useState('')
  const [resume, setResume] = useState<File | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!university.trim() || !interests.trim()) return
    onSearch(university.trim(), interests.trim(), resume)
  }

  return (
    <form onSubmit={handleSubmit} style={styles.form}>
      <div style={styles.row}>
        <div style={styles.field}>
          <label style={styles.label}>University</label>
          <input
            style={styles.input}
            type="text"
            placeholder="e.g. UC Berkeley"
            value={university}
            onChange={e => setUniversity(e.target.value)}
            required
          />
        </div>
      </div>

      <div style={styles.field}>
        <label style={styles.label}>Research Interests</label>
        <textarea
          style={{ ...styles.input, ...styles.textarea }}
          placeholder="e.g. machine learning, computer vision, natural language processing"
          value={interests}
          onChange={e => setInterests(e.target.value)}
          required
          rows={3}
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
              onClick={() => { setResume(null); if (fileRef.current) fileRef.current.value = '' }}
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

      <button type="submit" style={styles.submit} disabled={loading}>
        {loading ? (
          <span style={styles.loadingRow}>
            <span style={styles.spinner} /> Finding matches…
          </span>
        ) : 'Find Researchers'}
      </button>
    </form>
  )
}

const styles: Record<string, React.CSSProperties> = {
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  row: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: '16px',
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
  optional: {
    fontWeight: 400,
    color: '#9ca3af',
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
    minHeight: '72px',
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
