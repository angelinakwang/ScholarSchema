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

  const res = await fetch(`${BASE}/search`, { method: 'POST', body: form })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || 'Search failed')
  }
  return res.json()
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
