# Windows development setup

From the repository root in PowerShell (Python 3.10+ and Node 22):

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r backend/requirements.txt
$env:PYTHONPATH=".;backend"
python -m rag.ingest --pdf-dir data/raw
python -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8000
```

Put authorized PDFs in `data/raw/<Drive file ID>.pdf`. `rag/manifest.json` contains the discovered grade/subject assignments. Ingestion does not require the mobile app. Downloads must finish before ingestion; use a temporary extension and atomic rename. Never commit PDFs, models, tokens or `data/processed`.

In another PowerShell terminal:

```powershell
cd mobile
npm ci --legacy-peer-deps
npx expo start
npm run typecheck
```

Use Settings to enter `http://YOUR_PC_LAN_IP:8000` for a physical device; Android emulator default is `http://10.0.2.2:8000`. Local HTTP is development only. Production requires HTTPS and an appropriate network policy. Audio recording and device TTS need device testing; recordings stay in the device cache and are never uploaded.

```powershell
$env:PYTHONPATH=".;backend"
python -m pytest tests -q
```

## Retrieval and ingestion

All catalog lists come from manifest/index metadata. The default mode is Unicode lexical BM25-style retrieval and verbatim evidence, with a conservative term-overlap threshold. No LLM or paid key is required. It does not translate Roman Urdu. Absence of a hit returns an abstention; lexical matching is not a factual confidence guarantee. Pages are **original PDF page numbers**, not printed page labels. Unassigned chapter content is explicitly labeled. Inferred chapter boundaries require manual review.

Extraction uses PyMuPDF, cached per file hash plus extraction configuration, overlapping word chunks, transactional per-book replacement, stable IDs, and a resumable ingestion report. It skips image-only pages by default. Install Tesseract and its language data yourself, then set `$env:TUTOR_OCR_LANG="urd+eng"` to opt in. No OCR or LLM weights are downloaded automatically. Font-encoded text can still need OCR/manual repair even when selectable.

Optional semantic retrieval (separate from default working lexical mode):

```powershell
python -m pip install -r backend/requirements-rag.txt
# Provision a free multilingual sentence-transformers model yourself, e.g.
# paraphrase-multilingual-MiniLM-L12-v2. Point to its local directory:
$env:TUTOR_EMBED_MODEL="C:\models\multilingual-minilm"
python -m rag.vectors
```

This indexes local-only embeddings in ChromaDB with cached embeddings and strict book/chapter filters. Re-run vectors after ingestion changes. Set `TUTOR_MAX_DISTANCE` after evaluating a multilingual test set. The semantic path is optional and must not be claimed validated without provisioned model weights.

Optional local LLM: provision Ollama and a model yourself, then set `TUTOR_LLM_MODEL` and optionally `TUTOR_LLM_URL`. LangChain passes only retrieved passages to it. Generated wording still needs groundedness evaluation. Unset the model variable for extractive mode. STT/TTS backend endpoints return explicit 501 until a provider is implemented; mobile device TTS works independently. No quiz, authentication, student progress, rate limiting or production deployment is claimed.

See `docs/NEXT_STEPS.md` for the checkpoint and remaining validation.

Repeatable Drive discovery/download (optional; supply an authorized short-lived OAuth token with drive.readonly scope):

```powershell
$env:GOOGLE_DRIVE_ACCESS_TOKEN="YOUR_SHORT_LIVED_TOKEN"
python -m rag.drive --root 1_3AwlceIQ_g4VdSaiWabV06FSsc7kZpb --download-dir data/raw
Remove-Item Env:GOOGLE_DRIVE_ACCESS_TOKEN
python -m rag.ingest --pdf-dir data/raw
```

The Drive CLI paginates folders, preserves reviewed subject/chapter overrides, validates sizes/checksums, downloads atomically, and skips unchanged PDFs. Review discovered subjects before indexing chapter-fragment subfolders. Folder access is respected; failed downloads are reported without credential-bearing URLs.

## Open this prototype on an Android phone

Use Expo Go **for SDK 54**, downloaded from https://expo.dev/go?device=true&platform=android&sdkVersion=54 (a newer Play Store Expo Go may not open an older SDK project). This repository preserves its existing SDK rather than doing an unrelated major upgrade.

Start backend from the repository root:

```powershell
python -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8000
```

Then in a second terminal:

```powershell
cd mobile
npm ci --legacy-peer-deps
npx expo start --lan
```

Keep phone and PC on the same Wi-Fi. Scan Metro's QR code in the compatible Expo Go app. The backend defaults to the Expo development host on port 8000. If needed, Settings accepts `http://YOUR_PC_WIFI_IP:8000`, or set `$env:EXPO_PUBLIC_API_URL="http://YOUR_PC_WIFI_IP:8000"` before starting Expo. Test that `/health` opens from the phone's browser first. Allow the Python/Node Windows Firewall prompts on your trusted private network. Guest Wi-Fi client isolation may require a different network; Expo tunnel alone does not expose the backend.

Select Class 11 -> Chemistry -> Chemistry.pdf -> Chapter 1, then ask `What is ionization energy?`. Expect textbook evidence with original PDF page **12**. Other discovered books may show no indexed chapters until ingestion completes. Original PDF pages differ from printed page labels.

Additional validation commands from repository root:

```powershell
$env:PYTHONPATH=".;backend"
python -m pytest tests -q
python tests/smoke_live.py
cd mobile
npm run typecheck
npx expo export --platform android --output-dir ../data/processed/android-bundle
```

A successful JS/Hermes export is not an APK or proof of physical Android execution. See docs/progress.md for the exact verified/pending boundary.
