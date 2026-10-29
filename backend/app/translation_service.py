"""Translation service interface and implementations."""

import json
import logging
import os
import urllib.parse
import urllib.request
from abc import ABC, abstractmethod
from typing import Optional

logger = logging.getLogger(__name__)


class BaseTranslationService(ABC):
    """Giao diện chuẩn cho dịch thuật văn bản."""

    @abstractmethod
    def translate(self, text: str, source_lang: str = "auto", target_lang: str = "vi") -> str:
        """Dịch đoạn văn bản text từ source_lang sang target_lang."""
        pass


class GoogleFreeTranslationService(BaseTranslationService):
    """Phương án dịch nhanh qua Google Translate Web API (không cần API key)."""

    def translate(self, text: str, source_lang: str = "auto", target_lang: str = "vi") -> str:
        if not text or not text.strip():
            return ""

        url = (
            "https://translate.googleapis.com/translate_a/single?client=gtx&sl="
            + urllib.parse.quote(source_lang or "auto")
            + "&tl="
            + urllib.parse.quote(target_lang or "vi")
            + "&dt=t&q="
            + urllib.parse.quote(text)
        )
        req = urllib.request.Request(
            url,
            headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            },
        )
        try:
            with urllib.request.urlopen(req, timeout=10) as response:
                data = json.loads(response.read().decode("utf-8"))
                result = "".join([part[0] for part in data[0] if part and part[0]])
                return result.strip()
        except Exception as exc:
            logger.error("Lỗi Google Translate: %s", exc)
            raise RuntimeError(f"Lỗi dịch Google Translate: {exc}") from exc


class OllamaTranslationService(BaseTranslationService):
    """Phương án dịch 100% nội bộ (local) qua Ollama LLM."""

    def __init__(
        self,
        base_url: Optional[str] = None,
        model: Optional[str] = None,
    ):
        self.base_url = (base_url or os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")).rstrip("/")
        self.model = model or os.getenv("OLLAMA_MODEL", "llama3.2:latest")

    def translate(self, text: str, source_lang: str = "auto", target_lang: str = "vi") -> str:
        if not text or not text.strip():
            return ""

        lang_name_map = {
            "vi": "tiếng Việt",
            "en": "tiếng Anh",
            "fr": "tiếng Pháp",
            "zh": "tiếng Trung",
            "ja": "tiếng Nhật",
            "ko": "tiếng Hàn",
        }
        tgt_name = lang_name_map.get(target_lang.lower(), target_lang)
        prompt = (
            f"Hãy dịch chính xác đoạn văn bản sau sang {tgt_name}. "
            f"Chỉ trả về duy nhất kết quả bản dịch, không thêm giải thích hay lời mở đầu:\n\n{text}"
        )

        url = f"{self.base_url}/api/generate"
        req_body = json.dumps(
            {
                "model": self.model,
                "prompt": prompt,
                "stream": False,
            }
        ).encode("utf-8")

        req = urllib.request.Request(
            url,
            data=req_body,
            headers={"Content-Type": "application/json"},
        )
        try:
            with urllib.request.urlopen(req, timeout=60) as response:
                data = json.loads(response.read().decode("utf-8"))
                return data.get("response", "").strip()
        except Exception as exc:
            logger.error("Lỗi Ollama translation: %s", exc)
            raise RuntimeError(f"Lỗi dịch Ollama ({self.model}): {exc}") from exc


class MockTranslationService(BaseTranslationService):
    """Mock service cho testing môi trường cô lập không có internet hoặc Ollama."""

    def translate(self, text: str, source_lang: str = "auto", target_lang: str = "vi") -> str:
        if not text or not text.strip():
            return ""
        return f"[Dịch sang {target_lang}]: {text}"


def get_translation_service() -> BaseTranslationService:
    """Factory lấy dịch vụ dịch thuật theo biến môi trường TRANSLATION_PROVIDER."""
    provider = os.getenv("TRANSLATION_PROVIDER", "google").lower().strip()
    if provider == "mock":
        return MockTranslationService()
    if provider == "ollama":
        return OllamaTranslationService()
    return GoogleFreeTranslationService()
