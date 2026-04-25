import requests
import json

response = requests.post('http://127.0.0.1:5001/api/search', data={
    'university': 'UCLA',
    'interests': 'machine learning, healthcare',
    'resume_text': '''
    Computer Science student at UCLA. 
    Experience: Research intern at hospital building 
    ML models for patient readmission prediction using Python, 
    scikit-learn, pandas. Coursework in machine learning, 
    statistics, databases. GPA 3.8.
    '''
})

data = response.json()
for prof in data.get('results', []):
    print(f"\n{'='*50}")
    print(f"Name: {prof.get('name')}")
    print(f"URL: {prof.get('profile_url')}")
    print(f"Score: {prof.get('match_score')}")
    print(f"Reason: {prof.get('match_reason')}")
    print(f"Summary: {prof.get('research_summary')[:100]}")