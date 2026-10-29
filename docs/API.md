
# API contract (đề xuất)

## `GET /health`
Trả trạng thái backend.

## `POST /api/audio`
`multipart/form-data` field `file`.

Response dự kiến:
```json
{
  "audio_id": "uuid",
  "filename": "recording.webm",
  "content_type": "audio/webm",
  "status": "uploaded"
}
```

## `POST /api/transcribe/{audio_id}`
Body JSON:
```json
{
  "language": null
}
```
`language = null` để tự nhận dạng. Trả transcript, ngôn ngữ phát hiện, thời lượng.

## `POST /api/translate`
Body JSON:
```json
{
  "text": "Hello",
  "source_language": "en",
  "target_language": "vi"
}
```
MVP skeleton chưa tích hợp mô hình dịch thật.

## `GET /api/recordings`
Danh sách bản ghi đã lưu.

## `DELETE /api/recordings/{audio_id}`
Xóa metadata và file liên quan theo chính sách đã xác định.
