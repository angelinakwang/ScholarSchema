import os
import re
import requests
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')
GEMINI_URL = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={GEMINI_API_KEY}"


def _professor_last_name(full_name: str) -> str:
    parts = [p for p in (full_name or '').strip().split() if p]
    return parts[-1] if parts else 'Professor'


def draft_email(professor: dict, resume_text: str) -> str:
    name = professor.get('name', 'Professor')
    last_name = _professor_last_name(name)
    university = professor.get('university', '')
    research_summary = professor.get('research_summary', '')
    papers = professor.get('papers', [])
    research_areas = professor.get('research_areas', [])

    papers_text = '\n'.join(
        f"- {p.get('title', '')} ({p.get('year', '')}): {p.get('one_line_summary', '')}"
        for p in papers[:3]
        if isinstance(p, dict) and p.get('title')
    )

    safe_resume = (resume_text or '').strip()[:600] or 'not provided'

    prompt = f"""Write a cold email from a student to a professor requesting to discuss research opportunities.

Professor: {name} at {university}
Research summary: {research_summary}
Research areas: {', '.join(research_areas)}
Recent papers:
{papers_text or '(not available)'}

Student background (from resume): {safe_resume}

Rules:
- 3-4 paragraphs, professional but warm tone
- Start salutation exactly as: "Dear Professor {last_name},"
- Mention 1-2 specific papers or research areas by name
- Briefly connect student background to professor's work
- Ask for a 15-minute meeting or to discuss opportunities
- No placeholder brackets like [Your Name] — end with "Best regards," on its own line
- Subject line on first line, then blank line, then body

Return only the email text, no extra commentary."""

    if not GEMINI_API_KEY:
        return _fallback_email(last_name, research_summary, papers)

    try:
        resp = requests.post(
            GEMINI_URL,
            json={"contents": [{"parts": [{"text": prompt}]}]},
            timeout=30,
        )
        resp.raise_for_status()
        text = resp.json()['candidates'][0]['content']['parts'][0]['text']
        return text.strip()
    except Exception as e:
        print(f"[email_gen] Gemini failed: {e}")
        return _fallback_email(last_name, research_summary, papers)


def _fallback_email(last_name: str, research_summary: str, papers: list) -> str:
    paper_line = ''
    if papers and isinstance(papers[0], dict):
        p = papers[0]
        paper_line = f'\n\nI was particularly interested in your recent work on "{p.get("title", "")}".'

    return f"""Subject: Research Opportunity Inquiry

Dear Professor {last_name},

I hope this message finds you well. I am a student deeply interested in your research{' on ' + research_summary[:80] + '…' if research_summary else '.'}{paper_line}

I would love to learn more about ongoing projects in your lab and explore potential opportunities to contribute. I believe my background aligns well with your work and I am eager to discuss how I might support your research.

Would you be available for a brief 15-minute meeting at your convenience?

Best regards,"""
