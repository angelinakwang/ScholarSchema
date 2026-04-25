import os
import json
import re

from groq import Groq
import requests
from dotenv import load_dotenv

load_dotenv()

SERPER_API_KEY = os.getenv('SERPER_API_KEY')
GROQ_API_KEY = os.getenv('GROQ_API_KEY')
SERPER_SCHOLAR_URL = 'https://google.serper.dev/scholar'
groq_client = Groq(api_key=os.getenv('GROQ_API_KEY'))
print(f"[enrich] GROQ_API_KEY loaded: {'YES' if GROQ_API_KEY else 'NO - THIS IS THE PROBLEM'}")
print(f"[enrich] SERPER_API_KEY loaded: {'YES' if SERPER_API_KEY else 'NO'}")


def _extract_person_name(raw_name: str) -> str:
    name = (raw_name or '').strip()
    name = re.split(r'\s[-|]\s', name)[0].strip()
    name = re.sub(
        r'\s+(ucla profiles|google scholar|linkedin|faculty|profile)$',
        '', name, flags=re.IGNORECASE
    ).strip()
    return name or raw_name


def _serper_scholar_search(name: str, university: str) -> list:
    query = f"{name} {university}".strip()
    print(f"[scholar] Searching: {query}")
    response = requests.post(
        SERPER_SCHOLAR_URL,
        headers={
            'X-API-KEY': SERPER_API_KEY,
            'Content-Type': 'application/json',
        },
        json={'q': query, 'num': 5},
        timeout=20,
    )
    print(f"[scholar] Status: {response.status_code}")
    response.raise_for_status()
    results = response.json().get('organic', [])
    print(f"[scholar] Papers found: {len(results)}")
    return results


def _format_scholar_papers(scholar_results: list) -> tuple:
    papers = []
    papers_lines = []
    for item in scholar_results[:5]:
        title = str(item.get('title', '')).strip()
        snippet = str(item.get('snippet', '')).strip()
        link = str(item.get('link', '')).strip()
        year_match = re.search(r'\b(19|20)\d{2}\b', snippet)
        year = year_match.group(0) if year_match else ''
        if not title:
            continue
        papers.append({'title': title, 'snippet': snippet, 'link': link, 'year': year})
        papers_lines.append(f"- Title: {title}\n  Snippet: {snippet}")
    return papers, '\n'.join(papers_lines)


def _extract_email_from_scholar(scholar_results: list):
    email_pattern = r'[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}'
    for item in scholar_results:
        candidates = [
            str(item.get('title', '')).strip(),
            str(item.get('snippet', '')).strip(),
            str(item.get('link', '')).strip(),
        ]
        for text in candidates:
            match = re.search(email_pattern, text)
            if match:
                return match.group(0)
    return None


def _call_groq_summarize(name: str, university: str, papers_text: str) -> dict:
    """
    Build a structured research profile from a person's papers alone.
    Used at scrape time — no student interests involved.
    """
    prompt = f"""Researcher: {name} at {university}
Their recent papers:
{papers_text[:1500]}

Based only on their papers, extract:
1. A 2-sentence plain English summary of their research
2. 3-5 specific research area tags (e.g. "reinforcement learning", "computer vision")
3. A one-line summary of each paper

Return valid JSON only, no markdown, no code blocks:
{{"research_summary": "2 sentence overview",
"research_areas": ["area1", "area2", "area3"],
"papers": [{{"title": "title", "year": "2024", "one_line_summary": "what this paper does"}}]}}"""

    response = groq_client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.3
    )
    text = response.choices[0].message.content
    text = re.sub(r'```json|```', '', text).strip()
    return json.loads(text)


def _call_groq_profile(name, university, papers_text, interests, resume_text):
    safe_resume = resume_text[:300] if resume_text else 'not provided'
    prompt = f"""Researcher: {name} at {university}
Their recent papers:
{papers_text[:1000]}
Student interests: {interests}
Student resume: {safe_resume}

Score strictly:
90-100: Their specific papers directly match student experience
70-89: General area overlap
50-69: Loose connection
Below 50: Poor match
Use the student resume to justify the score specifically.

Return valid JSON only, no markdown, no code blocks:
{{"research_summary": "2 sentence plain English overview of their work",
"research_areas": ["area1", "area2", "area3"],
"match_score": "integer 0-100",
"match_reason": "one specific sentence about why they match",
"papers": [{{"title": "title", "year": "2024", 
"one_line_summary": "what this paper does in one sentence"}}]}}"""

    response = groq_client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.3
    )
    text = response.choices[0].message.content
    text = re.sub(r'```json|```', '', text).strip()
    return json.loads(text)


