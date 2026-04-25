import requests
import os
import json
import re
from dotenv import load_dotenv
load_dotenv()


SERPER_API_KEY = os.getenv('SERPER_API_KEY')

# Map university display names / common aliases to their local JSON file key
_UNIVERSITY_DB_KEYS = {
    'uc berkeley': 'berkeley',
    'berkeley': 'berkeley',
    'ucb': 'berkeley',
}


def _db_path(key: str) -> str:
    return os.path.join(os.path.dirname(__file__), '..', 'data', f'{key}.json')


def find_professors_from_db(university: str, interests: str) -> list | None:
    """
    Look up professors from a pre-built local JSON database.
    Returns a list of professor dicts (same shape as find_professors output)
    if the university has a local DB, or None if it doesn't.

    Keyword-matches each professor's research_interests against the student's
    interests string, then returns the top 10 by match count so the LLM has
    enough candidates to score properly.
    """
    key = _UNIVERSITY_DB_KEYS.get(university.lower().strip())
    if not key:
        return None

    path = _db_path(key)
    if not os.path.exists(path):
        print(f"[db] No local DB found at {path} — run scraper.py first")
        return None

    with open(path) as f:
        professors = json.load(f)

    print(f"[db] Loaded {len(professors)} professors from {path}")

    # Tokenize interests into individual keywords for matching
    interest_tokens = [
        w.lower() for w in re.split(r'[\s,;/]+', interests) if len(w) > 2
    ]

    def _score(prof: dict) -> int:
        haystack = (prof.get('research_interests', '') + ' ' + prof.get('name', '')).lower()
        return sum(1 for token in interest_tokens if token in haystack)

    scored = [(prof, _score(prof)) for prof in professors]
    scored.sort(key=lambda x: x[1], reverse=True)

    # Return top 10 with score > 0; fall back to top 10 overall if nothing matches
    top = [p for p, s in scored if s > 0][:10] or [p for p, _ in scored[:10]]

    return [
        {
            'name': p['name'],
            'url': p['url'],
            'snippet': p.get('research_interests', ''),
            'university': p['university'],
            'email': p.get('email', ''),
        }
        for p in top
    ]


def _base_name(name: str) -> str:
    raw = (name or '').strip()
    for sep in [' - ', ' | ', ' – ']:
        if sep in raw:
            raw = raw.split(sep)[0].strip()
            break
    return raw


def _looks_like_real_person(name: str) -> bool:
    base = _base_name(name)
    if not base:
        return False
    words = [w for w in base.split() if w]
    if len(words) < 2 or len(words) > 4:
        return False
    if not words[0][0].isupper():
        return False
    blocked_words = [
        'lab', 'department', 'program', 'initiative', 'center', 'institute',
        'home', 'area', 'informatics', 'medicine', 'healthcare', 'artificial',
        'intelligence', 'research', 'computing', 'computational', 'medical',
        'ucla', 'berkeley', 'stanford'
    ]
    base_lower = base.lower()
    if any(word in base_lower for word in blocked_words):
        return False
    return True


def find_professors(university: str, interests: str) -> list:
    queries = [
        f"site:cs.ucla.edu OR site:ee.ucla.edu {interests} professor -inurl:news -inurl:press",
        f"{university} {interests} PhD student researcher personal website",
    ]

    headers = {
        'X-API-KEY': SERPER_API_KEY,
        'Content-Type': 'application/json'
    }

    people = []
    seen_urls = set()

    for query in queries:
        response = requests.post(
            'https://google.serper.dev/search',
            headers=headers,
            json={'q': query, 'num': 10},
            timeout=20,
        )
        response.raise_for_status()
        results = response.json().get('organic', [])

        for r in results:
            url = r.get('link')
            if not url or url in seen_urls:
                continue
            seen_urls.add(url)

            people.append({
                'name': r.get('title', '').split('|')[0].strip(),
                'url': url,
                'snippet': r.get('snippet', ''),
                'university': university,
            })

            if len(people) >= 20:
                break

    filtered_people = []
    seen_base_names = set()
    for person in people:
        name = person.get('name', '')
        base = _base_name(name)

        # Deduplicate by extracted person name.
        if base.lower() in seen_base_names:
            continue
        seen_base_names.add(base.lower())

        if not _looks_like_real_person(name):
            continue
        person['name'] = base
        filtered_people.append(person)

    return filtered_people[:5]
