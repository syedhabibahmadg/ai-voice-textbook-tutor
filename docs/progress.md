# Verified checkpoint — 18 November 2026

- Signed standalone Android APK built locally: `AI-Voice-Textbook-Tutor-v0.1.0.apk`; contains the Hermes app bundle and passes APK v2 signature verification. Server key is excluded. Android 13 emulator install and navigation passed.
- Voice conversation: tap once, speak, pause about 1 second, receive a spoken reply, then listen again. End button, navigation and backgrounding stop capture. Language controls are in Settings and persist on the device. Text response button reveals question/answer history.
- Interruption: Android voice-communication capture requests hardware echo cancellation where available; sustained nearby speech stops TTS and preserves the new question. Server trims prior playback audio before Whisper. Four voice-activity tests pass; physical-phone speaker echo and threshold tuning remain unverified. Interrupt reply button provides a manual path.
- Class 11 English-medium sources: Computer 144 pages/343 chunks, English 168/412, Math 312/603, Chemistry 344/828. Total 968 pages/2,186 chunks. Computer and scanned pages use full-page English OCR at 180 DPI, up to four workers. All four answer real whole-book questions with Groq and verified original PDF citations. Drive Class 11 folder was listed again and contains these four English-medium books plus Urdu/Islamiat; no Class 11 Physics/Biology PDFs were present there.
- Whole-book retrieval: chapter=null searches all chapters of the selected book. Conversational stop words, simple inflections, Urdu terms and optional Groq query translation reduce false misses. Definition headings are prioritized. Cached book indexes invalidate on fingerprint changes. Grade/book isolation remains enforced.
- Real Groq whole-book checks: Computer English and Roman Urdu (PDF46), Chemistry (PDF12), English (PDF5), Math (PDF4), all generated and grounded. Five warm server request samples took 672–1,047 ms; these exclude recording, silence detection and device TTS. Cold requests and network conditions vary.
- Whisper large-v3-turbo recognized the English question after the server trimmed a 2-second prefix; complete transcription request 1,047 ms. Mono 16kHz/32kbps capture reduces uploads. Groq SDK client connections are reused; generated answers are kept brief. Urdu audio accuracy is not yet evaluated.
- Citation source IDs and quotes are checked. Unicode hyphens, quotation marks and ligatures are normalized so typography alone does not reject valid evidence; changed factual words still fail validation. Real Groq response inspections confirmed this fix.
- Backend: 13 tests pass; voice activity: 4 pass; TypeScript passes. Test artifacts remain in the local outputs directory. Physical phone full-duplex voice interruption is not claimed tested.
- Windows start_server.bat serves 0.0.0.0:8000 and prints the current LAN URL. backend/.env is ignored and contains the local key only. No firewall disabling or internet exposure was introduced.
- Other classes and Class 11 Urdu/Farsi/Islamiat are deferred under the user's narrowed scope. Qwen3-4B weights were not downloaded; Ollama fallback remains optional.

Remaining: physical-device echo/interruption evaluation, Urdu speech evaluation, later non-English books/other classes, quizzes/progress and production hardening.


## 23 November: supplied local PDFs and Urdu voice
- Computer/English PDFs in Downloads match indexed sources byte-for-byte. Added supplied Physics and Biology PDFs with local source IDs and PDF citation routes; both indexed with English OCR. Real Groq answers passed for Physics physical quantities (PDF5) and Biology homeostasis (PDF51).
- Added Edge TTS Urdu playback with exact ur-PK-AsadNeural voice. Real Urdu audio sample generated (70,416 bytes). Urdu questions use the Urdu STT hint; the tutoring prompt requests easy Urdu script suitable for a child. Other response languages retain device speech.
- Audio rendering has bounded concurrency, timeout and a bounded ten-minute memory cache. Urdu audio uses the server URL rather than requiring an installed device Urdu voice.
- Supplied exact quote hints reduce OCR-induced citation validation failures without accepting invented source IDs or altered quote words.
- APK version 0.1.1 / Android version code 2. Physical-phone Edge playback and speaker interruption still require device evaluation.
