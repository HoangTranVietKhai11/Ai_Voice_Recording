import { useEffect, useRef, useState } from 'react'
import { Mic, Pause, Play, Square, Loader2, Sparkles, ShieldCheck, CheckCircle2 } from 'lucide-react'

type RecorderProps = {
  isBusy: boolean
  busyMessage?: string
  onRecordingComplete: (blob: Blob, durationSecs: number, mimeType: string) => void
  onError: (msg: string) => void
}

function formatTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, '0')
  const seconds = (totalSeconds % 60).toString().padStart(2, '0')
  return `${minutes}:${seconds}`
}

export function Recorder({ isBusy, busyMessage, onRecordingComplete, onError }: RecorderProps) {
  const [recording, setRecording] = useState(false)
  const [paused, setPaused] = useState(false)
  const [elapsed, setElapsed] = useState(0)

  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<BlobPart[]>([])
  const startedAtRef = useRef(0)
  const elapsedRef = useRef(0)

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
        <div
          className={`status-dot ${recording ? 'active' : ''} ${isBusy ? 'busy' : ''}`}
        >
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
            : 'Nhấn nút micro để bắt đầu một phiên ghi âm mới'}
      </p>

      <div className="record-controls">
        {!recording ? (
          <button
            className="primary-button"
            disabled={isBusy}
            onClick={startRecording}
          >
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
              <Square size={16} fill="currentColor" /> Dừng ghi & chuyển chữ
            </button>
          </>
        )}
      </div>

      <div className="feature-strip">
        <div>
          <Mic size={17} />
          <span>Ghi âm trực tiếp trên trình duyệt</span>
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
