import { useEffect, useRef, useState } from 'react'
import { Mic, Pause, Play, Square, Loader2, Sparkles, ShieldCheck, Upload, FileAudio, X } from 'lucide-react'

type RecorderProps = {
  isBusy: boolean
  busyMessage?: string
  onRecordingComplete: (blob: Blob, durationSecs: number, mimeType: string) => void
  onError: (msg: string) => void
}

const ACCEPTED_EXTS = [
  '.mp3', '.mp4', '.m4a', '.wav', '.webm', '.ogg',
  '.mov', '.mpeg', '.mpg', '.aac', '.flac', '.mkv', '.wma', '.opus',
]
const ACCEPT_ATTR = 'audio/*,video/*,' + ACCEPTED_EXTS.join(',')

function formatTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0')
  const seconds = (totalSeconds % 60).toString().padStart(2, '0')
  return `${minutes}:${seconds}`
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function Recorder({ isBusy, busyMessage, onRecordingComplete, onError }: RecorderProps) {
  const [recording, setRecording] = useState(false)
  const [paused, setPaused] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [dragOver, setDragOver] = useState(false)
  const [pendingFile, setPendingFile] = useState<File | null>(null)

  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<BlobPart[]>([])
  const startedAtRef = useRef(0)
  const elapsedRef = useRef(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!recording || paused) return
    const timer = window.setInterval(() => {
      setElapsed(elapsedRef.current + Math.floor((Date.now() - startedAtRef.current) / 1000))
    }, 250)
    return () => window.clearInterval(timer)
  }, [recording, paused])

  useEffect(() => {
    return () => {
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        recorderRef.current.stop()
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
      }
    }
  }, [])

  // ── Validate file extension ─────────────────────────────────────────
  function isValidExt(file: File) {
    const ext = '.' + file.name.split('.').pop()?.toLowerCase()
    if (ACCEPTED_EXTS.includes(ext)) return true
    if (file.type && (file.type.startsWith('audio/') || file.type.startsWith('video/'))) return true
    return false
  }

  function handleFileSelect(file: File) {
    if (!isValidExt(file)) {
      onError(`Định dạng không hỗ trợ: ${file.name}. Vui lòng chọn file âm thanh hoặc video.`)
      return
    }
    if (file.size > 300 * 1024 * 1024) {
      onError('File quá lớn (tối đa 300 MB).')
      return
    }
    setPendingFile(file)
    onError('')
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFileSelect(file)
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFileSelect(file)
    e.target.value = ''
  }

  async function uploadPendingFile() {
    if (!pendingFile) return
    const mimeType = pendingFile.type || 'audio/mpeg'
    onRecordingComplete(pendingFile, 0, mimeType)
    setPendingFile(null)
  }

  // ── Microphone recording ────────────────────────────────────────────
  async function startRecording() {
    onError('')
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      onError('Trình duyệt chưa hỗ trợ ghi âm. Hãy dùng Chrome hoặc Edge bản mới trên localhost/HTTPS.')
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      const preferredType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find((type) =>
        MediaRecorder.isTypeSupported(type),
      )
      const recorder = preferredType
        ? new MediaRecorder(stream, { mimeType: preferredType })
        : new MediaRecorder(stream)

      recorderRef.current = recorder
      chunksRef.current = []
      elapsedRef.current = 0
      setElapsed(0)
      startedAtRef.current = Date.now()

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data)
      }

      recorder.onstop = () => {
        const mimeType = recorder.mimeType || 'audio/webm'
        const blob = new Blob(chunksRef.current, { type: mimeType })
        const totalDuration = elapsedRef.current

        stream.getTracks().forEach((track) => track.stop())
        streamRef.current = null
        setRecording(false)
        setPaused(false)

        if (blob.size > 0) {
          onRecordingComplete(blob, totalDuration, mimeType)
        } else {
          onError('Bản ghi không có dữ liệu âm thanh.')
        }
      }

      recorder.start(1000)
      setRecording(true)
      setPaused(false)
    } catch (err) {
      console.error(err)
      onError('Không mở được micro. Vui lòng cấp quyền micro cho trình duyệt.')
    }
  }

  function pauseRecording() {
    const recorder = recorderRef.current
    if (!recorder || recorder.state !== 'recording') return
    elapsedRef.current += Math.floor((Date.now() - startedAtRef.current) / 1000)
    recorder.pause()
    setElapsed(elapsedRef.current)
    setPaused(true)
  }

  function resumeRecording() {
    const recorder = recorderRef.current
    if (!recorder || recorder.state !== 'paused') return
    startedAtRef.current = Date.now()
    recorder.resume()
    setPaused(false)
  }

  function stopRecording() {
    const recorder = recorderRef.current
    if (!recorder || recorder.state === 'inactive') return
    if (!paused) {
      elapsedRef.current += Math.floor((Date.now() - startedAtRef.current) / 1000)
    }
    setElapsed(elapsedRef.current)
    recorder.stop()
  }

  return (
    <section className="recorder-card">
      <div className="card-heading">
        <div>
          <p className="eyebrow">BẢN GHI MỚI</p>
          <h2>
            {isBusy
              ? busyMessage || 'Đang xử lý...'
              : recording
                ? paused
                  ? 'Đang tạm dừng'
                  : 'Đang ghi âm'
                : 'Sẵn sàng ghi âm'}
          </h2>
        </div>
        <div className={`status-dot ${recording ? 'active' : ''} ${isBusy ? 'busy' : ''}`}>
          <span />
          {isBusy
            ? 'PROCESSING'
            : recording
              ? paused
                ? 'PAUSED'
                : 'RECORDING'
              : 'READY'}
        </div>
      </div>

      <div className="timer">{formatTime(elapsed)}</div>
      <p className="timer-caption">
        {isBusy
          ? busyMessage || 'Đang tải lên và xử lý qua Whisper AI...'
          : recording
            ? 'Thời lượng phiên ghi âm hiện tại'
            : 'Nhấn nút micro để ghi hoặc kéo thả file âm thanh bên dưới'}
      </p>

      <div className="record-controls">
        {!recording ? (
          <button className="primary-button" disabled={isBusy} onClick={startRecording}>
            {isBusy ? <Loader2 size={19} className="spin" /> : <Mic size={19} />}
            {isBusy ? 'Đang xử lý...' : 'Bắt đầu ghi'}
          </button>
        ) : (
          <>
            {paused ? (
              <button className="primary-button" onClick={resumeRecording}>
                <Play size={18} /> Tiếp tục
              </button>
            ) : (
              <button className="secondary-button" onClick={pauseRecording}>
                <Pause size={18} /> Tạm dừng
              </button>
            )}
            <button className="stop-button" onClick={stopRecording}>
              <Square size={16} fill="currentColor" /> Dừng ghi &amp; chuyển chữ
            </button>
          </>
        )}
      </div>

      {/* ── Upload file khu vực ────────────────────────────────────── */}
      {!recording && (
        <div
          className={`upload-zone ${dragOver ? 'drag-over' : ''} ${isBusy ? 'disabled' : ''}`}
          onDragOver={(e) => { e.preventDefault(); if (!isBusy) setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={!isBusy ? handleDrop : undefined}
          onClick={() => !isBusy && !pendingFile && fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPT_ATTR}
            style={{ display: 'none' }}
            onChange={handleInputChange}
          />

          {pendingFile ? (
            <div className="upload-pending">
              <FileAudio size={22} className="upload-file-icon" />
              <div className="upload-pending-info">
                <span className="upload-filename">{pendingFile.name}</span>
                <span className="upload-filesize">{formatBytes(pendingFile.size)}</span>
              </div>
              <div className="upload-pending-actions">
                <button
                  className="primary-button upload-confirm-btn"
                  onClick={(e) => { e.stopPropagation(); uploadPendingFile() }}
                  disabled={isBusy}
                >
                  <Upload size={15} /> Tải lên &amp; Phiên âm
                </button>
                <button
                  className="icon-btn"
                  onClick={(e) => { e.stopPropagation(); setPendingFile(null) }}
                  title="Hủy"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          ) : (
            <div className="upload-hint">
              <Upload size={22} className="upload-icon" />
              <span className="upload-main-text">Chạm để chọn file hoặc kéo thả</span>
              <span className="upload-exts">
                Ghi âm điện thoại, Voice Memos, MP3, MP4, M4A, WAV, WebM...
              </span>
            </div>
          )}
        </div>
      )}

      <div className="feature-strip">
        <div>
          <Mic size={17} />
          <span>Ghi âm trực tiếp trên trình duyệt</span>
        </div>
        <div>
          <Upload size={17} />
          <span>Upload file có sẵn (MP3, MP4, MOV...)</span>
        </div>
        <div>
          <Sparkles size={17} />
          <span>Whisper AI chuyển giọng nói sang văn bản</span>
        </div>
        <div>
          <ShieldCheck size={17} />
          <span>Lưu trữ nội bộ an toàn (Local SQLite)</span>
        </div>
      </div>
    </section>
  )
}
