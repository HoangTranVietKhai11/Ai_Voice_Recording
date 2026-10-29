#!/usr/bin/env bash
# scripts/backup.sh – Sao lưu SQLite + audio của VoiceNote AI
#
# Cách dùng:
#   bash scripts/backup.sh [--dest /path/to/backups] [--keep 14]
#
# Mặc định:
#   --dest  ./backups   (thư mục lưu bản sao)
#   --keep  14          (số ngày giữ bản sao cũ)
#
# Cron ví dụ (mỗi ngày lúc 2 giờ sáng):
#   0 2 * * * /bin/bash /opt/voicenote/scripts/backup.sh --dest /mnt/nas/voicenote_backups >> /var/log/voicenote_backup.log 2>&1

set -euo pipefail

# ── Tham số mặc định ───────────────────────────────────────────────────
DEST_DIR="./backups"
KEEP_DAYS=14

# ── Parse tham số ──────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
    case "$1" in
        --dest)  DEST_DIR="$2"; shift 2 ;;
        --keep)  KEEP_DAYS="$2"; shift 2 ;;
        *) echo "Tham số không xác định: $1"; exit 1 ;;
    esac
done

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_NAME="voicenote_backup_${TIMESTAMP}"
BACKUP_PATH="${DEST_DIR}/${BACKUP_NAME}"

mkdir -p "${BACKUP_PATH}"

echo "[$(date)] Bắt đầu backup → ${BACKUP_PATH}"

# ── 1. Backup SQLite (dùng .backup của SQLite để tránh corruption) ─────
DB_SRC="${DB_PATH:-./data/db/voicenote.db}"

if [[ -f "${DB_SRC}" ]]; then
    echo "  Sao chép database: ${DB_SRC}"
    sqlite3 "${DB_SRC}" ".backup '${BACKUP_PATH}/voicenote.db'"
    echo "  ✓ Database OK ($(du -sh "${BACKUP_PATH}/voicenote.db" | cut -f1))"
else
    echo "  ⚠ Không tìm thấy DB tại ${DB_SRC}, bỏ qua"
fi

# ── 2. Backup thư mục audio ────────────────────────────────────────────
AUDIO_SRC="${UPLOAD_DIR:-./data/audio}"

if [[ -d "${AUDIO_SRC}" ]]; then
    echo "  Sao chép audio: ${AUDIO_SRC}"
    cp -r "${AUDIO_SRC}" "${BACKUP_PATH}/audio"
    AUDIO_COUNT=$(find "${BACKUP_PATH}/audio" -type f | wc -l)
    AUDIO_SIZE=$(du -sh "${BACKUP_PATH}/audio" | cut -f1)
    echo "  ✓ Audio OK (${AUDIO_COUNT} files, ${AUDIO_SIZE})"
else
    echo "  ⚠ Không tìm thấy thư mục audio tại ${AUDIO_SRC}, bỏ qua"
fi

# ── 3. Nén thành .tar.gz ───────────────────────────────────────────────
ARCHIVE="${DEST_DIR}/${BACKUP_NAME}.tar.gz"
tar -czf "${ARCHIVE}" -C "${DEST_DIR}" "${BACKUP_NAME}"
rm -rf "${BACKUP_PATH}"

ARCHIVE_SIZE=$(du -sh "${ARCHIVE}" | cut -f1)
echo "  ✓ Archive: ${ARCHIVE} (${ARCHIVE_SIZE})"

# ── 4. Dọn bản sao cũ hơn KEEP_DAYS ngày ──────────────────────────────
echo "  Dọn dẹp bản sao cũ hơn ${KEEP_DAYS} ngày..."
find "${DEST_DIR}" -name "voicenote_backup_*.tar.gz" -mtime "+${KEEP_DAYS}" -delete -print \
    | sed 's/^/    Xóa: /' || true

echo "[$(date)] Backup hoàn tất."
