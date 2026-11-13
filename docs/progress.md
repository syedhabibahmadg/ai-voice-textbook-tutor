# Verified checkpoint — 13 November 2026

- Groq official Models API: live authenticated success; `openai/gpt-oss-20b` and `whisper-large-v3` were returned. Key is in ignored backend/.env only.
- Live generated Chemistry Chapter 1 answer: Groq response validated with original PDF page 12. Measured sample response 1.11 seconds; actual latency varies. English and Roman Urdu generation passed. Unknown-question abstention passed.
- Live English Whisper upload/transcription: HTTP 200, recognized “What is ionization energy?” from a 1.93-second Windows-generated English audio sample. Urdu audio accuracy has not been evaluated.
- Two simultaneous live Groq clients: passed. Thread-safe per-request context; no shared student conversation state. Generated source IDs/quotes are checked against retrieved chunks; invalid evidence returns labeled extractive fallback.
- Backend suite: 10 passed in the isolated Python 3.11 environment. Includes mocked generation, citation rejection, failure fallback, no-evidence/no-charge, status/speech errors, and concurrent clients.
- Mobile TypeScript: passed. Persistent server URL, test/save/reconnect, provider metadata, editable transcript and device TTS controls implemented. Standalone native APK compilation is in progress; final artifact/device evidence will be added after build verification.
- setup_server.bat actually created .venv and installed declared dependencies. start_server.bat actually started FastAPI at 0.0.0.0:8000 and printed Wi-Fi URL. Duplicate listener prevention was tested.
- Hardware inspected: Windows, 31.9 GiB RAM, GTX 1660 Ti / 6144 MiB VRAM, driver 517.00. Ollama reachable; qwen3:1.7b installed (1.4 GB), requested Qwen3-4B is not installed. No weights downloaded and no CUDA support claimed.
- Content unchanged: Chemistry 11 (344 pages/828 chunks); English 12 (498 searchable chunks, partial OCR pending); Urdu 9 (144 scanned pages, no chunks). 31 whole-book candidates + 22 chapter fragments inventoried; remaining downloads not falsely marked indexed.

Remaining: actual APK completion/inspection/emulator flow; Urdu speech evaluation, Qwen3-4B provisioning only with approval, general multilingual retrieval evaluation, full-corpus ingestion/OCR, quizzes/summaries/history and production hardening. See NEXT_STEPS.md.
