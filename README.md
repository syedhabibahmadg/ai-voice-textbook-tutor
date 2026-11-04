# AI Voice-Based Textbook Learning Assistant

Flutter Android app + FastAPI backend for textbook-grounded voice learning for Classes 9–12.

## Planned features
- Class, subject, textbook and chapter selection
- Textbook-based RAG question answering with source citations
- Speech-to-text and text-to-speech
- Quizzes, summaries and learning progress

**Status:** Initial scaffold only. AI, speech and ingestion features are not implemented yet.

## Project structure
- `mobile/` — Flutter starter UI
- `backend/` — FastAPI health-check service
- `rag/` — planned retrieval and ingestion pipeline
- `docs/` — architecture notes
- `tests/` — API tests
- `.github/workflows/ci.yml` — basic CI

## Backend setup
```bash
cd backend
python -m venv .venv
# Activate virtual environment
pip install -r requirements.txt
uvicorn app.main:app --reload
```

## Flutter setup
```bash
cd mobile
flutter create --project-name voice_textbook_tutor .
flutter pub get
flutter run
```

Do not commit API keys, student data or unauthorized textbook PDFs.
