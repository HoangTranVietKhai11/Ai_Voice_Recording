from pathlib import Path
from uuid import uuid4
import os

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

APP_NAME = os.getenv("APP_NAME", "VoiceNote API")
UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", "./data/audio"))
MAX_UPLOAD_MB = int(os.getenv("MAX_UPLOAD_MB", "100"))
MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024
ALLOWED_SUFFIXES = {".webm", ".wav", ".mp3", ".m4a", ".mp4", ".ogg", ".mpeg"}

app = FastAPI(title=APP_NAME, version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=False,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {"name": APP_NAME, "docs": "/docs", "status": "skeleton"}


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/api/audio", status_code=201)
async def upload_audio(file: UploadFile = File(...)):
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in ALLOWED_SUFFIXES:
        raise HTTPException(status_code=415, detail="Unsupported audio file extension")

    content = await file.read(MAX_UPLOAD_BYTES + 1)
    if not content:
        raise HTTPException(status_code=400, detail="Empty file")
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail=f"File exceeds {MAX_UPLOAD_MB} MB limit")

    audio_id = str(uuid4())
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    stored_path = UPLOAD_DIR / f"{audio_id}{suffix}"
    stored_path.write_bytes(content)

    return {
        "audio_id": audio_id,
        "filename": file.filename,
        "content_type": file.content_type,
        "size_bytes": len(content),
        "status": "uploaded",
        "note": "Transcription endpoint is not implemented yet",
    }


@app.post("/api/transcribe/{audio_id}")
def transcribe_placeholder(audio_id: str):
    raise HTTPException(
        status_code=501,
        detail="Whisper integration is a planned milestone; see docs/ROADMAP.md",
    )


@app.post("/api/translate")
def translate_placeholder():
    raise HTTPException(
        status_code=501,
        detail="Translation integration is a planned milestone; see docs/ARCHITECTURE.md",
    )
