import json
import os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(SCRIPT_DIR, 'data')
BERKELEY_SCRAPED = os.path.join(DATA_DIR, 'berkeley.json')
PROFESSORS_PATH = os.path.join(DATA_DIR, 'professors.json')

GENERIC_EECS_URL = 'https://eecs.berkeley.edu'

# Name substrings that indicate a non-person / junk row (case-insensitive)
JUNK_NAME_SUBSTRINGS = [
    'Placeholder', 'Students', 'BAIR', 'Berkeley', 'Log In',
    'Responsible', 'Humanoid', 'Commons', 'REU',
]


def _name_is_junk(name: str) -> bool:
    lower = (name or '').lower()
    return any(s.lower() in lower for s in JUNK_NAME_SUBSTRINGS)


def _clean_person(person: dict) -> dict:
    out = dict(person)
    out['university'] = 'Berkeley'

    url = out.get('url', '')
    directory_url = out.get('directory_url', '') or ''

    if url == GENERIC_EECS_URL and directory_url:
        out['profile_url'] = directory_url
    else:
        out['profile_url'] = url or directory_url

    out.pop('directory_url', None)
    return out


def main():
    with open(BERKELEY_SCRAPED, 'r') as f:
        scraped = json.load(f)

    cleaned = []
    for person in scraped:
        name = person.get('name', '')
        summary = (person.get('research_summary') or '').strip()
        papers = person.get('papers') or []

        if _name_is_junk(name):
            continue
        if not summary:
            continue
        if not isinstance(papers, list) or len(papers) == 0:
            continue

        cleaned.append(_clean_person(person))

    print(f"Kept {len(cleaned)} people out of {len(scraped)}")
    for p in cleaned:
        print(f"  - {p['name']} ({p['type']})")

    if os.path.exists(PROFESSORS_PATH):
        with open(PROFESSORS_PATH, 'r') as f:
            professors = json.load(f)
    else:
        professors = {}

    existing_berkeley = list(professors.get('Berkeley', []))
    existing_names = {p['name'].lower() for p in existing_berkeley}

    added = 0
    for person in cleaned:
        if person['name'].lower() not in existing_names:
            existing_berkeley.append(person)
            existing_names.add(person['name'].lower())
            added += 1

    professors['Berkeley'] = existing_berkeley

    with open(PROFESSORS_PATH, 'w') as f:
        json.dump(professors, f, indent=2)

    print(f"\nAdded {added} new people to professors.json")
    print(f"Berkeley now has {len(existing_berkeley)} total entries")


if __name__ == '__main__':
    main()
