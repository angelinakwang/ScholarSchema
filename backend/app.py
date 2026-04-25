from dotenv import load_dotenv
load_dotenv()

from flask import Flask, request, jsonify
from flask_cors import CORS
from agents.discover import find_professors, find_professors_from_db
from agents.enrich import enrich_professors, score_professors_from_db
from agents.email_gen import draft_email
from db import get_cached_results, save_results
import pdfplumber
import io

app = Flask(__name__)
CORS(app)

@app.route('/api/search', methods=['POST'])
def search():
    try:
        university = request.form.get('university')
        interests = request.form.get('interests')
        resume_file = request.files.get('resume')

        resume_text = ''
        if resume_file:
            with pdfplumber.open(io.BytesIO(resume_file.read())) as pdf:
                for page in pdf.pages:
                    resume_text += page.extract_text() or ''

        # Check cache first
        cached = get_cached_results(university, interests)
        if cached:
            return jsonify({'results': cached, 'from_cache': True})

        # Use local DB if available — papers already pre-summarized, just score match
        professors = find_professors_from_db(university, interests)
        if professors is not None:
            enriched = score_professors_from_db(professors, interests, resume_text)
        else:
            professors = find_professors(university, interests)
            enriched = enrich_professors(professors, interests, resume_text)

        # Save to cache
        save_results(university, interests, enriched)

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
    app.run(debug=True, port=5000)