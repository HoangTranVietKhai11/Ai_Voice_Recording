# ── Stage 1: Build frontend ───────────────────────────────────────────
FROM node:22-alpine AS frontend-builder
WORKDIR /frontend

# Cache npm install riêng
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --prefer-offline

# Build production bundle
COPY frontend/ ./
RUN npm run build
# Output: /frontend/dist/

# ── Stage 2: Runtime ──────────────────────────────────────────────────
FROM python:3.11-slim AS runtime

# Tạo user không có quyền root
RUN groupadd -r voicenote && useradd -r -g voicenote -d /app -s /sbin/nologin voicenote

WORKDIR /app

# Cài Python deps
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source backend
COPY backend/app ./app

# Copy static frontend build
COPY --from=frontend-builder /frontend/dist ./static

# Tạo thư mục data, sở hữu bởi user voicenote
RUN mkdir -p /data/audio /data/db && chown -R voicenote:voicenote /data /app

# Biến môi trường mặc định
ENV UPLOAD_DIR=/data/audio \
    DB_PATH=/data/db/voicenote.db \
    MAX_UPLOAD_MB=100 \
    WHISPER_MODEL=base \
    WHISPER_DEVICE=cpu \
    WHISPER_COMPUTE=int8

EXPOSE 8000

# Chạy bằng user thường
USER voicenote

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
