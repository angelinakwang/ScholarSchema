def draft_email(professor: dict, resume_text: str) -> str:
    name = professor.get('name', 'Professor')
    return f"Dear {name},\n\nI am interested in your research and would love to connect.\n\nBest regards,"
