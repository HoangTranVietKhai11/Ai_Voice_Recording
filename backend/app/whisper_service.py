"""Whisper transcription service – chạy faster-whisper trên CPU."""

import logging
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

# Lazy-loaded model singleton
_model = None
_model_name: Optional[str] = None


def _get_model(model_size: str, device: str, compute_type: str):
    global _model, _model_name
    if _model is not None and _model_name == model_size:
        return _model
    from faster_whisper import WhisperModel

    logger.info("Đang tải model Whisper '%s' (device=%s, compute=%s)…", model_size, device, compute_type)
    _model = WhisperModel(model_size, device=device, compute_type=compute_type)
    _model_name = model_size
    logger.info("Model Whisper '%s' đã sẵn sàng.", model_size)
    return _model


def transcribe_audio(
    audio_path: Path,
    *,
    model_size: str = "base",
    device: str = "cpu",
    compute_type: str = "int8",
    language: Optional[str] = None,
) -> dict:
    """Phiên âm file audio, trả về dict với transcript, language, duration_secs."""
    model = _get_model(model_size, device, compute_type)

    kwargs = {"beam_size": 1}
    if language:
        kwargs["language"] = language

    segments, info = model.transcribe(str(audio_path), **kwargs)

    parts = []
    for seg in segments:
        parts.append(seg.text)

    transcript = " ".join(parts).strip()

    return {
        "transcript": transcript,
        "language": info.language,
        "language_probability": round(info.language_probability, 2),
        "duration_secs": round(info.duration, 2),
    }
