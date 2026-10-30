import logging
import os
import threading
from contextlib import asynccontextmanager
from pathlib import Path
from uuid import uuid4

from fastapi import FastAPI, File, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from app.audio_validator import is_valid_audio_content
from app.database import (
    DB_PATH,
    delete_recording,
    get_recording,
    init_db,
    insert_recording,
    list_recordings,
    update_recording_transcript,
    update_recording_translation,
    update_transcription,
)
from app.translation_service import get_translation_service

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger(__name__)

from dotenv import load_dotenv

load_dotenv()

# ── Cấu hình qua biến môi trường ──────────────────────────────────────

APP_NAME = os.getenv("APP_NAME", "VoiceNote API")
UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", "./data/audio"))
MAX_UPLOAD_MB = int(os.getenv("MAX_UPLOAD_MB", "100"))
MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024
ALLOWED_SUFFIXES = {
    ".webm", ".wav", ".mp3", ".m4a", ".mp4", ".ogg", ".mpeg",
    ".mov", ".aac", ".flac", ".mkv", ".wma", ".opus", ".mpg",
}

WHISPER_MODEL = os.getenv("WHISPER_MODEL", "base")
WHISPER_DEVICE = os.getenv("WHISPER_DEVICE", "cpu")
WHISPER_COMPUTE = os.getenv("WHISPER_COMPUTE", "int8")

# Thư mục static frontend (chỉ tồn tại trong container Docker)
STATIC_DIR = Path(__file__).parent.parent / "static"

# Token bảo vệ API (đặt API_TOKEN= trong .env hoặc docker-compose để bật)
API_TOKEN: str | None = os.getenv("API_TOKEN", "").strip() or None

# Cấu hình đường dẫn DB
DB_PATH_ENV = os.getenv("DB_PATH")
if DB_PATH_ENV:
    import app.database as _db_mod
    _db_mod.DB_PATH = Path(DB_PATH_ENV)

# CORS origins: trong Docker cùng origin nên không cần, nhưng giữ cho dev local
_cors_origins_raw = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
CORS_ORIGINS = [o.strip() for o in _cors_origins_raw.split(",") if o.strip()]

# ── App ────────────────────────────────────────────────────────────────


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    logger.info("DB tại %s, audio tại %s", DB_PATH, UPLOAD_DIR)
    if API_TOKEN:
        logger.info("Xác thực API token: BẬT")
    else:
        logger.warning("API_TOKEN không đặt – API không được bảo vệ (chỉ dùng nội bộ LAN)")
    yield


app = FastAPI(title=APP_NAME, version="0.2.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)


# ── Middleware bảo vệ bằng Bearer token ────────────────────────────────

_UNPROTECTED_PREFIXES = ("/health", "/docs", "/openapi.json", "/redoc")


@app.middleware("http")
async def token_auth_middleware(request: Request, call_next):
    """Nếu API_TOKEN được cấu hình, yêu cầu header Authorization: Bearer <token>
    cho mọi request tới /api/*. Static files và health endpoint không cần token."""
    if API_TOKEN is None:
        return await call_next(request)
    path = request.url.path
    # Bỏ qua các path công khai
    if not path.startswith("/api") or any(path.startswith(p) for p in _UNPROTECTED_PREFIXES):
        return await call_next(request)
    auth = request.headers.get("Authorization", "")
    if auth != f"Bearer {API_TOKEN}":
        from fastapi.responses import JSONResponse
        return JSONResponse(
            status_code=401,
            content={"detail": "Token xác thực không hợp lệ hoặc bị thiếu"},
        )
    return await call_next(request)


# ── Static assets (JS/CSS hash files trong container Docker) ───────────

if STATIC_DIR.is_dir():
    _assets = STATIC_DIR / "assets"
    if _assets.is_dir():
        app.mount("/assets", StaticFiles(directory=str(_assets)), name="assets")



# ── Endpoints ──────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/api/audio", status_code=201)
async def upload_audio(file: UploadFile = File(...)):
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in ALLOWED_SUFFIXES:
        raise HTTPException(status_code=415, detail="Định dạng file không được hỗ trợ")

    content = await file.read(MAX_UPLOAD_BYTES + 1)
    if not content:
        raise HTTPException(status_code=400, detail="File rỗng")
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail=f"File vượt quá {MAX_UPLOAD_MB} MB")

    # Kiểm tra nội dung thực sự là audio (magic bytes)
    if not is_valid_audio_content(content, suffix):
        raise HTTPException(status_code=415, detail="Nội dung file không phải audio hợp lệ")

    audio_id = str(uuid4())
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    stored_path = UPLOAD_DIR / f"{audio_id}{suffix}"
    stored_path.write_bytes(content)

    row = insert_recording(
        audio_id=audio_id,
        filename=file.filename or "",
        content_type=file.content_type,
        size_bytes=len(content),
        suffix=suffix,
    )

    return {
        "audio_id": audio_id,
        "filename": file.filename,
        "content_type": file.content_type,
        "size_bytes": len(content),
        "status": "uploaded",
    }


