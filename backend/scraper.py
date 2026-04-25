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


def _is_person_name(text: str) -> bool:
    """True only if text looks like a first + last name (2-3 capitalized words)."""
    words = text.strip().split()
    if len(words) < 2 or len(words) > 3:
        return False
    # Every word must start with a capital letter
    if not all(w[0].isupper() for w in words):
        return False
    # No word should be a non-name word
    non_names = {
        'faculty', 'research', 'home', 'page', 'lab', 'back', 'next',
        'more', 'contact', 'all', 'list', 'view', 'here', 'click',
        'professor', 'department', 'center', 'institute', 'university',
        'the', 'and', 'for', 'new', 'about',
    }
    if any(w.lower() in non_names for w in words):
        return False
    return True


def _extract_faculty_links(page_url: str, profile_base: str) -> list[dict]:
    """
    Scrape a faculty listing page and return a list of
    {'name': str, 'profile_url': str} dicts.

    Only follows links whose anchor text IS the professor's name —
    these are the personal/profile website links on faculty listing pages.
    """
    print(f"\n[list] Fetching {page_url}")
    resp = _get(page_url)
    if not resp:
        return []

    soup = BeautifulSoup(resp.text, 'html.parser')
    faculty = []
    seen_urls = set()

    for a in soup.find_all('a', href=True):
        href = a['href'].strip()
        name = a.get_text(strip=True)

        if not _is_person_name(name):
            continue

        # Build absolute URL
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


def _find_personal_website(soup: BeautifulSoup, directory_url: str) -> str:
    """
    Given the parsed HTML of a university directory profile page, find the
    link that points to the professor's actual personal website.

    Strategy: look for links labelled with common personal-site labels first,
    then fall back to the first external link that isn't a known aggregator.
    """
    directory_host = directory_url.split('/')[2]  # e.g. www2.eecs.berkeley.edu

    personal_labels = {
        'home page', 'homepage', 'personal website', 'personal page',
        'website', 'web page', 'webpage', 'personal site', 'faculty page',
        'visit website', 'lab website', 'lab page',
    }
    # Sites that are NOT the professor's personal website
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
        # Skip same-domain links and known aggregators
        if host == directory_host:
            continue
        if any(agg in host for agg in aggregator_hosts):
            continue

        label = a.get_text(strip=True).lower()
        if label in personal_labels:
            return href          # high-confidence match, return immediately
        candidates.append(href)

    # Fall back to first remaining external link
    return candidates[0] if candidates else ''


def _extract_profile(professor: dict, university_display: str) -> dict | None:
    """
    Visit a professor's directory page, follow the link to their personal
    website, and extract research interests + email from the personal site.
    """
    directory_url = professor['profile_url']
    resp = _get(directory_url)
    if not resp:
        return {
            'name': professor['name'],
            'url': directory_url,
            'university': university_display,
            'research_interests': '',
            'email': '',
            'department': '',
        }

    dir_soup = BeautifulSoup(resp.text, 'html.parser')

    # Step 1: find the personal website URL from the directory page
    personal_url = _find_personal_website(dir_soup, directory_url)

    # Step 2: fetch the personal site for richer research interest text
    if personal_url:
        print(f"    -> personal site: {personal_url}")
        personal_resp = _get(personal_url)
        soup = BeautifulSoup(personal_resp.text, 'html.parser') if personal_resp else dir_soup
    else:
        soup = dir_soup

    text = soup.get_text(separator=' ', strip=True)

    # Extract research interests from common section headings
    research_interests = ''
    patterns = [
        r'[Rr]esearch [Ii]nterests?[:\s]+([^.]{20,400})',
        r'[Rr]esearch [Aa]reas?[:\s]+([^.]{20,400})',
        r'[Rr]esearch [Ff]ocus[:\s]+([^.]{20,400})',
        r'[Ww]orks? on[:\s]+([^.]{20,400})',
        r'[Ii]nterests?[:\s]+([^.]{20,400})',
    ]
    for pattern in patterns:
        match = re.search(pattern, text)
        if match:
            research_interests = match.group(1).strip()
            break

    if not research_interests:
        meta = soup.find('meta', attrs={'name': 'description'})
        if meta and meta.get('content'):
            research_interests = meta['content'][:400]

    email_match = re.search(r'[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}', text)
    email = email_match.group(0) if email_match else ''

    dept_match = re.search(
        r'(Electrical Engineering|Computer Science|EECS|Statistics|Mathematics)',
        text
    )
    department = dept_match.group(0) if dept_match else 'EECS'

    return {
        'name': professor['name'],
        'url': personal_url or directory_url,  # personal site if found, else directory page
        'directory_url': directory_url,
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
