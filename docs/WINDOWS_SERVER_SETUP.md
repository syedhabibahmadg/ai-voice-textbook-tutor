# Windows laptop server

1. Run `setup_server.bat` once. It prefers Python 3.11, creates `.venv`, installs only backend packages, and creates `backend/.env` from the example. No models are downloaded. Existing `data/raw` and `data/processed` are preserved.
2. Edit `backend/.env` locally. Never put a Groq key in the app or Git. Set `AI_PROVIDER=groq`, `GROQ_API_KEY=...`. Run `.venv\Scripts\python -m backend.app.ai_models` to query the official Models API, then set `GROQ_MODEL` to a returned production chat model ID. Leave the key empty for extractive fallback.
3. Double-click `start_server.bat`. Keep its console open. It shows the current LAN URL, listens on `0.0.0.0:8000`, logs to `data/logs`, and checks for an existing listener. Startup never installs packages.
4. On each phone, open Settings, enter the displayed laptop URL, and tap **Test connection and save**. Address changes never require rebuilding the APK.

`AI_PROVIDER` supports `groq`, `ollama`, `auto`, and `extractive`. Auto defaults to Groq -> configured Ollama -> extractive; explicit Groq uses extractive when unavailable. Provider failures are sanitized. SDK inference retries are disabled to avoid duplicating a potentially billed request after a timeout; model discovery GET retries once. No retry/provider switch is made merely because the model abstains. Invalid generated source IDs/quotes are rejected and replaced with labeled extractive evidence.

Response metadata includes provider, model, latency, token usage where available, fallback reason and server-owned citations. Only up to three retrieved passages and four short previous questions are sent to Groq. No entire PDF is uploaded. Quote validation checks that the declared evidence exists; it is not a guarantee that every generated claim is entailed. Evaluate educational accuracy before deployment.

Optional Ollama: set `OLLAMA_BASE_URL` and an **already installed** `OLLAMA_MODEL`. No pull/install is automatic. Qwen3-4B is optional. Inspect RAM, disk, driver and VRAM first (`Get-CimInstance Win32_ComputerSystem`, `Get-PSDrive C`, `nvidia-smi`, `ollama list`). A suitable candidate is the official `qwen3:4b` quantized tag; verify its manifest/resources before provisioning. This run does not assume CUDA or install model weights.

Groq STT uses configurable `GROQ_STT_MODEL=whisper-large-v3` only after Models API verification. Install FFmpeg separately and put `ffprobe` on PATH. Accepted uploads are at most 20 MiB and 120 seconds, decoded by ffprobe; temporary audio is deleted. Recording uploads go from phone to laptop to Groq. English/Urdu transcription requires a key and actual evaluation. Device TTS operates independently, with installed-voice checks and sentence-level pause/resume.

Use `/api/v1/ai/status?check=true` to verify non-sensitive provider readiness. A successful model-list request means model availability, not successful inference. A key must be configured locally before real Groq inference can be tested.
