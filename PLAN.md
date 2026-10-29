# Kế hoạch triển khai

Đánh dấu `[x]` khi xong. Mỗi phase làm trong một session riêng. Thứ tự khác ROADMAP: làm phần rủi ro (đo model) trước, deploy sau.

Ghi chú về model AI: "rẻ" = model nhỏ/nhanh đủ cho việc có khuôn mẫu; "mạnh" = chỉ dùng cho quyết định thiết kế hoặc review.

## Phase 0: Dọn nền
Model: rẻ (hoặc tự làm).
- [x] Frontend: thêm `@types/react`, `@types/react-dom` (devDependencies) và file `frontend/src/vite-env.d.ts` với nội dung `/// <reference types="vite/client" />`.
- [x] Đổi `latest` trong `frontend/package.json` thành version cụ thể (lấy từ `npm ls --depth=0` sau khi build qua), chuyển `vite`, `typescript`, `@vitejs/plugin-react` sang devDependencies, commit `package-lock.json`.
- [x] `git init`, commit lần đầu.
- [x] Đặt `CLAUDE.md` ở thư mục gốc.
- Xong khi: `npm --prefix frontend run build` qua và `GET /health` trả `{"status":"ok"}`.

## Phase 1: Đo thử (spike), chưa viết tính năng
Model: rẻ để viết script; bạn tự chạy và ghi số.
- [ ] Script ngắn chạy `faster-whisper` với model `tiny` và `base` trên 1 file 1–2 phút (1 tiếng Việt, 1 tiếng Anh).
- [ ] Chạy trên máy Windows, ghi thời gian xử lý và RAM.
- [ ] Chạy trên Proxmox (i5-3470, không GPU), ghi thời gian xử lý và RAM. Kiểm tra cài và chạy được không (CPU này có thể không có AVX2).
- [ ] Thử 2–3 phương án dịch trên 10 câu mẫu (local hoặc provider). Chấm chất lượng bằng mắt, ghi tốc độ.
- [ ] Điền bảng kết quả bên dưới.
- Xong khi: chốt được model phiên âm cho từng máy và phương án dịch.

| Máy | Model | Độ dài audio | Thời gian xử lý | RAM đỉnh | Ghi chú |
|---|---|---|---|---|---|
| Windows | tiny | | chưa đo | chưa đo | |
| Windows | base | | chưa đo | chưa đo | |
| Proxmox | tiny | | chưa đo | chưa đo | |
| Proxmox | base | | chưa đo | chưa đo | |

| Phương án dịch | Chạy ở đâu | Chất lượng (vi) | Tốc độ | Chọn? |
|---|---|---|---|---|
| | | chưa đo | chưa đo | |

## Phase 2: Backend lõi
Model: mạnh cho phần thiết kế job nền và schema; rẻ cho phần còn lại.
- [ ] Chốt schema SQLite và cập nhật `docs/API.md` trước khi viết code.
- [ ] Kiểm tra nội dung file audio (không chỉ đuôi file). Hiện file text đặt tên `.webm` vẫn nhận 201.
- [ ] `POST /api/transcribe/{audio_id}` chạy nền, có trạng thái (đang chạy / xong / lỗi). Trả transcript, ngôn ngữ phát hiện, thời lượng.
- [ ] `GET /api/recordings` và `DELETE /api/recordings/{audio_id}` (xóa cả file và metadata).
- [ ] Thêm `faster-whisper` vào `requirements.txt` với version cụ thể, đọc `WHISPER_MODEL`, `WHISPER_DEVICE` từ biến môi trường.
- [ ] Viết `pytest` (khoảng 6–8 test): upload hợp lệ, sai đuôi, file rỗng, file giả, quá dung lượng, xóa, transcribe với audio ngắn.
- Xong khi: `pytest backend -q` qua, và gọi API bằng tay với 1 file thật ra được transcript.

## Phase 3: Frontend nối API
Model: rẻ.
- [ ] Tách `App.tsx` thành `Recorder`, `RecordingList`, `TranscriptView` (chưa đổi hành vi).
- [ ] Dùng `/api/...` tương đối; cấu hình proxy trong `vite.config.ts` cho lúc dev. Bỏ CORS cứng nếu không còn cần.
- [ ] Sau khi dừng ghi: upload, gọi transcribe, hiển thị trạng thái (đang tải lên / đang chuyển chữ / lỗi).
- [ ] Lịch sử lấy từ backend, không còn mất khi refresh. Bỏ `window.alert`.
- [ ] Tự host font, bỏ `@import` Google Fonts trong `App.css`.
- Xong khi: ghi âm → thấy transcript → refresh vẫn còn bản ghi. Test tay trên Chrome desktop theo `docs/TEST_CHECKLIST.md`.

## Phase 4: Dịch
Model: mạnh cho phần interface; rẻ cho UI.
- [ ] Interface dịch tách riêng, cắm phương án đã chốt ở Phase 1.
- [ ] `POST /api/translate` chạy thật; lưu bản dịch cùng bản ghi.
- [ ] UI hiển thị transcript gốc và bản dịch song song; cho sửa transcript rồi dịch lại.
- Xong khi: một bản ghi tiếng Anh ra bản dịch tiếng Việt, sửa transcript và dịch lại được.

## Phase 5: Docker và Proxmox
Model: rẻ cho Dockerfile/compose/backup; mạnh cho review bảo mật.
- [ ] Một container: FastAPI phục vụ luôn bản build tĩnh của frontend (cùng origin).
- [ ] `.dockerignore`, chạy bằng user thường, volume cho SQLite và audio, giới hạn RAM cho container.
- [ ] Script backup database và audio.
- [ ] HTTPS để dùng micro trên điện thoại (Caddy hoặc `tailscale serve`).
- [ ] Kiểm tra truy cập từ LAN.
- [ ] Trước khi mở ra ngoài LAN: xác thực bằng token, giới hạn tốc độ, chính sách xóa dữ liệu.
- Xong khi: chạy được trên Proxmox, truy cập từ điện thoại qua HTTPS, khởi động lại container không mất dữ liệu.

## Quyết định còn mở
- [ ] Dịch bằng gì: chạy local hay provider ngoài (chốt sau Phase 1).
- [ ] Độ dài audio điển hình: ngắn (vài phút) hay bài giảng 1–2 giờ.
- [ ] Có cần truy cập ngoài LAN không.

## Nhật ký
Ghi ngắn khi chốt quyết định hoặc đo xong, mỗi dòng một việc, có ngày.
- 2026-10-29: Hoàn thành Phase 0 (dọn nền frontend types/dependencies, backend virtual environment, kiểm tra build và healthcheck).
