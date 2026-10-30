# Hướng dẫn triển khai VoiceNote AI trên Proxmox

## Yêu cầu phần cứng tối thiểu

| Thành phần | Tối thiểu | Khuyến nghị |
|---|---|---|
| CPU | i5-3470 (4 core) | 4+ core |
| RAM | 4 GB (dành cho container) | 6–8 GB |
| Ổ đĩa | 20 GB | 50 GB SSD |
| OS trong VM/CT | Debian 12 / Ubuntu 22.04 | Debian 12 |

> **Lưu ý RAM Whisper:** model `base` ~350 MB, `small` ~900 MB. Cộng với FastAPI + OS cần ít nhất 2 GB RAM khả dụng.

---

## Bước 1: Chuẩn bị môi trường Proxmox

### 1a. Tạo LXC Container (nhẹ hơn VM)

Trên Proxmox web UI hoặc shell:

```bash
# Template Debian 12 (tải nếu chưa có)
pveam download local debian-12-standard_12.7-1_amd64.tar.zst

# Tạo container (thay CTID và STORAGE cho phù hợp)
pct create 200 local:vztmpl/debian-12-standard_12.7-1_amd64.tar.zst \
    --hostname voicenote \
    --cores 2 \
    --memory 3072 \
    --swap 512 \
    --rootfs local-lvm:20 \
    --net0 name=eth0,bridge=vmbr0,ip=dhcp \
    --unprivileged 1 \
    --features nesting=1    # Cần cho Docker trong LXC

pct start 200
pct exec 200 -- bash -l
```

### 1b. Cài Docker trong container

```bash
apt update && apt install -y curl ca-certificates sqlite3
curl -fsSL https://get.docker.com | bash
systemctl enable --now docker
```

---

## Bước 2: Deploy ứng dụng

```bash
# Clone repo vào máy chủ
cd /opt
git clone <URL_REPO> voicenote
cd voicenote

# Tạo file .env từ mẫu
cp backend/.env.example .env
```

### Chỉnh `.env` cho production

```bash
nano .env
```

```dotenv
APP_NAME=VoiceNote AI
UPLOAD_DIR=/data/audio
DB_PATH=/data/db/voicenote.db
MAX_UPLOAD_MB=150
WHISPER_MODEL=base        # Đổi thành tiny nếu RAM < 2GB
WHISPER_DEVICE=cpu
WHISPER_COMPUTE=int8
TRANSLATION_PROVIDER=google

# BẮT BUỘC đặt trước khi mở ra ngoài LAN:
API_TOKEN=THAY_BANG_MAT_KHAU_NGAU_NHIEN_DAI_IT_NHAT_32_KY_TU
```

> Tạo token ngẫu nhiên: `python3 -c "import secrets; print(secrets.token_urlsafe(32))"`

---

## Bước 3: Cấu hình HTTPS với Caddy

### Trường hợp A: LAN nội bộ (TLS tự ký)

Giữ nguyên `Caddyfile` mặc định. Trình duyệt sẽ cảnh báo lần đầu:

1. Chrome: nhấn **Advanced → Proceed to site**
2. Hoặc cài CA của Caddy vào thiết bị: `caddy trust` (trên máy chủ)

### Trường hợp B: Tailscale HTTPS (không cần domain công khai)

```bash
# Cài Tailscale trong container
curl -fsSL https://tailscale.com/install.sh | sh
tailscale up --accept-routes

# Bật Tailscale HTTPS (tên máy: voicenote.tailXXXXX.ts.net)
tailscale cert voicenote.tailXXXXX.ts.net
```

Cập nhật `Caddyfile`:
```caddyfile
voicenote.tailXXXXX.ts.net {
    reverse_proxy app:8000
}
```

### Trường hợp C: Domain công khai với Let's Encrypt

```caddyfile
voicenote.example.com {
    reverse_proxy app:8000
}
```

---

## Bước 4: Build và khởi động

```bash
# Build image (lần đầu ~5-10 phút, tải model Whisper)
docker compose build

# Khởi động
docker compose up -d

# Kiểm tra logs
docker compose logs -f app

# Kiểm tra health
curl http://localhost:8000/health
```

---

## Bước 5: Kiểm tra truy cập từ LAN

```bash
# Lấy IP của container
ip addr show eth0

# Từ điện thoại hoặc máy khác trong LAN:
# Mở trình duyệt → https://<IP_PROXMOX>
# (chấp nhận cảnh báo TLS tự ký nếu dùng mode LAN)
```

---

## Bước 6: Thiết lập backup tự động

```bash
# Cài crontab chạy backup mỗi ngày 2 giờ sáng
crontab -e
```

Thêm dòng:
```cron
0 2 * * * /bin/bash /opt/voicenote/scripts/backup.sh \
    --dest /opt/voicenote/backups \
    --keep 14 \
    >> /var/log/voicenote_backup.log 2>&1
```

---

## Bước 7: Kiểm tra sau khi deploy

```bash
# 1. Health API
curl https://<IP>/health

# 2. Upload test (với token)
curl -k -X POST https://<IP>/api/audio \
  -H "Authorization: Bearer <API_TOKEN>" \
  -F "file=@test.wav"

# 3. Xem logs whisper khi transcribe
docker compose logs -f app | grep -i whisper

# 4. Restart không mất data
docker compose restart app
curl https://<IP>/api/recordings  # Vẫn còn dữ liệu
```

---

## Cập nhật phiên bản mới

```bash
cd /opt/voicenote
git pull
docker compose build
docker compose up -d
```

---

## Gỡ lỗi thường gặp

| Vấn đề | Nguyên nhân | Giải pháp |
|---|---|---|
| Container OOM (bị kill) | RAM không đủ cho Whisper | Dùng `WHISPER_MODEL=tiny` hoặc tăng RAM |
| Micro không hoạt động | Trang không có HTTPS | Cấu hình Caddy đúng, dùng HTTPS |
| Upload thất bại (413) | File vượt MAX_UPLOAD_MB | Tăng `MAX_UPLOAD_MB` trong .env |
| Transcribe chậm | CPU yếu, model lớn | Dùng `WHISPER_MODEL=tiny` hoặc `WHISPER_COMPUTE=int8` |
| Lỗi 401 | Thiếu header Authorization | Đặt `API_TOKEN` đúng trong frontend |

---

## Truy cập Public trên Điện thoại / 4G (Cloudflare Tunnel)

Để điện thoại mở được trực tiếp qua 4G/5G hoặc chia sẻ bạn bè mà không cần cài VPN:

```bash
docker run -d --name voicenote-tunnel \
  --restart unless-stopped \
  --network voicenote_default \
  cloudflare/cloudflared:latest tunnel \
  --no-autoupdate \
  --url http://voicenote-caddy:80
```

Xem đường link public tự sinh:
```bash
docker logs voicenote-tunnel 2>&1 | grep -o 'https://.*\.trycloudflare\.com'
```

