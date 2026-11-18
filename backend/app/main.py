from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from .catalog import books, search
from rag.ingest import connect
from .providers import generate, retrieval_terms, status as ai_status
from .speech import router as speech_router
import os
import re
from contextlib import closing

app = FastAPI(
    title="AI Voice Textbook Tutor API",
    version="0.1.0",
    description="Textbook catalog, chapter-filtered retrieval and cited tutoring.",
)
app.add_middleware(CORSMiddleware, allow_origins=['http://localhost:8081'], allow_methods=['GET', 'POST'], allow_headers=['Content-Type'])
app.include_router(speech_router)

@app.get('/api/v1/grades')
def grades():
    return sorted({b['grade'] for b in books()})

@app.get('/api/v1/subjects')
def subjects(grade: int):
    return sorted({b['subject'] for b in books() if b['grade'] == grade})

@app.get('/api/v1/textbooks')
def textbooks(grade: int, subject: str):
    return [b for b in books() if b['grade'] == grade and b['subject'] == subject]

@app.get('/api/v1/chapters')
def chapters(textbook: str):
    if not any(b['id'] == textbook for b in books()):
        raise HTTPException(404, 'Textbook not found')
    with closing(connect()) as db:
        result = [dict(r) for r in db.execute('SELECT chapter AS id, MIN(page) AS page_start, MAX(page) AS page_end FROM chunks WHERE book_id=? GROUP BY chapter', (textbook,))]
    return sorted(result, key=lambda ch: (not ch['id'].isdigit(), int(ch['id']) if ch['id'].isdigit() else ch['id']))

class Question(BaseModel):
    grade: int = Field(ge=9, le=12)
    subject: str = Field(min_length=1, max_length=100)
    textbook: str
    chapter: str | None = None
    query: str = Field(min_length=1, max_length=2000)
    language: str = Field(default='English', pattern='^(English|Urdu|Roman Urdu)$')
    history: list[str] = Field(default_factory=list, max_length=4)

@app.post('/api/v1/search')
def retrieve(q: Question):
    book = next((b for b in books() if b['id'] == q.textbook), None)
    if not book:
        raise HTTPException(404, 'Textbook not found')
    if book['grade'] != q.grade or book['subject'] != q.subject:
        raise HTTPException(422, 'Grade/subject does not match textbook')
    if not q.query.strip():
        raise HTTPException(422, 'Question cannot be blank')
    try:
        retrieval_query=q.query
        if q.history and re.search(r'(?i)\b(it|that|more|again|further|iska|is\s+ko)\b',q.query) and len(q.query.split())<12:
            retrieval_query=q.history[-1][:1000]+' '+q.query
        hits = search(retrieval_query, q.textbook, q.chapter)
        if not hits:
            keywords=retrieval_terms(retrieval_query)
            if keywords: hits=search(keywords,q.textbook,q.chapter)
    except Exception:
        raise HTTPException(503, 'Retrieval provider unavailable. Check the local index and configured model.')
    return {'passages': [{**h, 'grade':book['grade'], 'subject':book['subject'], 'title': book['title'], 'source_url': f"https://drive.google.com/file/d/{q.textbook}/view#page={h['page']}"} for h in hits], 'mode': 'semantic' if os.getenv('TUTOR_EMBED_MODEL') else 'lexical'}

@app.post('/api/v1/chat')
def chat(q: Question):
    result = retrieve(q)
    passages = result['passages']
    try:
        answer = generate(q.query, passages, q.language, [h[:1000] for h in q.history])
    except Exception:
        raise HTTPException(503, 'Answer provider unavailable; use the search endpoint or disable the optional LLM')
    return answer

@app.get('/api/v1/ai/status')
def provider_status(check: bool = False):
    return ai_status(check)

@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
