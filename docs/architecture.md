# Architecture (proposed)

React Native (Expo) mobile app -> FastAPI REST API -> textbook-grounded RAG services.

The ingestion worker will process authorized textbooks into chapter-tagged chunks. Retrieval will filter by class, subject, book and chapter. An LLM will answer from retrieved evidence and return citations. Speech recognition and speech synthesis will be added as independent services.

## MVP acceptance criteria
1. Select class, subject and chapter.
2. Ask a question and receive a cited answer from authorized source material.
3. Ask by voice and listen to the answer.
4. Complete a chapter quiz and review results.
5. Show clear fallback when the textbook lacks the answer.

## Current status
Only mobile starter screen and backend health check are implemented.
