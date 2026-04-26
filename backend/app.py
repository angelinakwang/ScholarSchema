from dotenv import load_dotenv
load_dotenv()

from flask import Flask, request, jsonify
from flask_cors import CORS
from agents.discover import find_professors, find_professors_from_db
from agents.enrich import enrich_professors, score_professors_from_db
from agents.email_gen import draft_email
import pdfplumber
import io
import re
from collections import Counter

app = Flask(__name__)
CORS(app)


def _extract_clean_resume_text(resume_file) -> str:
    """Extract cleaner, de-noised text from uploaded PDF resumes."""
    raw_pages: list[str] = []
    with pdfplumber.open(io.BytesIO(resume_file.read())) as pdf:
        for page in pdf.pages:
            text = page.extract_text() or ''
            # Fix words split by line hyphenation.
            text = re.sub(r'(\w)-\n(\w)', r'\1\2', text)
            raw_pages.append(text)

    all_lines: list[str] = []
    for page_text in raw_pages:
        lines = [re.sub(r'\s+', ' ', ln).strip() for ln in page_text.splitlines()]
        all_lines.extend([ln for ln in lines if ln])

    # Remove likely header/footer lines repeated across pages.
    counts = Counter(all_lines)
    filtered = []
    for ln in all_lines:
        repeated = counts[ln] > 1
        looks_like_header_footer = len(ln) <= 42 or bool(re.search(r'page\s+\d+', ln, re.IGNORECASE))
        if repeated and looks_like_header_footer:
            continue
        filtered.append(ln)

    cleaned = ' '.join(filtered)
    cleaned = re.sub(r'\s+', ' ', cleaned).strip()
    return cleaned[:12000]


@app.route('/api/search', methods=['POST'])
def search():
    try:
        university = request.form.get('university')
        interests = request.form.get('interests')
        resume_file = request.files.get('resume')

        resume_text = ''
        if resume_file:
            resume_text = _extract_clean_resume_text(resume_file)

        # Use local DB if available — papers already pre-summarized, just score match
        professors = find_professors_from_db(university, interests)
        if professors is not None:
            enriched = score_professors_from_db(professors, interests, resume_text)
        else:
            professors = find_professors(university, interests)
            enriched = enrich_professors(professors, interests, resume_text)

        return jsonify({'results': enriched, 'from_cache': False})

    except Exception as e:
        print("ERROR:", str(e))
        return jsonify({'error': str(e)}), 500


@app.route('/api/email', methods=['POST'])
def generate_email():
    try:
        data = request.json
        professor = data.get('professor')
        resume_text = data.get('resume_text')
        email = draft_email(professor, resume_text)
        return jsonify({'email': email})
    except Exception as e:
        print("ERROR:", str(e))
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    # Port 5000 is often taken by macOS AirPlay Receiver — use 5001 for local dev.
    app.run(debug=True, port=5001)