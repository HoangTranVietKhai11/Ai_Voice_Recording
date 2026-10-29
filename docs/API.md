
# API contract

## `GET /health`
Trả trạng thái backend.
```json
{"status": "ok"}
```

## `POST /api/audio`
`multipart/form-data` field `file`.
Kiểm tra: đuôi file, dung lượng (≤ `MAX_UPLOAD_MB`), và nội dung (magic bytes).

Response `201`:
```json
{
  "audio_id": "uuid",
  "filename": "recording.webm",
  "content_type": "audio/webm",
  "size_bytes": 123456,
  "status": "uploaded"
}
```

Lỗi: `400` file rỗng, `413` quá dung lượng, `415` sai đuôi hoặc nội dung không phải audio.

## `POST /api/transcribe/{audio_id}`
Query param tuỳ chọn: `language` (mã ISO 639-1, ví dụ `vi`, `en`). Nếu không truyền thì tự nhận dạng.

Chạy nền (thread). Response ngay lập tức:
```json
{"audio_id": "uuid", "status": "transcribing"}
```

Kết quả phiên âm lưu vào DB, truy vấn qua `GET /api/recordings/{audio_id}`.

## `GET /api/recordings`
Danh sách bản ghi, sắp xếp theo `created_at` giảm dần.

```json
[
  {
    "audio_id": "uuid",
    "filename": "recording.webm",
    "content_type": "audio/webm",
    "size_bytes": 123456,
    "suffix": ".webm",
    "status": "done",
    "transcript": "Nội dung phiên âm...",
    "language": "vi",
    "duration_secs": 21.74,
    "error_message": null,
    "created_at": "2026-10-29T02:30:00+00:00",
    "updated_at": "2026-10-29T02:30:05+00:00"
  }
]
```

Trạng thái `status`: `uploaded` → `transcribing` → `done` hoặc `error`.

## `GET /api/recordings/{audio_id}`
Chi tiết 1 bản ghi. `404` nếu không tìm thấy.

## `GET /api/audio/{audio_id}`
Tải hoặc phát file audio trực tiếp (`audio/webm`, `audio/wav`, ...). Hỗ trợ thẻ `<audio src="...">`. `404` nếu không tìm thấy.

## `DELETE /api/recordings/{audio_id}`
Xóa metadata trong DB và file audio trên đĩa. `404` nếu không tìm thấy.

```json
{"deleted": true, "audio_id": "uuid"}
```

## `PATCH /api/recordings/{audio_id}`
Cập nhật nội dung phiên âm (transcript) sau khi người dùng sửa thủ công.
```json
{
  "transcript": "Nội dung sau khi chỉnh sửa..."
}
```

## `POST /api/translate`
Dịch đoạn transcript sang ngôn ngữ đích (mặc định `vi`). Có thể truyền kèm `text` chỉnh sửa để vừa lưu vừa dịch lại.

Request body:
```json
{
  "audio_id": "uuid",
  "target_lang": "vi",
  "text": "Nội dung cần dịch (tuỳ chọn, nếu bỏ trống lấy transcript hiện có)"
}
```

Response `200`:
```json
{
  "audio_id": "uuid",
  "transcript": "...",
  "translation": "...",
  "translation_lang": "vi"
}
```

## Schema SQLite `recordings`

| Cột | Kiểu | Mô tả |
|---|---|---|
| audio_id | TEXT PK | UUID |
| filename | TEXT | Tên file gốc khi upload |
| content_type | TEXT | MIME type |
| size_bytes | INTEGER | Dung lượng file (bytes) |
| suffix | TEXT | Đuôi file (.webm, .wav, ...) |
| status | TEXT | uploaded / transcribing / done / error |
| transcript | TEXT | Kết quả phiên âm |
| language | TEXT | Ngôn ngữ phát hiện (ISO 639-1) |
| duration_secs | REAL | Thời lượng audio (giây) |
| error_message | TEXT | Thông báo lỗi nếu status = error |
| translation | TEXT | Bản dịch văn bản |
| translation_lang | TEXT | Mã ngôn ngữ bản dịch (ví dụ vi) |
| created_at | TEXT | ISO 8601 UTC |
| updated_at | TEXT | ISO 8601 UTC |
