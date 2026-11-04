from fastapi import FastAPI

app = FastAPI(
    title="AI Voice Textbook Tutor API",
    version="0.1.0",
    description="Starter backend for the voice-based textbook learning assistant.",
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
