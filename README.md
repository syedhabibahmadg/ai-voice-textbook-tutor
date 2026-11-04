# AI Voice-Based Textbook Learning Assistant

React Native (Expo) Android app + FastAPI backend for textbook-grounded voice learning for Classes 9–12.

## Planned features
- Class, subject, textbook and chapter selection
- Textbook-based RAG question answering with source citations
- Speech-to-text and text-to-speech
- Quizzes, summaries and learning progress

**Status:** Initial scaffold only. AI, speech and ingestion features are not implemented yet.

## Project structure
- `mobile/` — React Native + Expo starter UI
- `backend/` — FastAPI health-check service
- `rag/` — planned retrieval and ingestion pipeline
- `docs/` — architecture notes
- `tests/` — API tests
- `.github/workflows/ci.yml` — backend and mobile CI

## Backend setup
```bash
cd backend
python -m venv .venv
# Activate virtual environment
pip install -r requirements.txt
uvicorn app.main:app --reload
```

## Mobile setup
Install Node.js LTS, then:
```bash
cd mobile
npm install
npx expo start
```
Run on Android with Expo Go or an emulator. This is a starter screen, not a connected AI tutor.

Do not commit API keys, student data or unauthorized textbook PDFs.
