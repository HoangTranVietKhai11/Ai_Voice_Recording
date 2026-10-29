import json
import os
import sys
import time
import urllib.parse
import urllib.request
from typing import Dict, List

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

SAMPLE_SENTENCES = [
    {"src": "en", "tgt": "vi", "text": "Could you please explain how speech recognition models work?"},
    {"src": "en", "tgt": "vi", "text": "The meeting has been rescheduled to tomorrow morning at nine o'clock."},
    {"src": "en", "tgt": "vi", "text": "We need to optimize the memory usage on our server."},
    {"src": "en", "tgt": "vi", "text": "Speech-to-text technology has significantly improved in recent years."},
    {"src": "en", "tgt": "vi", "text": "Thank you for your valuable feedback on the prototype."},
    {"src": "vi", "tgt": "en", "text": "Xin chào, hôm nay chúng ta sẽ bắt đầu buổi học về trí tuệ nhân tạo."},
    {"src": "vi", "tgt": "en", "text": "Dự án này cần hoàn thành trước thứ sáu tuần sau."},
    {"src": "vi", "tgt": "en", "text": "Tôi đã ghi âm cuộc họp nhưng chất lượng âm thanh hơi kém."},
    {"src": "vi", "tgt": "en", "text": "Bạn có thể tóm tắt các ý chính của bài giảng này không?"},
    {"src": "vi", "tgt": "en", "text": "Hệ thống hoạt động hoàn toàn offline để bảo vệ quyền riêng tư của dữ liệu."},
]


def translate_google_free(text: str, src_lang: str, tgt_lang: str) -> str:
    """Phương án 1: Google Translate Web API (nhanh, nhẹ, cần internet)."""
    url = (
        "https://translate.googleapis.com/translate_a/single?client=gtx&sl="
        + src_lang
        + "&tl="
        + tgt_lang
        + "&dt=t&q="
        + urllib.parse.quote(text)
    )
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=5) as response:
        data = json.loads(response.read().decode("utf-8"))
        return "".join([part[0] for part in data[0] if part[0]])


def translate_ollama(text: str, src_lang: str, tgt_lang: str, model: str = "llama3.2:latest") -> str:
    """Phương án 2: Local LLM qua Ollama (100% local, chất lượng ngữ cảnh cao)."""
    lang_name_map = {"vi": "tiếng Việt", "en": "tiếng Anh"}
    tgt_name = lang_name_map.get(tgt_lang, tgt_lang)
    prompt = f"Hãy dịch câu sau sang {tgt_name}. Chỉ trả về duy nhất kết quả bản dịch, không giải thích hay thêm bớt gì khác:\n{text}"

    url = "http://localhost:11434/api/generate"
    req_body = json.dumps({"model": model, "prompt": prompt, "stream": False}).encode("utf-8")
    req = urllib.request.Request(url, data=req_body, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as response:
        data = json.loads(response.read().decode("utf-8"))
        return data.get("response", "").strip()


def run_benchmark():
    print("=== BẮT ĐẦU ĐO THỬ PHƯƠNG ÁN DỊCH (10 CÂU MẪU) ===")

    # 1. Đo Google Translate
    print("\n[1] Phương án 1: Google Translate (Web/Online)")
    t0 = time.perf_counter()
    g_results = []
    g_success = True
    try:
        for item in SAMPLE_SENTENCES:
            out = translate_google_free(item["text"], item["src"], item["tgt"])
            g_results.append(out)
    except Exception as e:
        g_success = False
        print(f"Lỗi: {e}")
    t_google = time.perf_counter() - t0

    if g_success:
        print(f"Tổng thời gian: {t_google:.2f}s (~{t_google/10:.2f}s/câu)")
        print(f"Mẫu câu 1: '{SAMPLE_SENTENCES[0]['text']}' -> '{g_results[0]}'")
        print(f"Mẫu câu 6: '{SAMPLE_SENTENCES[5]['text']}' -> '{g_results[5]}'")

    # 2. Đo Ollama (llama3.2 hoặc qwen3)
    ollama_model = "llama3.2:latest"
    print(f"\n[2] Phương án 2: Local LLM Ollama ({ollama_model})")
    t0 = time.perf_counter()
    o_results = []
    o_success = True
    try:
        for item in SAMPLE_SENTENCES:
            out = translate_ollama(item["text"], item["src"], item["tgt"], model=ollama_model)
            o_results.append(out)
    except Exception as e:
        o_success = False
        print(f"Lỗi khi gọi Ollama: {e}")
    t_ollama = time.perf_counter() - t0

    if o_success:
        print(f"Tổng thời gian: {t_ollama:.2f}s (~{t_ollama/10:.2f}s/câu)")
        print(f"Mẫu câu 1: '{SAMPLE_SENTENCES[0]['text']}' -> '{o_results[0]}'")
        print(f"Mẫu câu 6: '{SAMPLE_SENTENCES[5]['text']}' -> '{o_results[5]}'")

    print("\n--- BẢNG KẾT QUẢ CHO PLAN.md ---")
    if g_success:
        print(f"| Google Translate Free | Cloud API | Tốt, tự nhiên | ~{t_google/10:.2f}s/câu | Tùy chọn (khi có mạng) |")
    if o_success:
        print(f"| Ollama ({ollama_model}) | Local (máy chủ) | Rất tốt, hiểu ngữ cảnh | ~{t_ollama/10:.2f}s/câu | Tùy chọn (local) |")


if __name__ == "__main__":
    run_benchmark()
