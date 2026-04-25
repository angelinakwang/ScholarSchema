import type { SearchResponse, EmailResponse, Professor } from './types'

const BASE = '/api'

export async function searchProfessors(
  university: string,
  interests: string,
  resume: File | null
): Promise<SearchResponse> {
  const form = new FormData()
  form.append('university', university)
  form.append('interests', interests)
  if (resume) form.append('resume', resume)

  let res: Response
  try {
    res = await fetch(`${BASE}/search`, { method: 'POST', body: form })
  } catch {
    throw new Error(
      'Cannot reach the API. From the project root, run the backend on port 5001 (e.g. `cd backend && python3 app.py`) and keep `npm run dev` running so Vite can proxy /api.'
    )
  }

  const text = await res.text()
  let data: { results?: unknown; from_cache?: boolean; error?: string }
  try {
    data = text ? JSON.parse(text) : {}
  } catch {
    throw new Error(
      res.ok
        ? 'Invalid JSON from server.'
        : `Server returned ${res.status}. If the backend is not running, start it on port 5001 (macOS often uses port 5000 for AirPlay).`
    )
  }

  if (!res.ok) {
    throw new Error(data.error || `Search failed (${res.status})`)
  }

  return data as SearchResponse
}

export async function generateEmail(
  professor: Professor,
  resumeText: string
): Promise<EmailResponse> {
  const res = await fetch(`${BASE}/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ professor, resume_text: resumeText }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || 'Email generation failed')
  }
  return res.json()
}
