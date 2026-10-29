# VoiceNote AI (AI Voice Recorder)

Web/PWA ghi âm → phiên âm (faster-whisper, chạy local) → dịch → lưu lịch sử. Ưu tiên local-first.

## Stack
- Frontend: React + TypeScript + Vite (`frontend/`)
- Backend: Python 3.11 + FastAPI (`backend/app/main.py`)
- DB: SQLite (MVP). Audio lưu ở `UPLOAD_DIR`.
- Deploy: Docker Compose, đích cuối là Proxmox (i5-3470, 12 GB RAM, không GPU).

## Lệnh
- Frontend dev: `npm --prefix frontend run dev`
- Frontend build/check: `npm --prefix frontend run build`
- Backend dev: `cd backend && uvicorn app.main:app --reload --port 8000`
- Test backend (có sau Phase 2): `pytest backend -q`

## Quy tắc làm việc (để tiết kiệm token)
- Đọc `docs/PLAN.md` để biết đang ở phase nào. Chỉ làm đúng phase đó, dừng khi đạt mục "Xong khi".
- KHÔNG đọc cả repo. Chỉ mở file được nêu trong yêu cầu. Chỉ đọc `docs/API.md` / `docs/ARCHITECTURE.md` khi việc đang làm liên quan.
- Sửa file bằng edit nhỏ, không viết lại cả file. Không thêm tính năng ngoài phase.
- Không tự đổi version dependency. Cần thêm package thì hỏi trước, rồi pin version.
- Khi chạy lệnh dài, chỉ in phần cuối của log (`| tail -30`).
- Không bịa nội dung hay số liệu (thời gian xử lý, RAM...). Chưa đo thì ghi "chưa đo".

## Quy ước
- API đi qua đường dẫn tương đối `/api/...`, không hardcode host/port trong frontend.
- Cấu hình qua biến môi trường (xem `backend/.env.example`).
- Không log nội dung audio hoặc transcript.
- Chỉ nhận file audio hợp lệ: kiểm đuôi, dung lượng và nội dung, không chỉ kiểm đuôi.
- UI và thông báo lỗi bằng tiếng Việt, kiểm tra dấu hiển thị đúng.

## Trạng thái hiện tại
Phase 1 (xem `PLAN.md`). Cập nhật dòng này khi chuyển phase.
