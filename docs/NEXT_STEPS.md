# Continuation checkpoint

- Finish downloads before ingestion. Expiring connector references must be refreshed and consumed immediately. Downloads and caches stay outside Git.
- Run `python -m rag.ingest --pdf-dir data/raw` after all downloads complete. Review `data/processed/ingestion-report.json` and catalog metadata, including scanned pages and chapter mapping quality.
- Class 11 Chemistry chapter starts were checked against the PDF contents (printed pages have a +4 PDF offset). Other books use bookmarks/headings or inferred numbered sections and need chapter validation.
- Default lexical search and extractive chat require no model/key. Optional ChromaDB, multilingual model and LangChain/Ollama adapters need runtime validation with explicitly provisioned weights.
- Validate physical Android navigation, recording permissions, local replay and device speech. Add actual STT provider with editable transcript, deletion of temporary recordings, and audio retention controls.
- Add SRS quizzes, progress, production security/rate limits, deployment and evaluated answer thresholds. Do not present this checkpoint as the complete SRS MVP.
- The OAuth Drive CLI is implemented in rag/drive.py; validate it with a caller-provided short-lived token. Connector downloads in this run expired or timed out; remaining files are explicitly awaiting download. Do not store credentials or signed download URLs in source.