@app.post("/api/transcribe/{audio_id}")
def transcribe(audio_id: str, language: str | None = None):
    rec = get_recording(audio_id)
    if not rec:
        raise HTTPException(status_code=404, detail="Không tìm thấy bản ghi")

    if rec["status"] == "transcribing":
        return {"audio_id": audio_id, "status": "transcribing"}

    # Tìm file audio trên đĩa
    audio_path = UPLOAD_DIR / f"{audio_id}{rec['suffix']}"
    if not audio_path.exists():
        raise HTTPException(status_code=404, detail="File audio không tồn tại trên đĩa")

    # Đánh dấu trạng thái đang xử lý
    update_transcription(audio_id, status="transcribing")

    def _run():
        try:
            from app.whisper_service import transcribe_audio

            result = transcribe_audio(
                audio_path,
                model_size=WHISPER_MODEL,
                device=WHISPER_DEVICE,
                compute_type=WHISPER_COMPUTE,
                language=language,
            )
            update_transcription(
                audio_id,
                status="done",
                transcript=result["transcript"],
                language=result["language"],
                duration_secs=result["duration_secs"],
            )
            logger.info("Phiên âm hoàn tất cho %s (%s, %.1fs)", audio_id, result["language"], result["duration_secs"])
        except Exception as exc:
            logger.error("Lỗi phiên âm %s: %s", audio_id, exc)
            update_transcription(audio_id, status="error", error_message=str(exc))

    thread = threading.Thread(target=_run, daemon=True)
    thread.start()

    return {"audio_id": audio_id, "status": "transcribing"}


@app.get("/api/audio/{audio_id}")
def get_audio_file(audio_id: str):
    rec = get_recording(audio_id)
    if not rec:
        raise HTTPException(status_code=404, detail="Không tìm thấy bản ghi")
    audio_path = UPLOAD_DIR / f"{audio_id}{rec['suffix']}"
    if not audio_path.exists():
        raise HTTPException(status_code=404, detail="File audio không tồn tại")
    return FileResponse(
        path=audio_path,
        media_type=rec["content_type"] or "application/octet-stream",
        filename=rec["filename"],
    )


@app.get("/api/recordings")
def get_recordings():
    return list_recordings()


@app.get("/api/recordings/{audio_id}")
def get_recording_detail(audio_id: str):
    rec = get_recording(audio_id)
    if not rec:
        raise HTTPException(status_code=404, detail="Không tìm thấy bản ghi")
    return rec


@app.delete("/api/recordings/{audio_id}")
def delete_recording_endpoint(audio_id: str):
    rec = get_recording(audio_id)
    if not rec:
        raise HTTPException(status_code=404, detail="Không tìm thấy bản ghi")

    # Xóa file audio trên đĩa
    audio_path = UPLOAD_DIR / f"{audio_id}{rec['suffix']}"
    if audio_path.exists():
        audio_path.unlink()

    delete_recording(audio_id)
    return {"deleted": True, "audio_id": audio_id}


class TranscriptUpdateRequest(BaseModel):
    transcript: str


class TranslateRequest(BaseModel):
    audio_id: str
    target_lang: str = "vi"
    text: str | None = None


@app.patch("/api/recordings/{audio_id}")
def update_recording_endpoint(audio_id: str, req: TranscriptUpdateRequest):
    rec = get_recording(audio_id)
    if not rec:
        raise HTTPException(status_code=404, detail="Không tìm thấy bản ghi")

    update_recording_transcript(audio_id, req.transcript)
    return get_recording(audio_id)


@app.post("/api/translate")
def translate_recording(req: TranslateRequest):
    rec = get_recording(req.audio_id)
    if not rec:
        raise HTTPException(status_code=404, detail="Không tìm thấy bản ghi")

    # Xác định văn bản cần dịch: ưu tiên text truyền vào (nếu người dùng vừa sửa)
    text_to_translate = (req.text if req.text is not None else rec["transcript"]) or ""
    text_to_translate = text_to_translate.strip()

    if not text_to_translate:
        raise HTTPException(status_code=400, detail="Không có nội dung văn bản để dịch")

    # Nếu người dùng gửi text sửa đổi, cập nhật luôn transcript trong DB
    if req.text is not None and req.text != rec["transcript"]:
        update_recording_transcript(req.audio_id, req.text)

    source_lang = rec.get("language") or "auto"
    target_lang = req.target_lang or "vi"

    try:
        service = get_translation_service()
        translated_text = service.translate(
            text=text_to_translate,
            source_lang=source_lang,
            target_lang=target_lang,
        )
    except Exception as exc:
        logger.error("Dịch thất bại cho %s: %s", req.audio_id, exc)
        raise HTTPException(status_code=500, detail=f"Lỗi khi dịch thuật: {exc}")

    update_recording_translation(req.audio_id, translated_text, target_lang)

    return {
        "audio_id": req.audio_id,
        "transcript": text_to_translate,
        "translation": translated_text,
        "translation_lang": target_lang,
    }


# ── SPA Fallback (Đặt ở CUỐI CÙNG để không chặn các route /api/*) ─────

if STATIC_DIR.is_dir():
    @app.get("/", response_class=HTMLResponse, include_in_schema=False)
    async def spa_root():
        return (STATIC_DIR / "index.html").read_text(encoding="utf-8")

    @app.get("/{full_path:path}", response_class=HTMLResponse, include_in_schema=False)
    async def spa_fallback(full_path: str):
        """SPA fallback: mọi route không phải /api/* đều trả về index.html."""
        if full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="API endpoint không tồn tại")
        index = STATIC_DIR / "index.html"
        if not index.exists():
            raise HTTPException(status_code=404, detail="Frontend chưa được build")
        return index.read_text(encoding="utf-8")
else:
    @app.get("/")
    def root():
        return {"name": APP_NAME, "docs": "/docs", "status": "running", "note": "Frontend chưa build"}

