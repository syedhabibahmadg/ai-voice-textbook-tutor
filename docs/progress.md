# Verified prototype checkpoint — 13 November 2026

Implemented: Expo SDK 54 + React Native 0.81.5 + TypeScript mobile navigation, real catalog/chapter requests, typed tutor chat and source-page cards; microphone recording, local replay and device speech controls. API host follows the Expo LAN host unless overridden by EXPO_PUBLIC_API_URL or Settings. FastAPI provides strict textbook-context validation, filtered search, extractive answers and abstention.

Validation actually run:
- Backend: 3 focused tests passed.
- Live HTTP catalog -> Class 11 -> Chemistry -> Chapter 1 -> ionization energy definition: passed over localhost and PC Wi-Fi IP; first citation PDF page 12.
- Real Class 12 English retrieval: passed, PDF page 107 (chapter mapping inferred, needs review).
- TypeScript: passed. Android Hermes export: passed. Metro Android manifest: HTTP 200.
- Physical Android/emulator execution and microphone/audio end-to-end: NOT run; no device/emulator was available.

Content: 31 whole-book candidates discovered plus 22 Urdu chapter fragments inventoried separately. Chemistry Class 11: 344 pages, 828 indexed chunks. English Class 12: 498 indexed chunks, partial OCR pending. Class 9 Urdu: 144 scanned pages, zero searchable chunks, OCR pending. Remaining PDFs are awaiting completed downloads; partial files are rejected. Current source/processing snapshot is docs/INGESTION_STATUS.json. Textbook contents and indexes are local only and excluded from Git.

This is an extractive prototype, not the complete SRS MVP. Optional ChromaDB/local-model and LangChain/Ollama adapters are implemented but not runtime validated. Urdu Tesseract data is absent. STT endpoints explicitly report unavailable; no claim of functioning transcription. Quizzes, summaries, history, numerical tutoring and evaluated multilingual generation remain pending.
