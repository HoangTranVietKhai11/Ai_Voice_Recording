"""SQLite database layer – schema và CRUD cho bản ghi âm thanh."""

import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

DB_PATH: Path = Path("./data/voicenote.db")


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def get_connection() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


@contextmanager
def get_db():
    conn = get_connection()
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db() -> None:
    """Tạo bảng nếu chưa tồn tại và tự động cập nhật migration."""
    with get_db() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS recordings (
                audio_id       TEXT PRIMARY KEY,
                filename       TEXT NOT NULL,
                content_type   TEXT,
                size_bytes     INTEGER NOT NULL,
                suffix         TEXT NOT NULL,
                status         TEXT NOT NULL DEFAULT 'uploaded',
                transcript     TEXT,
                language       TEXT,
                duration_secs  REAL,
                error_message  TEXT,
                translation    TEXT,
                translation_lang TEXT,
                created_at     TEXT NOT NULL,
                updated_at     TEXT NOT NULL
            )
        """)
        # Safe migration nếu bảng đã tồn tại từ trước
        cur = conn.execute("PRAGMA table_info(recordings)")
        cols = {row["name"] for row in cur.fetchall()}
        if "translation" not in cols:
            conn.execute("ALTER TABLE recordings ADD COLUMN translation TEXT")
        if "translation_lang" not in cols:
            conn.execute("ALTER TABLE recordings ADD COLUMN translation_lang TEXT")


# ── CRUD ──────────────────────────────────────────────────────────────

def insert_recording(
    audio_id: str,
    filename: str,
    content_type: Optional[str],
    size_bytes: int,
    suffix: str,
) -> dict:
    now = _now_iso()
    row = {
        "audio_id": audio_id,
        "filename": filename,
        "content_type": content_type,
        "size_bytes": size_bytes,
        "suffix": suffix,
        "status": "uploaded",
        "created_at": now,
        "updated_at": now,
    }
    with get_db() as conn:
        conn.execute(
            """INSERT INTO recordings
               (audio_id, filename, content_type, size_bytes, suffix, status, created_at, updated_at)
               VALUES (:audio_id, :filename, :content_type, :size_bytes, :suffix, :status, :created_at, :updated_at)""",
            row,
        )
    return row


def get_recording(audio_id: str) -> Optional[dict]:
    with get_db() as conn:
        cur = conn.execute("SELECT * FROM recordings WHERE audio_id = ?", (audio_id,))
        row = cur.fetchone()
        return dict(row) if row else None


def list_recordings() -> list[dict]:
    with get_db() as conn:
        cur = conn.execute("SELECT * FROM recordings ORDER BY created_at DESC")
        return [dict(r) for r in cur.fetchall()]


def update_transcription(
    audio_id: str,
    *,
    status: str,
    transcript: Optional[str] = None,
    language: Optional[str] = None,
    duration_secs: Optional[float] = None,
    error_message: Optional[str] = None,
) -> bool:
    with get_db() as conn:
        cur = conn.execute(
            """UPDATE recordings
               SET status = ?, transcript = ?, language = ?,
                   duration_secs = ?, error_message = ?, updated_at = ?
               WHERE audio_id = ?""",
            (status, transcript, language, duration_secs, error_message, _now_iso(), audio_id),
        )
        return cur.rowcount > 0


def update_recording_transcript(audio_id: str, transcript: str) -> bool:
    """Cập nhật lại văn bản phiên âm sau khi người dùng sửa tay."""
    with get_db() as conn:
        cur = conn.execute(
            "UPDATE recordings SET transcript = ?, updated_at = ? WHERE audio_id = ?",
            (transcript, _now_iso(), audio_id),
        )
        return cur.rowcount > 0


def update_recording_translation(audio_id: str, translation: str, translation_lang: str) -> bool:
    """Lưu bản dịch cùng bản ghi."""
    with get_db() as conn:
        cur = conn.execute(
            "UPDATE recordings SET translation = ?, translation_lang = ?, updated_at = ? WHERE audio_id = ?",
            (translation, translation_lang, _now_iso(), audio_id),
        )
        return cur.rowcount > 0


def delete_recording(audio_id: str) -> bool:
    with get_db() as conn:
        cur = conn.execute("DELETE FROM recordings WHERE audio_id = ?", (audio_id,))
        return cur.rowcount > 0
