
# AI Voice Recorder — Project Blueprint & MVP

Ứng dụng web/PWA ghi âm bài giảng, cuộc họp và hội thoại ngoại ngữ; chuyển giọng nói thành văn bản (transcription), dịch sang tiếng Việt hoặc ngôn ngữ được chọn, lưu lịch sử và ưu tiên xử lý dữ liệu nội bộ.

> Đây là bộ khung dự án và tài liệu triển khai. Frontend MVP có thể chạy ngay. Backend FastAPI và tích hợp Whisper/translation là skeleton được đánh dấu TODO, chưa phải hệ thống production hoàn chỉnh.

## Mục tiêu MVP
- Ghi âm từ micro: bắt đầu, tạm dừng, tiếp tục, dừng.
- Nghe lại, tải file âm thanh xuống, xóa bản ghi.
- Backend API nhận tệp âm thanh.
- Chuyển âm thanh thành văn bản bằng mô hình Whisper chạy local.
- Dịch văn bản bằng mô hình local hoặc nhà cung cấp được cấu hình rõ ràng.
- Lưu lịch sử bản ghi và kết quả.
- Đóng gói Docker để triển khai sau khi kiểm thử trên Windows; có thể chuyển lên Proxmox.

## Công nghệ đề xuất
- Frontend: React + TypeScript + Vite.
- Backend: Python + FastAPI.
- Speech-to-text: `faster-whisper` (Whisper inference chạy local).
- Translation: giai đoạn đầu dùng interface tách biệt; chọn mô hình dịch local sau khi đo tài nguyên, hoặc tích hợp provider theo lựa chọn người dùng.
- Database: SQLite cho MVP; PostgreSQL khi cần nhiều người dùng.
- Deployment: Docker Compose sau khi chạy ổn định trên Windows.

## Yêu cầu
- Node.js LTS.
- Python 3.11+ (backend).
- Trình duyệt hiện đại, quyền dùng micro.
- Microphone.
- Ghi âm trên web cần secure context: `localhost` hoặc HTTPS. Truy cập bằng IP LAN từ điện thoại có thể cần HTTPS.

## Chạy frontend
```powershell
cd frontend
npm install
npm run dev
```
Mở URL Vite in ra, thường là `http://localhost:5173`.

## Chạy backend skeleton
```powershell
cd backend
python -m venv .venv
# Windows PowerShell
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```
Kiểm tra `http://127.0.0.1:8000/health`.

## Kế hoạch thực hiện
1. Chạy và kiểm thử frontend ghi âm.
2. Tạo API nhận file âm thanh và trả thông tin file.
3. Tích hợp `faster-whisper`, kiểm thử một file ngắn.
4. Thêm bước dịch tách biệt.
5. Thêm lịch sử bền vững bằng SQLite và quản lý file.
6. Thêm PWA/offline UX nếu cần.
7. Docker Compose và triển khai lên Proxmox sau khi kiểm thử.

## Quyền riêng tư và an toàn
- Mặc định thiết kế hướng local-first; không gửi âm thanh ra bên ngoài nếu chưa cấu hình rõ.
- Ghi rõ khi nào dùng mô hình/provider bên ngoài.
- Không ghi log nội dung âm thanh/văn bản nhạy cảm.
- Thêm xác thực, giới hạn dung lượng, kiểm tra loại file, quota và chính sách xóa trước khi mở ra Internet.
- Không triển khai trực tiếp public Internet khi chưa có HTTPS và xác thực.
