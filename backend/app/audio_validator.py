"""Audio content validation – kiểm tra magic bytes, không chỉ đuôi file."""

# Magic bytes cho các định dạng audio phổ biến
_SIGNATURES: dict[str, list[tuple[int, bytes]]] = {
    # WAV: RIFF....WAVE
    ".wav": [(0, b"RIFF"), (8, b"WAVE")],
    # MP3: ID3 tag hoặc frame sync
    ".mp3": [(0, b"ID3"), (0, b"\xff\xfb"), (0, b"\xff\xf3"), (0, b"\xff\xf2")],
    # OGG (bao gồm Opus/Vorbis)
    ".ogg": [(0, b"OggS")],
    # M4A / MP4: ftyp box
    ".m4a": [(4, b"ftyp")],
    ".mp4": [(4, b"ftyp")],
    ".mpeg": [(0, b"\xff\xfb"), (0, b"\xff\xf3")],
    # WebM: EBML header (Matroska/WebM)
    ".webm": [(0, b"\x1a\x45\xdf\xa3")],
}


def is_valid_audio_content(content: bytes, suffix: str) -> bool:
    """Trả True nếu content khớp ít nhất 1 magic signature cho đuôi file đã cho."""
    sigs = _SIGNATURES.get(suffix)
    if not sigs:
        return False  # Đuôi file không nằm trong danh sách cho phép

    for offset, magic in sigs:
        if len(content) > offset and content[offset : offset + len(magic)] == magic:
            return True
    return False
