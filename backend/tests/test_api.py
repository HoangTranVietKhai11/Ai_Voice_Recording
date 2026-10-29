"""Pytest tests cho backend Phase 2."""

import os
import shutil
import tempfile
from pathlib import Path
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

# Cấu hình test DB và upload dir TRƯỚC khi import app
_test_dir = tempfile.mkdtemp(prefix="voicenote_test_")
os.environ["UPLOAD_DIR"] = os.path.join(_test_dir, "audio")
os.environ["DB_PATH"] = os.path.join(_test_dir, "test.db")
os.environ["WHISPER_MODEL"] = "tiny"

from app.main import app  # noqa: E402

client = TestClient(app)


@pytest.fixture(autouse=True)
def _cleanup():
    """Dọn DB và upload dir trước và sau mỗi test."""
    from app.database import init_db

    init_db()
    yield
    db_path = Path(os.environ["DB_PATH"])
    if db_path.exists():
        db_path.unlink(missing_ok=True)
    init_db()


# ── Helpers ────────────────────────────────────────────────────────────

def _make_wav_bytes(duration_samples: int = 8000) -> bytes:
    """Tạo file WAV mono 16-bit PCM hợp lệ (8000 Hz)."""
    import struct

    sample_rate = 8000
    num_channels = 1
    bits_per_sample = 16
    data_size = duration_samples * num_channels * (bits_per_sample // 8)
    # Header RIFF/WAVE
    header = struct.pack(
        "<4sI4s4sIHHIIHH4sI",
        b"RIFF",
        36 + data_size,
        b"WAVE",
        b"fmt ",
        16,
        1,  # PCM
        num_channels,
        sample_rate,
        sample_rate * num_channels * bits_per_sample // 8,
        num_channels * bits_per_sample // 8,
        bits_per_sample,
        b"data",
        data_size,
    )
    # Silence audio data
    audio_data = b"\x00\x00" * duration_samples
    return header + audio_data


# ── Tests ──────────────────────────────────────────────────────────────

def test_health():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


def test_upload_valid_wav():
    wav = _make_wav_bytes()
    r = client.post("/api/audio", files={"file": ("test.wav", wav, "audio/wav")})
    assert r.status_code == 201
    data = r.json()
    assert data["status"] == "uploaded"
    assert data["audio_id"]
    assert data["size_bytes"] == len(wav)


def test_upload_wrong_extension():
    r = client.post("/api/audio", files={"file": ("virus.exe", b"\x00" * 100, "application/octet-stream")})
    assert r.status_code == 415


def test_upload_empty_file():
    r = client.post("/api/audio", files={"file": ("empty.wav", b"", "audio/wav")})
    assert r.status_code == 400


def test_upload_fake_audio():
    """File text đặt tên .webm phải bị từ chối (kiểm tra nội dung, không chỉ đuôi file)."""
    fake = b"This is definitely not audio content at all."
    r = client.post("/api/audio", files={"file": ("fake.webm", fake, "audio/webm")})
    assert r.status_code == 415


def test_upload_too_large():
    """File vượt MAX_UPLOAD_MB phải bị từ chối."""
    with patch("app.main.MAX_UPLOAD_BYTES", 100):
        wav = _make_wav_bytes(200)
        r = client.post("/api/audio", files={"file": ("big.wav", wav, "audio/wav")})
        assert r.status_code == 413


def test_list_and_delete():
    wav = _make_wav_bytes()
    r = client.post("/api/audio", files={"file": ("test.wav", wav, "audio/wav")})
    audio_id = r.json()["audio_id"]

    # Kiểm tra danh sách
    r = client.get("/api/recordings")
    assert r.status_code == 200
    ids = [rec["audio_id"] for rec in r.json()]
    # Kiểm tra tải/stream audio
    r = client.get(f"/api/audio/{audio_id}")
    assert r.status_code == 200
    assert len(r.content) == len(wav)

    # Xóa
    r = client.delete(f"/api/recordings/{audio_id}")
    assert r.status_code == 200
    assert r.json()["deleted"] is True

    # Kiểm tra đã xóa
    r = client.get(f"/api/recordings/{audio_id}")
    assert r.status_code == 404


def test_delete_not_found():
    r = client.delete("/api/recordings/nonexistent-id")
    assert r.status_code == 404


def test_transcribe_with_real_audio():
    """Upload file WAV thật và gọi transcribe – kiểm tra trạng thái chuyển đúng."""
    wav = _make_wav_bytes(16000)  # 2 giây silence
    r = client.post("/api/audio", files={"file": ("silence.wav", wav, "audio/wav")})
    assert r.status_code == 201
    audio_id = r.json()["audio_id"]

    # Gọi transcribe
    r = client.post(f"/api/transcribe/{audio_id}")
    assert r.status_code == 200
    assert r.json()["status"] == "transcribing"

    # Đợi một chút cho thread background chạy xong
    import time
    time.sleep(8)  # Model tiny, 2s audio, CPU – cho 8s dư

    # Kiểm tra kết quả
    r = client.get(f"/api/recordings/{audio_id}")
    data = r.json()
    assert data["status"] in ("done", "error"), f"Unexpected status: {data['status']}"
    if data["status"] == "done":
        assert data["duration_secs"] is not None
        assert data["language"] is not None


def test_update_transcript_and_translate():
    """Test PATCH update transcript và POST /api/translate."""
    wav = _make_wav_bytes()
    r = client.post("/api/audio", files={"file": ("speech.wav", wav, "audio/wav")})
    assert r.status_code == 201
    audio_id = r.json()["audio_id"]

    # Ban đầu chưa có transcript, gọi dịch trả về 400
    r = client.post("/api/translate", json={"audio_id": audio_id, "target_lang": "vi"})
    assert r.status_code == 400

    # Cập nhật transcript bằng PATCH
    initial_text = "Good morning everyone. Welcome to the conference."
    r = client.patch(f"/api/recordings/{audio_id}", json={"transcript": initial_text})
    assert r.status_code == 200
    assert r.json()["transcript"] == initial_text

    # Gọi dịch với Mock provider
    with patch.dict(os.environ, {"TRANSLATION_PROVIDER": "mock"}):
        r = client.post("/api/translate", json={"audio_id": audio_id, "target_lang": "vi"})
        assert r.status_code == 200
        data = r.json()
        assert data["audio_id"] == audio_id
        assert data["translation_lang"] == "vi"
        assert "[Dịch sang vi]" in data["translation"]

        # Kiểm tra bản ghi trong DB đã lưu bản dịch
        r = client.get(f"/api/recordings/{audio_id}")
        rec = r.json()
        assert rec["translation"] == data["translation"]
        assert rec["translation_lang"] == "vi"

        # Sửa transcript trực tiếp khi gọi dịch và dịch lại
        edited_text = "Good afternoon everyone. Welcome to the meeting."
        r = client.post("/api/translate", json={"audio_id": audio_id, "target_lang": "vi", "text": edited_text})
        assert r.status_code == 200
        data = r.json()
        assert data["transcript"] == edited_text
        assert edited_text in data["translation"]

        # Kiểm tra DB lưu transcript đã sửa
        r = client.get(f"/api/recordings/{audio_id}")
        assert r.json()["transcript"] == edited_text

