
# Kiến trúc đề xuất

```text
Browser / PWA
  ├─ MediaRecorder (microphone)
  ├─ Audio playback / download
  └─ HTTP API
       │
       ▼
FastAPI backend (local host / LAN)
  ├─ Validate audio upload
  ├─ Job status (MVP có thể đồng bộ)
  ├─ faster-whisper (local speech-to-text)
  ├─ Translation service interface
  ├─ Storage service
  └─ SQLite database
       │
       ├─ audio files
       ├─ transcripts
       └─ translations
```

## Lưu ý về Whisper và dịch
Whisper có thể phiên âm nhiều ngôn ngữ. Chế độ `translate` của Whisper chủ yếu dịch lời nói sang tiếng Anh, không thay thế một hệ thống dịch tùy ý từ mọi ngôn ngữ sang tiếng Việt. Vì vậy hãy:
1. Dùng Whisper để nhận dạng ngôn ngữ và tạo transcript gốc.
2. Gửi transcript qua một translation backend riêng để dịch sang tiếng Việt/ngôn ngữ đích.
3. Chọn mô hình dịch local phù hợp sau khi kiểm tra tốc độ, RAM và chất lượng.

## Triển khai theo giai đoạn
- Windows: phát triển frontend/backend.
- Máy Windows 16 GB RAM: thử model nhỏ trước, đo tốc độ.
- Proxmox i5-3470, RAM 12 GB, không GPU rời: bắt đầu với model `tiny`/`base` hoặc model quantized nhỏ; tránh tải nhiều model đồng thời. Đo RAM và thời gian thực tế trước khi quyết định.
- Docker Compose: chỉ triển khai sau khi các luồng cơ bản chạy ổn.