def _normalize_papers(papers):
    clean = []
    for paper in papers[:4]:
        if not isinstance(paper, dict):
            continue
        clean.append({
            'title': str(paper.get('title', '')).strip(),
            'year': paper.get('year'),
            'one_line_summary': str(paper.get('one_line_summary', '')).strip(),
        })
    return clean


def enrich_professors(professors: list, interests: str, resume_text: str) -> list:
    if not GROQ_API_KEY:
        raise ValueError('GROQ_API_KEY is missing from .env')

    enriched = []

    for professor in professors:
        name = _extract_person_name(professor.get('name', ''))
        university = professor.get('university', '')
        print(f"\n{'='*40}")
        print(f"[enrich] Processing: {name}")

        # Step 1: Get papers from Serper Scholar
        papers_text = ''
        scholar_papers = []
        scholar_results = []
        email = None
        try:
            scholar_results = _serper_scholar_search(name, university)
            scholar_papers, papers_text = _format_scholar_papers(scholar_results)
            email = _extract_email_from_scholar(scholar_results)
        except Exception as e:
            print(f"[scholar] FAILED for {name}: {type(e).__name__}: {e}")
            papers_text = f"- Snippet: {professor.get('snippet', '')}"
            email = None

        if not papers_text:
            papers_text = f"- Snippet: {professor.get('snippet', '')}"

        # Step 2: Call Groq
        groq_result = None
        try:
            groq_result = _call_groq_profile(
                name, university, papers_text, interests, resume_text
            )
            print(f"[groq] SUCCESS for {name}, score: {groq_result.get('match_score')}")
        except Exception as e:
            print(f"[groq] FAILED for {name}: {type(e).__name__}: {e}")
            groq_result = {
                'research_summary': professor.get('snippet', '') or f"Researcher at {university} working on {interests}.",
                'research_areas': [],
                'papers': [{'title': p['title'], 'year': p.get('year', ''), 'one_line_summary': p.get('snippet', '')} for p in scholar_papers[:3]],
                'match_score': 50,
                'match_reason': 'Potential match based on available research details.',
            }

        try:
            match_score = int(groq_result.get('match_score', 50))
            match_score = max(0, min(100, match_score))
        except Exception:
            match_score = 50

        enriched.append({
            'name': professor.get('name'),
            'url': professor.get('url'),
            'profile_url': professor.get('url'),
            'university': professor.get('university'),
            'type': professor.get('type', 'Faculty/Researcher'),
            'papers': _normalize_papers(groq_result.get('papers', [])),
            'research_summary': str(groq_result.get('research_summary', '')).strip(),
            'research_areas': groq_result.get('research_areas', []),
            'match_score': match_score,
            'match_reason': str(groq_result.get('match_reason', '')).strip(),
            'email': email,
            'personal_website': professor.get('url'),
        })

    return enriched


def score_professors_from_db(professors: list, interests: str, resume_text: str) -> list:
    """
    Fast path for pre-enriched professors from local DB.
    Papers and research summaries are already stored — only compute match scores.
    No Scholar API calls needed.
    """
    if not GROQ_API_KEY:
        raise ValueError('GROQ_API_KEY is missing from .env')

    scored = []
    for prof in professors:
        name = prof.get('name', '')
        university = prof.get('university', '')
        print(f"[score] {name}")

        papers = prof.get('papers', [])
        papers_text = '\n'.join(
            f"- {p.get('title', '')} ({p.get('year', '')}): {p.get('one_line_summary', '')}"
            for p in papers
        ) or prof.get('research_summary', '')

        try:
            safe_resume = resume_text[:300] if resume_text else 'not provided'
            prompt = f"""Researcher: {name} at {university}
Research summary: {prof.get('research_summary', '')}
Research areas: {', '.join(prof.get('research_areas', []))}
Recent papers:
{papers_text[:800]}

Student interests: {interests}
Student resume: {safe_resume}

Score strictly:
90-100: Their specific papers directly match student experience
70-89: General area overlap
50-69: Loose connection
Below 50: Poor match

Return valid JSON only, no markdown:
{{"match_score": integer, "match_reason": "one specific sentence explaining the match"}}"""

            response = groq_client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.3
            )
            text = response.choices[0].message.content
            text = re.sub(r'```json|```', '', text).strip()
            result = json.loads(text)
            match_score = max(0, min(100, int(result.get('match_score', 50))))
            match_reason = str(result.get('match_reason', '')).strip()
        except Exception as e:
            print(f"[score] FAILED for {name}: {e}")
            match_score = 50
            match_reason = 'Potential match based on research profile.'

        scored.append({
            **prof,
            'profile_url': prof.get('url'),
            'personal_website': prof.get('url'),
            'match_score': match_score,
            'match_reason': match_reason,
        })

    return scored