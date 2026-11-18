# AI Voice Textbook Tutor

React Native + Expo SDK 54 Android app and a Windows-hosted FastAPI textbook server. Continue on `feat/android-textbook-prototype`.

## Windows server

Run `setup_server.bat` once, then `start_server.bat`. Setup prefers Python 3.11, creates `.venv`, installs backend dependencies and creates a backend-only `.env`. Start prints the laptop LAN URL and listens on port 8000; it does not reinstall packages or download models. Authorized textbooks and indexes remain under local `data/`.

For Groq, edit `backend/.env` locally, set `GROQ_API_KEY`, and run:

```powershell
.venv\Scripts\python -m backend.app.ai_models
```

Choose a returned production chat model as `GROQ_MODEL`; use `AI_PROVIDER=groq` or `auto`. `AI_PROVIDER=extractive` works without a paid key. `ollama` uses a caller-provisioned model only. Never put keys in the APK, source, or an EXPO_PUBLIC variable. No real Groq inference is claimed without a configured key and successful request.

## Android app

Install the standalone APK when listed in the build evidence. Expo Go and Metro are not needed for a release APK. Open Settings, enter the URL printed by the laptop launcher, and tap **Test connection and save**. Every request uses that per-device saved URL. Reconnect/change IP without rebuilding. Keep devices on trusted Wi-Fi and allow port 8000 only on a Private Windows network.

Choose Class 11 -> Chemistry -> Chapter 1 and ask “What is ionization energy?” The validated extractive definition references **original PDF page 12**. Class 12 English is partially indexed. Unindexed books show **Not ready** and cannot be selected. Citations are backend-owned chunk/page metadata; generated source IDs and supporting quotes are checked against retrieved evidence. Such validation is not a complete semantic entailment guarantee.

Groq audio transcription uploads go through the laptop, with bounded type/size/duration checks and temporary file cleanup. Review/edit the transcript before submitting. A configured Groq key and FFmpeg/ffprobe are required. English/Urdu recognition quality must be evaluated; no real recognition is claimed from mock tests. Device TTS requires an installed compatible voice and supports sentence-level pause/resume/replay independently of the AI provider.

See [Android build/install](docs/ANDROID_APK_SETUP.md), [Windows/Groq setup](docs/WINDOWS_SERVER_SETUP.md), [LAN troubleshooting](docs/NETWORK_TROUBLESHOOTING.md), [verified progress](docs/progress.md), and [remaining tasks](docs/NEXT_STEPS.md).

## Developer validation

```powershell
$env:PYTHONPATH=".;backend"
.venv\Scripts\python -m pytest tests -q
.venv\Scripts\python tests/smoke_live.py
cd mobile
npm ci --legacy-peer-deps
npm run typecheck
cd ..
.venv\Scripts\python scripts/build_apk.py
```

The build script generates an ignored private preview signing key under `.private`. Back it up securely for APK updates. It builds a standalone signed release APK, not an AAB or Expo Go client. The EAS preview alternative is configured in `mobile/eas.json` but requires EAS login. LAN HTTP is enabled only in preview configuration; production disables cleartext and requires HTTPS.

## Textbook ingestion

31 whole-book candidates and 22 Urdu chapter fragments are inventoried in `rag/manifest.json` and `rag/source-fragments.json`. **Two books currently contain searchable chunks:** Chemistry 11 (344 pages/828 chunks) and partial English 12 (498 chunks). Urdu 9 has 144 scanned pages queued for OCR, not searchable text. Remaining sources are awaiting completed downloads. `docs/INGESTION_STATUS.json` is a snapshot; the runtime catalog overlays local index status.

Authorized local PDFs use `data/raw/<Drive ID>.pdf`. Ingestion is independent of the app:

```powershell
.venv\Scripts\python -m rag.ingest --pdf-dir data/raw
```

Extraction caches per source/config hash, skips unchanged books, rejects wrong-size downloads, preserves PDF page numbers, queues scans, and atomically replaces book chunks. Chemistry chapter starts were reviewed against the PDF contents. Other chapter mappings are inferred and need review. Optional Tesseract OCR uses already-installed language data via `TUTOR_OCR_LANG`; Urdu language data is not provisioned automatically.

Repeatable paginated Drive import requires a caller-supplied short-lived OAuth token with read access:

```powershell
$env:GOOGLE_DRIVE_ACCESS_TOKEN="YOUR_SHORT_LIVED_TOKEN"
.venv\Scripts\python -m rag.drive --root 1_3AwlceIQ_g4VdSaiWabV06FSsc7kZpb --download-dir data/raw
Remove-Item Env:GOOGLE_DRIVE_ACCESS_TOKEN
```

Optional semantic retrieval uses `backend/requirements-rag.txt`, caller-provisioned local multilingual sentence-transformers weights, `TUTOR_EMBED_MODEL`, and `python -m rag.vectors`. ChromaDB embeddings are batched/cached and filtered by book/chapter. The default lexical retrieval path remains available; a small bilingual technical glossary is not general Urdu translation. No model weights, PDFs, vector databases, secrets or signing credentials are committed.

This is a prototype. Quizzes, summaries, student history/progress, full-corpus OCR, robust multilingual evaluations, authentication, public deployment and production hardening remain outside the verified checkpoint.

### Voice conversation and Class 11 books
Select Class 11, a subject and **Talk about the whole book**, or choose an individual chapter. Computer, English, Math and Chemistry are indexed locally (968 pages, 2,186 chunks). Other books remain marked as preparing.

Tap **Tap to talk** once, ask a question and pause about one second. The tutor replies aloud and listens again. Speak during a reply to interrupt it; **Interrupt reply** also starts a new question manually. Android requests device echo cancellation, but speaker echo behavior must still be tested on a physical phone. **End conversation**, leaving the screen or backgrounding the app stops the microphone. Questions are capped at 30 seconds; 10 seconds without speech ends listening.

**Text response** reveals the transcript and answer. English, Urdu and Roman Urdu preferences are in **Settings**, saved on this phone. Audio goes through the laptop to Groq. Speech output requires a compatible device voice.

The server uses cached whole-book indexes, brief generated replies and reusable Groq connections. Five verified warm Groq whole-book samples took 0.67–1.05 seconds on the server; the full voice cycle also includes the silence pause, transcription and device playback. Whisper turbo and mono 16kHz capture reduce transcription overhead.

To rebuild only these indexes with installed English OCR data: set `TUTOR_OCR_LANG=eng`, then run `python -m rag.ingest --pdf-dir data/raw --grade 11 --subjects Computer English Math Chemistry`. OCR uses 180 DPI and up to four workers. PDF files, indexes and credentials stay outside Git.
