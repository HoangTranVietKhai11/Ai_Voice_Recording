
# Kiểm thử thủ công

## Frontend
- [ ] `npm install` hoàn tất.
- [ ] `npm run dev` chạy được.
- [ ] Trang mở trên `http://localhost:5173`.
- [ ] Trình duyệt xin quyền micro.
- [ ] Start → timer tăng.
- [ ] Pause → timer dừng; resume → timer chạy tiếp.
- [ ] Stop → bản ghi xuất hiện.
- [ ] Có thể nghe lại, tải xuống và xóa.
- [ ] Xóa một bản ghi không làm hỏng các bản ghi khác.
- [ ] Refresh trang sẽ mất danh sách bản ghi ở phiên bản MVP này; đây là giới hạn đã biết.

## Backend
- [ ] Tạo virtual environment và cài requirements.
- [ ] `GET /health` trả `{"status":"ok"}`.
- [ ] Upload file `.webm` từ frontend trả HTTP 201.
- [ ] File được lưu vào `backend/data/audio` (hoặc `UPLOAD_DIR`).
- [ ] File không hợp lệ bị từ chối.
- [ ] File quá dung lượng bị từ chối.

## Trước khi triển khai lên mạng
- [ ] Thêm authentication.
- [ ] Giới hạn tốc độ và dung lượng.
- [ ] HTTPS.
- [ ] Chính sách backup/xóa.
- [ ] Kiểm tra quyền truy cập volume và log.
