import os
import re
from groq import Groq
from dotenv import load_dotenv

load_dotenv()

GROQ_API_KEY = os.getenv('GROQ_API_KEY')
_groq_client = Groq(api_key=GROQ_API_KEY) if GROQ_API_KEY else None


def draft_email(professor: dict, resume_text: str) -> str:
    name = professor.get('name', 'Professor')
    last_name = name.strip().split()[-1] if name.strip() else 'Professor'
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

    prompt = f"""Write a cold email from a student to a professor requesting research opportunities.

Professor: {name} at {university}
Research summary: {research_summary}
Research areas: {', '.join(research_areas)}
Recent papers:
{papers_text or '(not available)'}

Student background: {safe_resume}

Rules:
- 50 to 125 words, around 5 sentences professional but warm tone
- Start with exactly: "Dear Professor {last_name},"
- Start with major, school
- Mention 1-2 specific papers or research areas by name, and what stood out about the paper
- Connect student background to professor's work specifically
- End with a request for a 15-minute meeting
- Final line of signature must be exactly: "Best regards,"
- First line must be the subject line starting with "Subject:"
- Then a blank line
- Then the email body
- Add spacing after around body
- No placeholder brackets like [Your Name]

Return only the email text, nothing else."""

    if not _groq_client:
        print("[email_gen] No GROQ_API_KEY — using fallback")
        return _fallback_email(last_name, research_summary, papers)

    try:
        response = _groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.4
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        print(f"[email_gen] Groq failed: {e}")
        return _fallback_email(last_name, research_summary, papers)


def _fallback_email(last_name: str, research_summary: str, papers: list) -> str:
    paper_line = ''
    if papers and isinstance(papers[0], dict):
        p = papers[0]
        paper_line = f'\n\nI was particularly interested in your recent work on "{p.get("title", "")}".'

    return f"""Subject: Research Opportunity Inquiry

Dear Professor {last_name},

I hope this message finds you well. I am a student deeply interested in your research{' on ' + research_summary[:80] + '...' if research_summary else '.'}{paper_line}

I would love to learn more about ongoing projects in your lab and explore potential opportunities to contribute. I believe my background aligns well with your work and I am eager to discuss how I might support your research.

Would you be available for a brief 15-minute meeting at your convenience?

Best regards,"""