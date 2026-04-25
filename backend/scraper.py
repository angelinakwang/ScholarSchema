"""
One-time script to build a local professor/PhD-student database.
Run: python scraper.py --university berkeley
Output: data/berkeley.json

For each person it:
  1. Finds their personal website from the department/lab listing page
  2. Searches Google Scholar for their recent papers
  3. Calls Groq to summarize papers into research_summary + research_areas
  4. Stores everything so query-time needs zero Scholar/scraping calls.

To add a new university, add an entry to UNIVERSITY_CONFIGS below.
"""
import requests
from bs4 import BeautifulSoup
import json
import re
import time
import argparse
import os
import sys
from dotenv import load_dotenv
load_dotenv()

SERPER_API_KEY = os.getenv('SERPER_API_KEY')

# Make sure agents/ is importable when running as a standalone script
sys.path.insert(0, os.path.dirname(__file__))
from agents.enrich import (
    _serper_scholar_search,
    _format_scholar_papers,
    _extract_email_from_scholar,
    _call_groq_summarize,
)

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
#
# faculty_sources: list of faculty listing pages
#   - url: the listing page
#   - profile_base: prepended to relative hrefs
#   - profile_url_pattern: if set, only links whose href contains this string
#     are collected (precise; no name-guessing needed)
#
# phd_sources: list of PhD student listing pages
#   - url, profile_base as above
#   - direct_links: True if hrefs on the listing page already point to the
#     student's personal site (skip the directory-page hop)
#   - profile_url_pattern: optional, same as above
#
UNIVERSITY_CONFIGS = {
    'berkeley': {
        'display_name': 'UC Berkeley',
        'faculty_sources': [
            {
                'url': 'https://www2.eecs.berkeley.edu/Faculty/Lists/CS/faculty.html',
                'profile_base': 'https://www2.eecs.berkeley.edu',
                'profile_url_pattern': '/Faculty/Homepages/',
            },
            {
                'url': 'https://www2.eecs.berkeley.edu/Faculty/Lists/EE/faculty.html',
                'profile_base': 'https://www2.eecs.berkeley.edu',
                'profile_url_pattern': '/Faculty/Homepages/',
            },
        ],
        # BAIR's student page is JS-rendered — use serper_query instead.
        # serper_query: searches Google and collects personal-site results.
        'phd_sources': [
            {
                'serper_query': 'site:bair.berkeley.edu/blog/authors PhD student',
                'type': 'serper',
            },
            {
                'serper_query': 'BAIR Berkeley AI Research PhD student personal website',
                'type': 'serper',
            },
        ],
    },
    # Template:
    # 'stanford': {
    #     'display_name': 'Stanford University',
    #     'faculty_sources': [
    #         {
    #             'url': 'https://cs.stanford.edu/people/faculty/',
    #             'profile_base': 'https://cs.stanford.edu',
    #             'profile_url_pattern': '/~',
    #         }
    #     ],
    #     'phd_sources': [],
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


def _collect_phd_via_serper(query: str) -> list[dict]:
    """Search Google via Serper and return person-name results as profile stubs."""
    print(f"\n[serper] Searching for PhD students: {query}")
    try:
        resp = requests.post(
            'https://google.serper.dev/search',
            headers={'X-API-KEY': SERPER_API_KEY, 'Content-Type': 'application/json'},
            json={'q': query, 'num': 10},
            timeout=20,
        )
        resp.raise_for_status()
        results = resp.json().get('organic', [])
    except Exception as e:
        print(f"  [serper] FAILED: {e}")
        return []

    people = []
    for r in results:
        raw_name = r.get('title', '').split('|')[0].split('-')[0].strip()
        url = r.get('link', '')
        if not raw_name or not url:
            continue
        words = raw_name.split()
        if len(words) < 2 or len(words) > 3:
            continue
        if not all(w[0].isupper() for w in words if w):
            continue
        people.append({'name': raw_name, 'profile_url': url})

    print(f"  [serper] Found {len(people)} PhD student candidates")
    return people


def _is_person_name(text: str) -> bool:
    words = text.strip().split()
    if len(words) < 2 or len(words) > 3:
        return False
    if not all(w[0].isupper() for w in words):
        return False
    non_names = {
        'faculty', 'research', 'home', 'page', 'lab', 'back', 'next',
        'more', 'contact', 'all', 'list', 'view', 'here', 'click',
        'professor', 'department', 'center', 'institute', 'university',
        'the', 'and', 'for', 'new', 'about',
    }
    return not any(w.lower() in non_names for w in words)


def _collect_links(source: dict) -> list[dict]:
    """
    Fetch a listing page and return {'name', 'profile_url'} dicts.
    Filters by profile_url_pattern if set, else falls back to name detection.
    """
    page_url = source['url']
    profile_base = source.get('profile_base', '')
    pattern = source.get('profile_url_pattern', '')

    print(f"\n[list] Fetching {page_url}")
    resp = _get(page_url)
    if not resp:
        return []

    soup = BeautifulSoup(resp.text, 'html.parser')
    results = []
    seen_urls = set()

    # url -> best name seen so far (pattern mode may encounter the same URL
    # twice: once with an empty <img>-only link and once with the name as text)
    url_to_name: dict[str, str] = {}

    for a in soup.find_all('a', href=True):
        href = a['href'].strip()

        if href.startswith('http'):
            full_url = href
        elif href.startswith('/'):
            full_url = profile_base.rstrip('/') + href
        else:
            continue

        if pattern:
            if pattern not in full_url:
                continue
            # Try text, then img alt, then skip
            name = a.get_text(strip=True)
            if not name:
                img = a.find('img')
                if img and img.get('alt'):
                    # alt text often includes extra words — trim to first 2-3
                    alt_words = img['alt'].split()[:3]
                    name = ' '.join(alt_words)
            # Keep the longest/best name we've seen for this URL
            existing = url_to_name.get(full_url, '')
            if len(name) > len(existing):
                url_to_name[full_url] = name
        else:
            name = a.get_text(strip=True)
            if not _is_person_name(name):
                continue
            if full_url not in url_to_name:
                url_to_name[full_url] = name

    for full_url, name in url_to_name.items():
        if name:
            results.append({'name': name, 'profile_url': full_url})

    print(f"  [list] Found {len(results)} links")
    return results


def _find_personal_website(soup: BeautifulSoup, directory_url: str) -> str:
    """Find the personal website link on a university directory profile page."""
    directory_host = directory_url.split('/')[2]
    personal_labels = {
        'home page', 'homepage', 'personal website', 'personal page',
        'website', 'web page', 'webpage', 'personal site', 'faculty page',
        'visit website', 'lab website', 'lab page',
    }
    aggregator_hosts = {
        'scholar.google.com', 'linkedin.com', 'researchgate.net',
        'twitter.com', 'github.com', 'dblp.org', 'semanticscholar.org',
        'youtube.com', 'wikipedia.org',
    }
    candidates = []
    for a in soup.find_all('a', href=True):
        href = a['href'].strip()
        if not href.startswith('http'):
            continue
        host = href.split('/')[2]
        if host == directory_host:
            continue
        if any(agg in host for agg in aggregator_hosts):
            continue
        label = a.get_text(strip=True).lower()
        if label in personal_labels:
            return href
        candidates.append(href)
    return candidates[0] if candidates else ''


def _extract_email_from_page(soup: BeautifulSoup) -> str:
    text = soup.get_text(separator=' ', strip=True)
    match = re.search(r'[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}', text)
    return match.group(0) if match else ''


def _build_profile(person: dict, university: str, person_type: str,
                   direct_link: bool = False) -> dict:
    """
    For one person:
      1. Find their personal website (or use the listing link if direct_link=True)
      2. Scholar-search their papers
      3. Groq-summarize papers into research_summary + research_areas
    Returns a fully enriched dict ready to store in the JSON database.
    """
    directory_url = person['profile_url']
    personal_url = ''
    email = ''

    if direct_link:
        personal_url = directory_url
    else:
        resp = _get(directory_url)
        if resp:
            dir_soup = BeautifulSoup(resp.text, 'html.parser')
            personal_url = _find_personal_website(dir_soup, directory_url)
            email = _extract_email_from_page(dir_soup)

    if personal_url and personal_url != directory_url:
        print(f"    -> {personal_url}")
        personal_resp = _get(personal_url)
        if personal_resp and not email:
            email = _extract_email_from_page(BeautifulSoup(personal_resp.text, 'html.parser'))

    # Scholar search — source of truth for research topics
    papers = []
    research_summary = ''
    research_areas = []
    try:
        scholar_results = _serper_scholar_search(person['name'], university)
        raw_papers, papers_text = _format_scholar_papers(scholar_results)
        if not email:
            email = _extract_email_from_scholar(scholar_results) or ''

        if papers_text:
            groq_result = _call_groq_summarize(person['name'], university, papers_text)
            time.sleep(3)  # stay well under Groq's daily token limit
            research_summary = groq_result.get('research_summary', '')
            research_areas = groq_result.get('research_areas', [])
            papers = [
                {
                    'title': p.get('title', ''),
                    'year': p.get('year', ''),
                    'one_line_summary': p.get('one_line_summary', ''),
                }
                for p in groq_result.get('papers', raw_papers)[:5]
                if isinstance(p, dict)
            ]
    except Exception as e:
        print(f"  [enrich] FAILED for {person['name']}: {e}")

    return {
        'name': person['name'],
        'url': personal_url or directory_url,
        'directory_url': directory_url if not direct_link else '',
        'university': university,
        'type': person_type,
        'papers': papers,
        'research_summary': research_summary,
        'research_areas': research_areas,
        'email': email,
    }


def scrape_university(key: str, skip_names: set = None) -> list[dict]:
    config = UNIVERSITY_CONFIGS[key]
    display_name = config['display_name']
    skip_names = skip_names or set()

    print(f"\n{'='*50}")
    print(f"Scraping {display_name}")
    print(f"{'='*50}")

    all_people = []
    seen_names = set()

    def _add(people, person_type):
        for p in people:
            key_name = p['name'].lower()
            if key_name not in seen_names:
                seen_names.add(key_name)
                p['type'] = person_type
                all_people.append(p)

    for source in config.get('faculty_sources', []):
        _add(_collect_links(source), 'Faculty')

    for source in config.get('phd_sources', []):
        if source.get('type') == 'serper':
            _add(_collect_phd_via_serper(source['serper_query']), 'PhD Student')
        else:
            _add(_collect_links(source), 'PhD Student')

    print(f"\n[scrape] {len(all_people)} unique people to enrich")

    enriched = []
    for i, person in enumerate(all_people, 1):
        person_type = person.pop('type')
        # direct_link: profile_url is already the personal site (no directory hop)
        direct = person_type == 'PhD Student' and any(
            source.get('direct_links')
            for source in config.get('phd_sources', [])
            if source.get('type') != 'serper'
        )
        if person['name'].lower() in skip_names:
            print(f"  [{i}/{len(all_people)}] [skip] {person['name']}")
            continue
        print(f"  [{i}/{len(all_people)}] [{person_type}] {person['name']}")
        result = _build_profile(person, display_name, person_type, direct_link=direct)
        enriched.append(result)
        time.sleep(0.5)

    print(f"\n[scrape] Done. {len(enriched)} people saved.")
    return enriched


def main():
    parser = argparse.ArgumentParser(description='Build professor/PhD-student database')
    parser.add_argument('--university', required=True,
                        choices=list(UNIVERSITY_CONFIGS.keys()))
    parser.add_argument('--out', default=None)
    args = parser.parse_args()

    out_path = args.out or os.path.join(
        os.path.dirname(__file__), 'data', f'{args.university}.json'
    )

    # Load already-processed people so we can skip them on resume
    existing = []
    if os.path.exists(out_path):
        with open(out_path) as f:
            existing = json.load(f)
        print(f"[resume] Found {len(existing)} already processed — will skip them")

    already_done = {p['name'].lower() for p in existing}
    people = scrape_university(args.university, skip_names=already_done)
    people = existing + people  # merge old + new

    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, 'w') as f:
        json.dump(people, f, indent=2)

    print(f"\n[done] Saved {len(people)} people to {out_path}")


if __name__ == '__main__':
    main()
