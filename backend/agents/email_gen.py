import os
import time
from groq import Groq, RateLimitError
from dotenv import load_dotenv

load_dotenv()

GROQ_API_KEY = os.getenv('GROQ_API_KEY')
_client = None


def _get_client():
    global _client
    if _client is None:
        _client = Groq(api_key=GROQ_API_KEY)
    return _client


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

    if not GROQ_API_KEY:
        return _fallback_email(last_name, research_summary, papers)

    max_retries = 5
    for i in range(max_retries):
        try:
            completion = _get_client().chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[{"role": "user", "content": prompt}],
            )
            return completion.choices[0].message.content.strip()
        except RateLimitError:
            wait_time = (2 ** i) + 1
            print(f"[email_gen] rate limited (429), retrying in {wait_time}s...")
            time.sleep(wait_time)
        except Exception as e:
            print(f"[email_gen] Groq failed: {e}")
            return _fallback_email(last_name, research_summary, papers)

    print("[email_gen] rate limit persisted after retries, using fallback")
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
