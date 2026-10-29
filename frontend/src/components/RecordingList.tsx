import { useState } from 'react'
import { Mic, Download, Trash2, Clock, Calendar, HardDrive, RefreshCw } from 'lucide-react'
import type { RecordingItem } from '../types'
import { TranscriptView } from './TranscriptView'

type RecordingListProps = {
  items: RecordingItem[]
  loading: boolean
  onDelete: (audio_id: string) => Promise<void>
  onRetryTranscribe: (audio_id: string) => void
  onSaveTranscript: (audio_id: string, text: string) => Promise<void>
  onTranslate: (audio_id: string, target_lang: string, text?: string) => Promise<void>
  onRefresh: () => void
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function formatDate(isoString: string) {
  try {
    const d = new Date(isoString)
    return d.toLocaleString('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  } catch {
    return isoString
  }
}

export function RecordingList({
  items,
  loading,
  onDelete,
  onRetryTranscribe,
  onSaveTranscript,
  onTranslate,
  onRefresh,
}: RecordingListProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const handleDelete = async (audio_id: string) => {
    setDeletingId(audio_id)
    try {
      await onDelete(audio_id)
    } finally {
      setDeletingId(null)
    }
  }

  const handleDownload = (item: RecordingItem) => {
    const link = document.createElement('a')
    link.href = `/api/audio/${item.audio_id}`
    link.download = item.filename || `recording_${item.audio_id}${item.suffix || '.webm'}`
    link.click()
  }

  return (
    <section className="history-section">
      <div className="section-heading">
        <div>
          <p className="eyebrow">YOUR LIBRARY</p>
          <h2>
            Lịch sử ghi âm <span className="count">{items.length}</span>
          </h2>
        </div>
        <div className="section-actions">
          <button
            className="refresh-button"
            onClick={onRefresh}
            title="Làm mới danh sách"
            disabled={loading}
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
            <span>Đồng bộ</span>
          </button>
          <p className="section-note">Dữ liệu lưu an toàn trong SQLite backend</p>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">
            <Mic size={24} />
          </div>
          <h3>Chưa có bản ghi nào</h3>
          <p>Bản ghi âm và văn bản phiên âm sẽ tự động lưu lại đây sau khi bạn ghi âm.</p>
        </div>
      ) : (
        <div className="recording-list">
          {items.map((item) => (
            <article className="recording-card-item" key={item.audio_id}>
              <div className="item-main-header">
                <div className="audio-icon">
                  <Mic size={18} />
                </div>
                <div className="recording-meta-header">
                  <strong>{item.filename || `Bản ghi ${item.audio_id.slice(0, 8)}`}</strong>
                  <div className="meta-subline">
                    <span>
                      <Calendar size={12} /> {formatDate(item.created_at)}
                    </span>
                    <span>
                      <HardDrive size={12} /> {formatBytes(item.size_bytes)}
                    </span>
                    {item.duration_secs !== null && (
                      <span>
                        <Clock size={12} /> {Math.round(item.duration_secs)}s
                      </span>
                    )}
                  </div>
                </div>

                <div className="item-actions">
                  <button
                    title="Tải file âm thanh về máy"
                    aria-label="Tải file"
                    onClick={() => handleDownload(item)}
                  >
                    <Download size={16} />
                  </button>
                  <button
                    title="Xóa bản ghi"
                    aria-label="Xóa bản ghi"
                    disabled={deletingId === item.audio_id}
                    onClick={() => handleDelete(item.audio_id)}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              <div className="audio-player-wrapper">
                <audio controls preload="metadata" src={`/api/audio/${item.audio_id}`} />
              </div>

              <TranscriptView
                item={item}
                onRetryTranscribe={onRetryTranscribe}
                onSaveTranscript={onSaveTranscript}
                onTranslate={onTranslate}
              />
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
