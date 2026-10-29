import { useCallback, useEffect, useRef, useState } from 'react'
import { Mic, ShieldCheck, AlertCircle, LogOut } from 'lucide-react'
import type { RecordingItem } from './types'
import { Recorder } from './components/Recorder'
import { RecordingList } from './components/RecordingList'
import { LoginScreen } from './components/LoginScreen'
import { apiFetch, getStoredToken, clearStoredToken } from './api'
import './App.css'

export default function App() {
  const [items, setItems] = useState<RecordingItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [busyMessage, setBusyMessage] = useState('')
  const [isBusy, setIsBusy] = useState(false)

  // null = chưa biết, true = đã đăng nhập, false = cần login
  const [authenticated, setAuthenticated] = useState<null | boolean>(null)

  const pollersRef = useRef<Map<string, number>>(new Map())

  // Kiểm tra xem server có bật auth không (thử gọi /api/recordings)
  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch('/api/recordings', {
          headers: getStoredToken() ? { Authorization: `Bearer ${getStoredToken()}` } : {},
        })
        if (res.status === 401) {
          setAuthenticated(false)
        } else {
          setAuthenticated(true)
        }
      } catch {
        // Backend không chạy – vẫn cho vào nhưng sẽ báo lỗi khi load
        setAuthenticated(true)
      }
    }
    checkAuth()
  }, [])

  const handleLogin = () => setAuthenticated(true)
  const handleLogout = () => {
    clearStoredToken()
    setAuthenticated(false)
  }

  // Tải danh sách bản ghi từ backend
  const fetchRecordings = useCallback(async () => {
    try {
      setLoading(true)
      const res = await apiFetch('/api/recordings')
      if (!res.ok) {
        throw new Error(`Lỗi tải danh sách: HTTP ${res.status}`)
      }
      const data: RecordingItem[] = await res.json()
      setItems(data)
      setError('')

      data.forEach((rec) => {
        if (rec.status === 'transcribing') {
          pollTranscribeStatus(rec.audio_id)
        }
      })
    } catch (err: unknown) {
      if (err instanceof Error && err.message === 'TOKEN_INVALID') {
        setAuthenticated(false)
        return
      }
      const msg = err instanceof Error ? err.message : String(err)
      setError(`Không thể kết nối máy chủ API (${msg}). Hãy kiểm tra backend đang chạy.`)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (authenticated) {
      fetchRecordings()
    }
    return () => {
      pollersRef.current.forEach((timerId) => window.clearInterval(timerId))
      pollersRef.current.clear()
    }
  }, [authenticated, fetchRecordings])

  const pollTranscribeStatus = useCallback((audio_id: string) => {
    if (pollersRef.current.has(audio_id)) return

    const timer = window.setInterval(async () => {
      try {
        const res = await apiFetch(`/api/recordings/${audio_id}`)
        if (!res.ok) return
        const updated: RecordingItem = await res.json()

        setItems((current) =>
          current.map((item) => (item.audio_id === audio_id ? updated : item)),
        )

        if (updated.status !== 'transcribing') {
          window.clearInterval(timer)
          pollersRef.current.delete(audio_id)
        }
      } catch (e) {
        console.error('Lỗi khi poll transcribe status', e)
      }
    }, 1500)

    pollersRef.current.set(audio_id, timer)
  }, [])

  const handleRecordingComplete = async (
    blob: Blob,
    durationSecs: number,
    mimeType: string,
  ) => {
    setIsBusy(true)
    setError('')
    setBusyMessage('Đang tải tệp âm thanh lên máy chủ...')

    try {
      const ext = mimeType.includes('mp4') ? 'm4a' : mimeType.includes('wav') ? 'wav' : 'webm'
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
      const filename = `recording_${timestamp}.${ext}`

      const formData = new FormData()
      formData.append('file', blob, filename)

      const uploadRes = await apiFetch('/api/audio', { method: 'POST', body: formData })

      if (!uploadRes.ok) {
        const errDetail = await uploadRes.json().catch(() => ({}))
        throw new Error(errDetail.detail || `Upload thất bại: HTTP ${uploadRes.status}`)
      }

      const uploadResult = await uploadRes.json()
      const audio_id = uploadResult.audio_id

      setBusyMessage('Đang khởi động Whisper AI chuyển chữ...')

      const transcribeRes = await apiFetch(`/api/transcribe/${audio_id}`, { method: 'POST' })
      if (!transcribeRes.ok) {
        console.warn('Yêu cầu transcribe trả về lỗi:', transcribeRes.status)
      }

      await fetchRecordings()
      pollTranscribeStatus(audio_id)
    } catch (err: unknown) {
      if (err instanceof Error && err.message === 'TOKEN_INVALID') {
        setAuthenticated(false)
        return
      }
      const msg = err instanceof Error ? err.message : String(err)
      setError(`Lỗi: ${msg}`)
    } finally {
      setIsBusy(false)
      setBusyMessage('')
    }
  }

  const handleRetryTranscribe = async (audio_id: string) => {
    try {
      setError('')
      const res = await apiFetch(`/api/transcribe/${audio_id}`, { method: 'POST' })
      if (!res.ok) {
        throw new Error(`Không thể bắt đầu phiên âm: HTTP ${res.status}`)
      }
      setItems((current) =>
        current.map((item) =>
          item.audio_id === audio_id ? { ...item, status: 'transcribing' } : item,
        ),
      )
      pollTranscribeStatus(audio_id)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(`Lỗi: ${msg}`)
    }
  }

  const handleSaveTranscript = async (audio_id: string, text: string) => {
    const res = await apiFetch(`/api/recordings/${audio_id}`, {
      method: 'PATCH',
      body: JSON.stringify({ transcript: text }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || `Lỗi lưu transcript: HTTP ${res.status}`)
    }
    const updated: RecordingItem = await res.json()
    setItems((current) =>
      current.map((item) => (item.audio_id === audio_id ? updated : item)),
    )
  }

  const handleTranslate = async (audio_id: string, target_lang: string, text?: string) => {
    const res = await apiFetch('/api/translate', {
      method: 'POST',
      body: JSON.stringify({ audio_id, target_lang, text: text !== undefined ? text : undefined }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || `Lỗi dịch thuật: HTTP ${res.status}`)
    }
    const result = await res.json()
    setItems((current) =>
      current.map((item) =>
        item.audio_id === audio_id
          ? { ...item, transcript: result.transcript, translation: result.translation, translation_lang: result.translation_lang }
          : item,
      ),
    )
  }

  const handleDelete = async (audio_id: string) => {
    try {
      setError('')
      const res = await apiFetch(`/api/recordings/${audio_id}`, { method: 'DELETE' })
      if (!res.ok) {
        throw new Error(`Xóa thất bại: HTTP ${res.status}`)
      }
      setItems((current) => current.filter((item) => item.audio_id !== audio_id))
      if (pollersRef.current.has(audio_id)) {
        window.clearInterval(pollersRef.current.get(audio_id))
        pollersRef.current.delete(audio_id)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(`Không thể xóa bản ghi: ${msg}`)
    }
  }

  // Chờ kiểm tra auth
  if (authenticated === null) return null

  // Màn hình login
  if (authenticated === false) {
    return <LoginScreen onLogin={handleLogin} />
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-mark">
          <Mic size={22} />
        </div>
        <div>
          <div className="brand-title">
            VoiceNote <span>AI</span>
          </div>
          <div className="brand-subtitle">Ghi âm · Phiên âm Whisper · Dịch thuật nội bộ</div>
        </div>
        <div className="topbar-right">
          <div className="privacy-pill">
            <ShieldCheck size={15} /> Ưu tiên riêng tư &amp; Lưu trữ cục bộ
          </div>
          {getStoredToken() && (
            <button className="logout-btn" onClick={handleLogout} title="Đăng xuất">
              <LogOut size={15} />
            </button>
          )}
        </div>
      </header>

      <section className="hero">
        <p className="eyebrow">LOCAL-FIRST VOICE WORKSPACE</p>
        <h1>
          Ghi âm thông minh, <span>chuyển văn bản tức thì.</span>
        </h1>
        <p className="hero-copy">
          Âm thanh được thu trực tiếp trên trình duyệt, lưu trữ và phiên âm tự động bằng mô hình
          Whisper AI chạy trực tiếp trên máy chủ nội bộ.
        </p>
      </section>

      <Recorder
        isBusy={isBusy}
        busyMessage={busyMessage}
        onRecordingComplete={handleRecordingComplete}
        onError={setError}
      />

      {error && (
        <div className="error-banner">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      <RecordingList
        items={items}
        loading={loading}
        onDelete={handleDelete}
        onRetryTranscribe={handleRetryTranscribe}
        onSaveTranscript={handleSaveTranscript}
        onTranslate={handleTranslate}
        onRefresh={fetchRecordings}
      />

      <footer>
        VoiceNote AI · Local-first audio transcription · Toàn bộ dữ liệu được bảo mật nội bộ
      </footer>
    </main>
  )
}
