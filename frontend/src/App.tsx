import { useEffect, useRef, useState } from 'react'
import { Mic, Pause, Play, Square, Trash2, Download, Languages, ShieldCheck } from 'lucide-react'

type Recording = {
  id: string
  name: string
  url: string
  blob: Blob
  createdAt: Date
  duration: number
}

function formatTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0')
  const seconds = (totalSeconds % 60).toString().padStart(2, '0')
  return `${minutes}:${seconds}`
}

function extensionFor(type: string) {
  if (type.includes('mp4')) return 'm4a'
  if (type.includes('ogg')) return 'ogg'
  if (type.includes('wav')) return 'wav'
  return 'webm'
}

export default function App() {
  const [items, setItems] = useState<Recording[]>([])
  const [recording, setRecording] = useState(false)
  const [paused, setPaused] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<BlobPart[]>([])
  const startedAtRef = useRef(0)
  const elapsedRef = useRef(0)
  const itemsRef = useRef<Recording[]>([])

  useEffect(() => {
    itemsRef.current = items
  }, [items])

  useEffect(() => {
    if (!recording || paused) return
    const timer = window.setInterval(() => {
      setElapsed(elapsedRef.current + Math.floor((Date.now() - startedAtRef.current) / 1000))
    }, 250)
    return () => window.clearInterval(timer)
  }, [recording, paused])

  useEffect(() => {
    return () => {
      if (recorderRef.current?.state !== 'inactive') recorderRef.current?.stop()
      streamRef.current?.getTracks().forEach((track) => track.stop())
      itemsRef.current.forEach((item) => URL.revokeObjectURL(item.url))
    }
  }, [])

  async function startRecording() {
    setError('')
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('Trình duyệt chưa hỗ trợ ghi âm. Hãy dùng Chrome/Edge bản mới và mở qua localhost hoặc HTTPS.')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const preferredType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']
        .find((type) => MediaRecorder.isTypeSupported(type))
      const recorder = preferredType ? new MediaRecorder(stream, { mimeType: preferredType }) : new MediaRecorder(stream)
      recorderRef.current = recorder
      chunksRef.current = []
      elapsedRef.current = 0
      setElapsed(0)
      startedAtRef.current = Date.now()
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data)
      }
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' })
        if (blob.size > 0) {
          const url = URL.createObjectURL(blob)
          const newItem: Recording = {
            id: crypto.randomUUID(),
            name: `Bản ghi ${new Date().toLocaleString('vi-VN')}`,
            url,
            blob,
            createdAt: new Date(),
            duration: elapsedRef.current,
          }
          setItems((current) => [newItem, ...current])
        }
        stream.getTracks().forEach((track) => track.stop())
        streamRef.current = null
        setRecording(false)
        setPaused(false)
      }
      recorder.start(1000)
      setRecording(true)
      setPaused(false)
    } catch {
      setError('Không mở được microphone. Hãy kiểm tra quyền micro của trình duyệt và thiết bị đầu vào.')
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
    if (!paused) elapsedRef.current += Math.floor((Date.now() - startedAtRef.current) / 1000)
    setElapsed(elapsedRef.current)
    recorder.stop()
  }

  function deleteRecording(id: string) {
    setItems((current) => {
      const target = current.find((item) => item.id === id)
      if (target) URL.revokeObjectURL(target.url)
      return current.filter((item) => item.id !== id)
    })
  }

  function downloadRecording(item: Recording) {
    const link = document.createElement('a')
    link.href = item.url
    link.download = `${item.name.replace(/[^\p{L}\p{N}_-]+/gu, '_')}.${extensionFor(item.blob.type)}`
    link.click()
  }

  async function sendToBackend(item: Recording) {
    setBusy(true)
    setError('')
    try {
      const form = new FormData()
      const filename = `recording.${extensionFor(item.blob.type)}`
      form.append('file', item.blob, filename)
      const response = await fetch('http://127.0.0.1:8000/api/audio', { method: 'POST', body: form })
      if (!response.ok) throw new Error('Upload thất bại')
      const result = await response.json()
      window.alert(`Đã gửi tới backend. Audio ID: ${result.audio_id}`)
    } catch {
      setError('Chưa kết nối được backend tại http://127.0.0.1:8000. Hãy khởi động backend trước.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-mark"><Mic size={22} /></div>
        <div>
          <div className="brand-title">VoiceNote <span>AI</span></div>
          <div className="brand-subtitle">Ghi âm · Phiên âm · Dịch thuật</div>
        </div>
        <div className="privacy-pill"><ShieldCheck size={15} /> Ưu tiên riêng tư</div>
      </header>

      <section className="hero">
        <p className="eyebrow">LOCAL-FIRST VOICE WORKSPACE</p>
        <h1>Đừng bỏ lỡ <span>ý tưởng quan trọng.</span></h1>
        <p className="hero-copy">Ghi lại bài giảng, cuộc họp và hội thoại. Phiên âm và dịch thuật sẽ được bổ sung qua backend chạy nội bộ.</p>
      </section>

      <section className="recorder-card">
        <div className="card-heading">
          <div>
            <p className="eyebrow">BẢN GHI MỚI</p>
            <h2>{recording ? (paused ? 'Đang tạm dừng' : 'Đang ghi âm') : 'Sẵn sàng ghi âm'}</h2>
          </div>
          <div className={`status-dot ${recording ? 'active' : ''}`}><span />{recording ? (paused ? 'PAUSED' : 'RECORDING') : 'READY'}</div>
        </div>
        <div className="timer">{formatTime(elapsed)}</div>
        <p className="timer-caption">{recording ? 'Thời lượng phiên ghi âm hiện tại' : 'Nhấn nút micro để bắt đầu một phiên mới'}</p>
        <div className="record-controls">
          {!recording ? (
            <button className="primary-button" onClick={startRecording}><Mic size={19} /> Bắt đầu ghi</button>
          ) : (
            <>
              {paused
                ? <button className="primary-button" onClick={resumeRecording}><Play size={18} /> Tiếp tục</button>
                : <button className="secondary-button" onClick={pauseRecording}><Pause size={18} /> Tạm dừng</button>}
              <button className="stop-button" onClick={stopRecording}><Square size={16} fill="currentColor" /> Dừng ghi</button>
            </>
          )}
        </div>
        {error && <div className="error-message">{error}</div>}
        <div className="feature-strip">
          <div><Mic size={17} /><span>Ghi âm trên trình duyệt</span></div>
          <div><Languages size={17} /><span>Whisper + dịch thuật (sắp có)</span></div>
          <div><ShieldCheck size={17} /><span>Local-first</span></div>
        </div>
      </section>

      <section className="history-section">
        <div className="section-heading">
          <div><p className="eyebrow">YOUR LIBRARY</p><h2>Lịch sử ghi âm <span className="count">{items.length}</span></h2></div>
          <p className="section-note">Hiện lưu trong phiên trình duyệt</p>
        </div>
        {items.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon"><Mic size={24} /></div>
            <h3>Chưa có bản ghi nào</h3>
            <p>Bản ghi sẽ xuất hiện tại đây sau khi bạn nhấn Dừng ghi.</p>
          </div>
        ) : (
          <div className="recording-list">
            {items.map((item) => (
              <article className="recording-item" key={item.id}>
                <div className="audio-icon"><Mic size={18} /></div>
                <div className="recording-info">
                  <strong>{item.name}</strong>
                  <span>{item.createdAt.toLocaleString('vi-VN')} · {formatTime(item.duration)} · {(item.blob.size / 1024).toFixed(0)} KB</span>
                  <audio controls src={item.url} />
                </div>
                <div className="item-actions">
                  <button title="Gửi tới backend" aria-label="Gửi tới backend" disabled={busy} onClick={() => sendToBackend(item)}><Languages size={17} /></button>
                  <button title="Tải xuống" aria-label="Tải xuống" onClick={() => downloadRecording(item)}><Download size={17} /></button>
                  <button title="Xóa bản ghi" aria-label="Xóa bản ghi" onClick={() => deleteRecording(item.id)}><Trash2 size={17} /></button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
      <footer>VoiceNote AI · MVP 0.1 · Audio stays in this browser until you upload it.</footer>
    </main>
  )
}
