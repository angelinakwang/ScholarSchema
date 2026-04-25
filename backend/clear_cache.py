from pymongo import MongoClient
from dotenv import load_dotenv
import certifi
import os

load_dotenv()

client = MongoClient(os.getenv('MONGODB_URI'), tlsCAFile=certifi.where())
db = client['researchmatch']
result = db['search_cache'].delete_many({})
print(f"Deleted {result.deleted_count} cached entries")