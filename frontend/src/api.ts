/**
 * api.ts – Centralized fetch wrapper
 *
 * Đọc API token từ sessionStorage (người dùng nhập ở màn hình login).
 * Token được gửi trong header Authorization: Bearer <token> cho mọi /api/* call.
 * Nếu không có token (server không yêu cầu), request vẫn hoạt động bình thường.
 */

const TOKEN_KEY = 'voicenote_token'

export function getStoredToken(): string {
  return sessionStorage.getItem(TOKEN_KEY) || ''
}

export function setStoredToken(token: string): void {
  if (token) {
    sessionStorage.setItem(TOKEN_KEY, token)
  } else {
    sessionStorage.removeItem(TOKEN_KEY)
  }
}

export function clearStoredToken(): void {
  sessionStorage.removeItem(TOKEN_KEY)
}

function buildHeaders(extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = { ...extra }
  const token = getStoredToken()
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  return headers
}

/** Wrapper quanh fetch, tự thêm Authorization header và throw Error nếu không phải 2xx */
export async function apiFetch(
  input: RequestInfo,
  init?: RequestInit,
): Promise<Response> {
  const extraHeaders: Record<string, string> = {}

  // Đừng ghi đè Content-Type nếu body là FormData (multipart)
  if (init?.body && !(init.body instanceof FormData)) {
    extraHeaders['Content-Type'] = 'application/json'
  }

  const headers = buildHeaders({ ...extraHeaders, ...(init?.headers as Record<string, string> | undefined) })

  const res = await fetch(input, { ...init, headers })

  // Token sai → xóa và yêu cầu đăng nhập lại
  if (res.status === 401) {
    clearStoredToken()
    // Re-throw với flag đặc biệt để App.tsx biết cần login
    const err = new Error('TOKEN_INVALID')
    ;(err as Error & { status: number }).status = 401
    throw err
  }

  return res
}
