from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from .catalog import books, search
from rag.ingest import connect
from .providers import generate
import os

app = FastAPI(
    title="AI Voice Textbook Tutor API",
    version="0.1.0",
    description="Textbook catalog, chapter-filtered retrieval and cited tutoring.",
)
app.add_middleware(CORSMiddleware, allow_origins=['http://localhost:8081'], allow_methods=['GET', 'POST'], allow_headers=['Content-Type'])

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
    with connect() as db:
        result = [dict(r) for r in db.execute('SELECT chapter AS id, MIN(page) AS page_start, MAX(page) AS page_end FROM chunks WHERE book_id=? GROUP BY chapter', (textbook,))]
    return sorted(result, key=lambda ch: (not ch['id'].isdigit(), int(ch['id']) if ch['id'].isdigit() else ch['id']))

class Question(BaseModel):
    grade: int = Field(ge=9, le=12)
    subject: str = Field(min_length=1, max_length=100)
    textbook: str
    chapter: str | None = None
    query: str = Field(min_length=1, max_length=2000)

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
        hits = search(q.query, q.textbook, q.chapter)
    except Exception:
        raise HTTPException(503, 'Retrieval provider unavailable. Check the local index and configured model.')
    return {'passages': [{**h, 'title': book['title'], 'source_url': f"https://drive.google.com/file/d/{q.textbook}/view#page={h['page']}"} for h in hits], 'mode': 'semantic' if os.getenv('TUTOR_EMBED_MODEL') else 'lexical'}

@app.post('/api/v1/chat')
def chat(q: Question):
    result = retrieve(q)
    passages = result['passages']
    try:
        answer = generate(q.query, passages) if passages else 'No supporting passage found in the selected textbook and chapter.'
    except Exception:
        raise HTTPException(503, 'Answer provider unavailable; use the search endpoint or disable the optional LLM')
    return {'answer': answer, 'grounded': bool(passages), 'citations': passages[:2], 'mode': 'textbook_evidence'}

@app.post('/api/v1/speech/transcribe')
@app.post('/api/v1/speech/synthesize')
def speech_unavailable():
    raise HTTPException(501, 'Optional speech provider is not configured. Use text input and device speech playback.')


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
