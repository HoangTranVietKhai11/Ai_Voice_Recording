
# Roadmap

## Milestone 1 — Recorder UI
- [ ] Chạy Vite/React.
- [ ] Kiểm tra xin quyền microphone.
- [ ] Start / pause / resume / stop.
- [ ] Playback / download / delete.
- [ ] Kiểm tra Chrome desktop.

## Milestone 2 — Backend upload
- [ ] Tạo FastAPI.
- [ ] POST `/api/audio` nhận file.
- [ ] Giới hạn dung lượng và validate phần mở rộng/MIME.
- [ ] Trả `audio_id`, tên file và trạng thái.
- [ ] Không log dữ liệu nhạy cảm.

## Milestone 3 — Local transcription
- [ ] Cài `faster-whisper`.
- [ ] Tải model nhỏ.
- [ ] POST `/api/transcribe/{audio_id}`.
- [ ] Trả transcript, detected language, duration.
- [ ] Thử audio tiếng Việt và tiếng Anh.

## Milestone 4 — Translation
- [ ] Chốt mô hình/provider dịch.
- [ ] Thêm `source_language`, `target_language`.
- [ ] Hiển thị transcript gốc và bản dịch song song.
- [ ] Cho sửa transcript rồi dịch lại.

## Milestone 5 — History
- [ ] SQLite metadata.
- [ ] Lưu audio vào thư mục cấu hình.
- [ ] Tìm kiếm và lọc theo ngày/ngôn ngữ.
- [ ] Xóa audio + transcript + translation theo yêu cầu.

## Milestone 6 — Deploy
- [ ] Dockerfile frontend/backend.
- [ ] Compose + volume persistent.
- [ ] Backup database và audio.
- [ ] Kiểm tra truy cập LAN.
- [ ] Thêm HTTPS/auth trước khi truy cập ngoài LAN.
