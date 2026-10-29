export type RecordingItem = {
  audio_id: string
  filename: string
  content_type: string
  size_bytes: number
  suffix: string
  status: 'uploaded' | 'transcribing' | 'done' | 'error'
  transcript: string | null
  language: string | null
  duration_secs: number | null
  error_message: string | null
  translation: string | null
  translation_lang: string | null
  created_at: string
  updated_at: string
}
