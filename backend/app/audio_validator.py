"""Audio content validation – kiểm tra magic bytes, không chỉ đuôi file."""

# Magic bytes cho các định dạng audio/video phổ biến
_KNOWN_SIGNATURES: dict[str, list[tuple[int, bytes]]] = {
    # WAV: RIFF....WAVE hoặc RIFX....WAVE
    ".wav": [(0, b"RIFF"), (0, b"RIFX")],
    # MP3: ID3 tag hoặc sync frames
    ".mp3": [(0, b"ID3"), (0, b"\xff\xfb"), (0, b"\xff\xf3"), (0, b"\xff\xf2"), (0, b"\xff\xfa")],
    # OGG / Opus
    ".ogg": [(0, b"OggS")],
    ".opus": [(0, b"OggS")],
    # FLAC
    ".flac": [(0, b"fLaC")],
    # M4A / MP4 / MOV
    ".m4a": [(4, b"ftyp"), (4, b"moov"), (4, b"mdat")],
    ".mp4": [(4, b"ftyp"), (4, b"moov"), (4, b"mdat")],
    ".mov": [(4, b"ftyp"), (4, b"moov"), (4, b"mdat"), (4, b"wide"), (4, b"skip"), (4, b"free")],
    # MPEG / MPG
    ".mpeg": [(0, b"\x00\x00\x01\xba"), (0, b"\xff\xfb"), (0, b"\xff\xf3"), (0, b"ID3")],
    ".mpg": [(0, b"\x00\x00\x01\xba"), (0, b"\xff\xfb"), (0, b"\xff\xf3"), (0, b"ID3")],
    # WebM / MKV: EBML header
    ".webm": [(0, b"\x1a\x45\xdf\xa3")],
    ".mkv": [(0, b"\x1a\x45\xdf\xa3")],
    # AAC
    ".aac": [(0, b"\xff\xf1"), (0, b"\xff\xf9"), (0, b"ID3")],
    # WMA / ASF
    ".wma": [(0, b"\x30\x26\xb2\x75")],
}

_DISALLOWED_PREFIXES = (
    b"MZ",           # Windows PE executable
    b"\x7fELF",      # Linux ELF
    b"<!DOCTYPE",    # HTML
    b"<html",        # HTML
    b"<?xml",        # XML / SVG
    b"%PDF",         # PDF
    b"PK\x03\x04",   # ZIP / DOCX / JAR
    b"Rar!\x1a\x07", # RAR
    b"7z\xbc\xaf\x27\x1c", # 7z
)


def is_valid_audio_content(content: bytes, suffix: str) -> bool:
    """Trả True nếu content hợp lệ cho file âm thanh/video."""
    if not content or len(content) < 4:
        return False

    # Chặn các file nguy hiểm rõ ràng (exe, elf, html, zip, pdf...)
    for bad in _DISALLOWED_PREFIXES:
        if content.startswith(bad):
            return False

    suffix = suffix.lower()

    # Kiểm tra MP3 sync bits tổng quát: byte 0 là 0xFF và 3 bit cao của byte 1 là 0b111 (0xE0)
    if suffix in (".mp3", ".mpeg", ".mpg"):
        if content.startswith(b"ID3") or (len(content) >= 2 and content[0] == 0xFF and (content[1] & 0xE0) == 0xE0):
            return True

    # Kiểm tra MP4 / MOV / M4A tổng quát (ftyp / moov / mdat nằm trong 64 byte đầu)
    if suffix in (".mp4", ".m4a", ".mov"):
        head = content[:64]
        if any(box in head for box in (b"ftyp", b"moov", b"mdat", b"wide", b"skip", b"free")):
            return True

    sigs = _KNOWN_SIGNATURES.get(suffix)
    if sigs:
        for offset, magic in sigs:
            if len(content) > offset and content[offset : offset + len(magic)] == magic:
                return True
        return False

    return True
