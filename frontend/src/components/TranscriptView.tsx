import { useEffect, useState } from 'react'
import {
  Copy,
  Check,
  AlertCircle,
  Loader2,
  Sparkles,
  Globe,
  Clock,
  Languages,
  Edit3,
  Save,
  X,
  RotateCcw,
} from 'lucide-react'
import type { RecordingItem } from '../types'

type TranscriptViewProps = {
  item: RecordingItem
  onRetryTranscribe: (audio_id: string) => void
  onSaveTranscript: (audio_id: string, text: string) => Promise<void>
  onTranslate: (audio_id: string, target_lang: string, text?: string) => Promise<void>
}

function formatDuration(secs: number | null) {
  if (secs === null || secs === undefined) return '--:--'
  const m = Math.floor(secs / 60)
  const s = Math.floor(secs % 60)
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

export function TranscriptView({
  item,
  onRetryTranscribe,
  onSaveTranscript,
  onTranslate,
}: TranscriptViewProps) {
  const [copiedTranscript, setCopiedTranscript] = useState(false)
  const [copiedTranslation, setCopiedTranslation] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [draftText, setDraftText] = useState(item.transcript || '')
  const [saving, setSaving] = useState(false)
  const [translating, setTranslating] = useState(false)
  const [targetLang, setTargetLang] = useState(item.translation_lang || 'vi')
  const [translateError, setTranslateError] = useState('')

  useEffect(() => {
    if (!isEditing) {
      setDraftText(item.transcript || '')
    }
  }, [item.transcript, isEditing])

  const handleCopyTranscript = async () => {
    if (!item.transcript) return
    try {
      await navigator.clipboard.writeText(item.transcript)
      setCopiedTranscript(true)
      setTimeout(() => setCopiedTranscript(false), 2000)
    } catch (e) {
      console.error(e)
    }
  }

  const handleCopyTranslation = async () => {
    if (!item.translation) return
    try {
      await navigator.clipboard.writeText(item.translation)
      setCopiedTranslation(true)
      setTimeout(() => setCopiedTranslation(false), 2000)
    } catch (e) {
      console.error(e)
    }
  }

  const handleSaveOnly = async () => {
    setSaving(true)
    try {
      await onSaveTranscript(item.audio_id, draftText)
      setIsEditing(false)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setTranslateError(msg)
    } finally {
      setSaving(false)
    }
  }

  const handleTranslateClick = async () => {
    setTranslating(true)
    setTranslateError('')
    try {
      const textToUse = isEditing ? draftText : (item.transcript || draftText)
      await onTranslate(item.audio_id, targetLang, textToUse)
      setIsEditing(false)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setTranslateError(msg)
    } finally {
      setTranslating(false)
    }
  }

  return (
    <div className="transcript-box">
      <div className="transcript-header">
        <div className="transcript-meta">
          <span className="transcript-badge">
            <Sparkles size={13} />
            {item.status === 'done'
              ? 'Whisper Transcript'
              : item.status === 'transcribing'
                ? 'Đang nhận diện...'
                : item.status === 'error'
                  ? 'Lỗi phiên âm'
                  : 'Chưa phiên âm'}
          </span>

          {item.language && (
            <span className="transcript-tag">
              <Globe size={12} />
              {item.language.toUpperCase()}
            </span>
          )}

          {item.duration_secs !== null && (
            <span className="transcript-tag">
              <Clock size={12} />
              {formatDuration(item.duration_secs)}
            </span>
          )}
        </div>

        {item.status === 'done' && (
          <div className="transcript-actions-bar">
            {!isEditing ? (
              <button
                className="tool-btn"
                onClick={() => setIsEditing(true)}
                title="Chỉnh sửa văn bản phiên âm"
              >
                <Edit3 size={13} />
                <span>Sửa</span>
              </button>
            ) : (
              <button
                className="tool-btn text-muted"
                onClick={() => {
                  setDraftText(item.transcript || '')
                  setIsEditing(false)
                }}
                title="Hủy sửa"
              >
                <X size={13} />
                <span>Hủy</span>
              </button>
            )}

            {item.transcript && !isEditing && (
              <button
                className="tool-btn"
                onClick={handleCopyTranscript}
                title="Sao chép transcript gốc"
              >
                {copiedTranscript ? <Check size={13} className="text-success" /> : <Copy size={13} />}
                <span>{copiedTranscript ? 'Đã chép' : 'Sao chép'}</span>
              </button>
            )}
          </div>
        )}
      </div>

      <div className="transcript-body">
        {item.status === 'transcribing' && (
          <div className="transcript-loading">
            <Loader2 size={18} className="spin" />
            <span>Đang chuyển âm thanh sang văn bản bằng Whisper AI...</span>
          </div>
        )}

        {item.status === 'error' && (
          <div className="transcript-error">
            <div className="error-row">
              <AlertCircle size={16} />
              <span>{item.error_message || 'Có lỗi xảy ra trong quá trình nhận diện âm thanh.'}</span>
            </div>
            <button className="retry-button" onClick={() => onRetryTranscribe(item.audio_id)}>
              <RotateCcw size={14} /> Thử phiên âm lại
            </button>
          </div>
        )}

        {item.status === 'uploaded' && (
          <div className="transcript-pending">
            <span>Bản ghi đã được tải lên máy chủ.</span>
            <button className="start-transcribe-button" onClick={() => onRetryTranscribe(item.audio_id)}>
              <Sparkles size={14} /> Bắt đầu chuyển chữ ngay
            </button>
          </div>
        )}

        {item.status === 'done' && (
          <div className="dual-view-container">
            {/* Cột 1: Transcript gốc */}
            <div className="dual-column">
              <div className="column-label">
                <span>Văn bản phiên âm gốc {item.language ? `(${item.language.toUpperCase()})` : ''}</span>
                {isEditing && <span className="editing-indicator">Đang chỉnh sửa</span>}
              </div>

              {isEditing ? (
                <div className="edit-area-wrapper">
                  <textarea
                    className="transcript-textarea"
                    value={draftText}
                    rows={4}
                    onChange={(e) => setDraftText(e.target.value)}
                    placeholder="Nhập nội dung chỉnh sửa..."
                  />
                  <div className="edit-buttons">
                    <button
                      className="save-btn"
                      disabled={saving || translating}
                      onClick={handleSaveOnly}
                    >
                      {saving ? <Loader2 size={13} className="spin" /> : <Save size={13} />}
                      <span>Lưu lại</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="transcript-content">
                  {item.transcript ? (
                    <p>{item.transcript}</p>
                  ) : (
                    <em className="text-muted">(Không phát hiện giọng nói hoặc âm thanh trống)</em>
                  )}
                </div>
              )}
            </div>

            {/* Cột 2: Bản dịch song song */}
            <div className="dual-column translation-column">
              <div className="column-label">
                <div className="label-left">
                  <Languages size={14} className="text-accent" />
                  <span>Bản dịch sang</span>
                  <select
                    className="lang-select"
                    value={targetLang}
                    disabled={translating}
                    onChange={(e) => setTargetLang(e.target.value)}
                  >
                    <option value="vi">Tiếng Việt (VI)</option>
                    <option value="en">English (EN)</option>
                    <option value="zh">中文 (ZH)</option>
                    <option value="ja">日本語 (JA)</option>
                    <option value="fr">Français (FR)</option>
                  </select>
                </div>

                {item.translation && (
                  <button
                    className="tool-btn"
                    onClick={handleCopyTranslation}
                    title="Sao chép bản dịch"
                  >
                    {copiedTranslation ? (
                      <Check size={13} className="text-success" />
                    ) : (
                      <Copy size={13} />
                    )}
                    <span>{copiedTranslation ? 'Đã chép' : 'Chép dịch'}</span>
                  </button>
                )}
              </div>

              <div className="translation-content">
                {translating ? (
                  <div className="transcript-loading">
                    <Loader2 size={16} className="spin" />
                    <span>Đang dịch thuật văn bản...</span>
                  </div>
                ) : item.translation ? (
                  <p>{item.translation}</p>
                ) : (
                  <div className="empty-translation">
                    <span className="text-muted">Chưa có bản dịch cho đoạn ghi âm này.</span>
                  </div>
                )}

                <div className="translation-actions">
                  <button
                    className="translate-trigger-btn"
                    disabled={translating || (!item.transcript && !draftText.trim())}
                    onClick={handleTranslateClick}
                  >
                    {translating ? (
                      <Loader2 size={14} className="spin" />
                    ) : (
                      <Languages size={14} />
                    )}
                    <span>
                      {item.translation
                        ? isEditing
                          ? 'Cập nhật & Dịch lại'
                          : 'Dịch lại'
                        : 'Dịch sang ' + (targetLang === 'vi' ? 'tiếng Việt' : targetLang.toUpperCase())}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {translateError && (
          <div className="error-row mt-2">
            <AlertCircle size={15} />
            <span>{translateError}</span>
          </div>
        )}
      </div>
    </div>
  )
}
