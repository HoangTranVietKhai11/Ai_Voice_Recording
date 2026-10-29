
# Product specification

## Vấn đề
Người dùng cần ghi lại bài giảng, cuộc họp hoặc hội thoại ngoại ngữ, sau đó xem transcript và bản dịch để ôn tập.

## Người dùng mục tiêu
- Sinh viên ghi âm bài giảng.
- Nhân viên ghi chú cuộc họp.
- Người học ngoại ngữ cần transcript và bản dịch.

## Luồng chính
1. Mở ứng dụng và cấp quyền microphone.
2. Bấm ghi âm; có thể pause/resume.
3. Dừng ghi âm, nghe lại hoặc tải file.
4. Chọn ngôn ngữ nguồn: tự động hoặc ngôn ngữ cụ thể.
5. Chọn ngôn ngữ đích, mặc định tiếng Việt.
6. Gửi audio tới backend local để transcription.
7. Dịch transcript; cho phép sửa transcript và chạy dịch lại.
8. Lưu bản ghi, transcript, bản dịch và metadata.
9. Tìm kiếm lịch sử, đổi tên, tải xuống hoặc xóa.

## Phạm vi MVP
### Bao gồm
- Recorder chạy trên trình duyệt.
- Upload audio tới API.
- Transcription local.
- Bản dịch thành một trường riêng.
- Lịch sử cơ bản.

### Chưa bao gồm
- Nhận dạng người nói/diarization.
- Đồng bộ nhiều thiết bị.
- Tài khoản đa người dùng.
- Tóm tắt cuộc họp nâng cao.
- Chia sẻ công khai.
- Ứng dụng mobile native.

## Yêu cầu phi chức năng
- Báo trạng thái rõ ràng: đang ghi, đang tải lên, đang chuyển chữ, đang dịch, lỗi.
- Không làm mất file khi người dùng chuyển trang; sau MVP cần lưu bền vững.
- Xử lý lỗi micro bị từ chối, trình duyệt không hỗ trợ codec, upload quá lớn, model thiếu RAM.
- Có thể chạy offline/local sau khi cài model.
- Mọi dữ liệu và model path có thể cấu hình qua biến môi trường.
