export interface Paper {
  title: string
  year: string
  one_line_summary: string
  url?: string
}

export interface Professor {
  name: string
  url: string
  profile_url: string
  directory_url?: string
  university: string
  type: string
  papers: Paper[]
  research_summary: string
  research_areas: string[]
  match_score: number
  match_reason: string
  email: string | null
  personal_website: string
}

export interface SearchResponse {
  results: Professor[]
  from_cache: boolean
}

export interface EmailResponse {
  email: string
}
