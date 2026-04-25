"""
One-time script to build a local professor database from university faculty pages.
Run: python scraper.py --university berkeley
Output: data/berkeley.json

Supports multiple universities — add entries to UNIVERSITY_CONFIGS below.
"""
import requests
from bs4 import BeautifulSoup
import json
import re
import time
import argparse
import os

# Browser User-Agent so university servers don't block us
HEADERS = {
    'User-Agent': (
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) '
        'AppleWebKit/537.36 (KHTML, like Gecko) '
        'Chrome/124.0.0.0 Safari/537.36'
    ),
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
}

# ─── University configurations ────────────────────────────────────────────────
# Each entry defines where to find faculty for a given university.
# 'faculty_list_urls': pages that list many faculty with links to their profiles
# 'profile_base': optional base URL to prepend to relative profile links
UNIVERSITY_CONFIGS = {
    'berkeley': {
        'display_name': 'UC Berkeley',
        'faculty_list_urls': [
            'https://www2.eecs.berkeley.edu/Faculty/Lists/CS/faculty.html',
            'https://www2.eecs.berkeley.edu/Faculty/Lists/EE/faculty.html',
        ],
        'profile_base': 'https://www2.eecs.berkeley.edu',
    },
    # Template for adding more universities:
    # 'stanford': {
    #     'display_name': 'Stanford University',
    #     'faculty_list_urls': [
    #         'https://cs.stanford.edu/people/faculty/',
    #     ],
    #     'profile_base': '',
    # },
}
# ──────────────────────────────────────────────────────────────────────────────


def _get(url: str, timeout: int = 15) -> requests.Response | None:
    try:
        resp = requests.get(url, headers=HEADERS, timeout=timeout)
        resp.raise_for_status()
        return resp
    except Exception as e:
        print(f"  [warn] GET failed for {url}: {e}")
        return None


def _extract_faculty_links(page_url: str, profile_base: str) -> list[dict]:
    """
    Scrape a faculty listing page and return a list of
    {'name': str, 'profile_url': str} dicts.
    """
    print(f"\n[list] Fetching {page_url}")
    resp = _get(page_url)
    if not resp:
        return []

    soup = BeautifulSoup(resp.text, 'html.parser')
    faculty = []
    seen_urls = set()

    # Most university faculty list pages use <a> tags with the professor's name
    # as text and a link to their profile. We look for patterns like:
    #   <a href="/Faculty/Homepages/foo.html">Firstname Lastname</a>
    for a in soup.find_all('a', href=True):
        href = a['href'].strip()
        name = a.get_text(strip=True)

        # Skip empty, navigation, or icon links
        if not name or len(name) < 4:
            continue

        # Name should look like a person (2-4 capitalized words)
        words = name.split()
        if len(words) < 2 or len(words) > 5:
            continue
        if not words[0][0].isupper():
            continue
        # Skip links that are clearly not person names
        skip_words = ['faculty', 'research', 'home', 'page', 'lab', 'back', 'next',
                      'more', 'contact', 'all', 'list', 'view', 'here', 'click']
        if any(w.lower() in skip_words for w in words):
            continue

        # Build full URL
        if href.startswith('http'):
            full_url = href
        elif href.startswith('/'):
            full_url = profile_base.rstrip('/') + href
        else:
            continue

        if full_url in seen_urls:
            continue
        seen_urls.add(full_url)

        faculty.append({'name': name, 'profile_url': full_url})

    print(f"  [list] Found {len(faculty)} faculty links")
    return faculty


def _extract_profile(professor: dict, university_display: str) -> dict | None:
    """
    Visit a professor's profile page and extract research interests + email.
    Returns enriched professor dict or None if the page is unreachable.
    """
    url = professor['profile_url']
    resp = _get(url)
    if not resp:
        # Keep the professor even without profile data
        return {
            'name': professor['name'],
            'url': url,
            'university': university_display,
            'research_interests': '',
            'email': '',
            'department': '',
        }

    soup = BeautifulSoup(resp.text, 'html.parser')
    text = soup.get_text(separator=' ', strip=True)

    # Extract research interests — look for common section headings
    research_interests = ''
    patterns = [
        r'[Rr]esearch [Ii]nterests?[:\s]+([^.]{20,300})',
        r'[Rr]esearch [Aa]reas?[:\s]+([^.]{20,300})',
        r'[Rr]esearch [Ff]ocus[:\s]+([^.]{20,300})',
        r'[Ww]orks? on[:\s]+([^.]{20,300})',
    ]
    for pattern in patterns:
        match = re.search(pattern, text)
        if match:
            research_interests = match.group(1).strip()
            break

    # Fallback: grab text from a <meta name="description"> tag
    if not research_interests:
        meta = soup.find('meta', attrs={'name': 'description'})
        if meta and meta.get('content'):
            research_interests = meta['content'][:300]

    # Extract email
    email_match = re.search(r'[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}', text)
    email = email_match.group(0) if email_match else ''

    # Try to find department from page
    dept_match = re.search(
        r'(Electrical Engineering|Computer Science|EECS|Statistics|Mathematics)',
        text
    )
    department = dept_match.group(0) if dept_match else 'EECS'

    return {
        'name': professor['name'],
        'url': url,
        'university': university_display,
        'research_interests': research_interests,
        'email': email,
        'department': department,
    }


def scrape_university(key: str) -> list[dict]:
    config = UNIVERSITY_CONFIGS[key]
    display_name = config['display_name']
    profile_base = config.get('profile_base', '')

    print(f"\n{'='*50}")
    print(f"Scraping {display_name}")
    print(f"{'='*50}")

    # Step 1: collect all faculty links from listing pages
    all_faculty = []
    seen_names = set()
    for list_url in config['faculty_list_urls']:
        for prof in _extract_faculty_links(list_url, profile_base):
            if prof['name'].lower() not in seen_names:
                seen_names.add(prof['name'].lower())
                all_faculty.append(prof)

    print(f"\n[scrape] Total unique faculty to enrich: {len(all_faculty)}")

    # Step 2: visit each profile page
    enriched = []
    for i, prof in enumerate(all_faculty, 1):
        print(f"  [{i}/{len(all_faculty)}] {prof['name']}")
        result = _extract_profile(prof, display_name)
        if result:
            enriched.append(result)
        time.sleep(0.5)  # be polite

    print(f"\n[scrape] Done. Enriched {len(enriched)} professors.")
    return enriched


def main():
    parser = argparse.ArgumentParser(description='Build professor database from faculty pages')
    parser.add_argument('--university', required=True,
                        choices=list(UNIVERSITY_CONFIGS.keys()),
                        help='University key to scrape')
    parser.add_argument('--out', default=None,
                        help='Output JSON path (default: data/<university>.json)')
    args = parser.parse_args()

    professors = scrape_university(args.university)

    out_path = args.out or os.path.join(
        os.path.dirname(__file__), 'data', f'{args.university}.json'
    )
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, 'w') as f:
        json.dump(professors, f, indent=2)

    print(f"\n[done] Saved {len(professors)} professors to {out_path}")


if __name__ == '__main__':
    main()
