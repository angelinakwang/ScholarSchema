from pymongo import MongoClient
import certifi
from dotenv import load_dotenv
import os
import hashlib
from datetime import datetime, timedelta

load_dotenv()

# Lazy Mongo: avoid connecting at import; skip cache if URI missing or unreachable.
_mongo_coll = None  # None = not tried, False = unavailable, else collection


def _cache_collection():
    global _mongo_coll
    if _mongo_coll is False:
        return None
    if _mongo_coll is not None:
        return _mongo_coll
    uri = (os.getenv('MONGODB_URI') or '').strip()
    if not uri:
        _mongo_coll = False
        return None
    try:
        client = MongoClient(
            uri,
            tlsCAFile=certifi.where(),
            serverSelectionTimeoutMS=5000,
        )
        client.admin.command('ping')
        _mongo_coll = client['researchmatch']['search_cache']
        return _mongo_coll
    except Exception as e:
        print(f"[cache] MongoDB disabled: {e}")
        _mongo_coll = False
        return None


def make_cache_key(university: str, interests: str) -> str:
    raw = f"{university.lower().strip()}:{interests.lower().strip()}"
    return hashlib.md5(raw.encode()).hexdigest()


def get_cached_results(university: str, interests: str):
    coll = _cache_collection()
    if coll is None:
        return None
    try:
        key = make_cache_key(university, interests)
        doc = coll.find_one({'_id': key})
        if not doc:
            return None
        if datetime.utcnow() - doc['created_at'] > timedelta(days=7):
            coll.delete_one({'_id': key})
            return None
        print(f"[cache] HIT for {university} {interests}")
        return doc['results']
    except Exception as e:
        print(f"[cache] read error: {e}")
        return None


def save_results(university: str, interests: str, results: list):
    coll = _cache_collection()
    if coll is None:
        return
    try:
        key = make_cache_key(university, interests)
        coll.replace_one(
            {'_id': key},
            {
                '_id': key,
                'university': university,
                'interests': interests,
                'results': results,
                'created_at': datetime.utcnow(),
            },
            upsert=True,
        )
        print(f"[cache] SAVED {len(results)} results for {university} {interests}")
    except Exception as e:
        print(f"[cache] write error: {e}")
