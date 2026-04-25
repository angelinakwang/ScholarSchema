from pymongo import MongoClient
import certifi
from dotenv import load_dotenv
import os
import hashlib
import json
from datetime import datetime, timedelta

load_dotenv()

client = MongoClient(
    os.getenv('MONGODB_URI'),
    tlsCAFile=certifi.where()
)
db = client['researchmatch']
cache = db['search_cache']


def make_cache_key(university: str, interests: str) -> str:
    raw = f"{university.lower().strip()}:{interests.lower().strip()}"
    return hashlib.md5(raw.encode()).hexdigest()


def get_cached_results(university: str, interests: str):
    key = make_cache_key(university, interests)
    doc = cache.find_one({'_id': key})
    if not doc:
        return None
    # Check if cache is older than 7 days
    if datetime.utcnow() - doc['created_at'] > timedelta(days=7):
        cache.delete_one({'_id': key})
        return None
    print(f"[cache] HIT for {university} {interests}")
    return doc['results']


def save_results(university: str, interests: str, results: list):
    key = make_cache_key(university, interests)
    cache.replace_one(
        {'_id': key},
        {
            '_id': key,
            'university': university,
            'interests': interests,
            'results': results,
            'created_at': datetime.utcnow()
        },
        upsert=True
    )
    print(f"[cache] SAVED {len(results)} results for {university} {interests}")
