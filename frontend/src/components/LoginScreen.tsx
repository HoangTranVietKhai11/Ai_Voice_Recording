import { useState } from 'react'
import { Lock, Eye, EyeOff, LogIn, ShieldCheck } from 'lucide-react'
import { setStoredToken } from '../api'

type LoginScreenProps = {
  onLogin: () => void
}

export function LoginScreen({ onLogin }: LoginScreenProps) {
  const [token, setToken] = useState('')
  const [showToken, setShowToken] = useState(false)
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const t = token.trim()
    if (!t) {
      setError('Vui lòng nhập token truy cập.')
      return
    }

    setChecking(true)
    try {
      const res = await fetch('/health', {
        headers: { Authorization: `Bearer ${t}` },
      })
      // /health không cần token nên bất kỳ 2xx nào là OK
      if (res.ok) {
        // Thử 1 API call thật để xác nhận token
        const apiRes = await fetch('/api/recordings', {
          headers: { Authorization: `Bearer ${t}` },
        })
        if (apiRes.status === 401) {
          setError('Token không đúng. Vui lòng kiểm tra lại.')
          return
        }
        setStoredToken(t)
        onLogin()
      } else {
        setError('Không kết nối được máy chủ.')
      }
    } catch {
      setError('Không kết nối được máy chủ. Hãy kiểm tra backend đang chạy.')
    } finally {
      setChecking(false)
    }
  }

  return (
    <main className="login-shell">
      <div className="login-card">
        <div className="login-icon">
          <Lock size={28} />
        </div>
        <h1 className="login-title">
          VoiceNote <span>AI</span>
        </h1>
        <p className="login-subtitle">
          Máy chủ yêu cầu xác thực. Nhập token truy cập để tiếp tục.
        </p>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="token-input-wrapper">
            <input
              id="token-input"
              type={showToken ? 'text' : 'password'}
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Bearer token..."
              autoComplete="current-password"
              autoFocus
              className="token-input"
            />
            <button
              type="button"
              className="token-eye-btn"
              onClick={() => setShowToken(!showToken)}
              aria-label={showToken ? 'Ẩn token' : 'Hiện token'}
            >
              {showToken ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          {error && <p className="login-error">{error}</p>}

          <button
            type="submit"
            className="login-submit-btn"
            disabled={checking}
          >
            <LogIn size={17} />
            <span>{checking ? 'Đang kiểm tra...' : 'Đăng nhập'}</span>
          </button>
        </form>

        <div className="login-footer">
          <ShieldCheck size={14} className="text-success-sm" />
          <span>Token lưu trong phiên trình duyệt, không gửi ra ngoài LAN</span>
        </div>
      </div>
    </main>
  )
}
