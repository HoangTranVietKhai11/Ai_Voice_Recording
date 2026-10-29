import argparse
import os
import sys
import time
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

def get_peak_ram_mb() -> float:
    """Trả về lượng RAM đỉnh (MB) của tiến trình hiện tại trên cả Windows và Linux."""
    if os.name == "nt":
        import ctypes
        from ctypes import wintypes

        class PROCESS_MEMORY_COUNTERS_EX(ctypes.Structure):
            _fields_ = [
                ("cb", wintypes.DWORD),
                ("PageFaultCount", wintypes.DWORD),
                ("PeakWorkingSetSize", ctypes.c_size_t),
                ("WorkingSetSize", ctypes.c_size_t),
                ("QuotaPeakPagedPoolUsage", ctypes.c_size_t),
                ("QuotaPagedPoolUsage", ctypes.c_size_t),
                ("QuotaPeakNonPagedPoolUsage", ctypes.c_size_t),
                ("QuotaNonPagedPoolUsage", ctypes.c_size_t),
                ("PagefileUsage", ctypes.c_size_t),
                ("PeakPagefileUsage", ctypes.c_size_t),
                ("PrivateUsage", ctypes.c_size_t),
            ]

        fn = ctypes.windll.kernel32.K32GetProcessMemoryInfo
        fn.argtypes = [wintypes.HANDLE, ctypes.POINTER(PROCESS_MEMORY_COUNTERS_EX), wintypes.DWORD]
        fn.restype = wintypes.BOOL

        counters = PROCESS_MEMORY_COUNTERS_EX()
        counters.cb = ctypes.sizeof(PROCESS_MEMORY_COUNTERS_EX)
        if fn(ctypes.windll.kernel32.GetCurrentProcess(), ctypes.byref(counters), counters.cb):
            return counters.PeakWorkingSetSize / (1024 * 1024)
        return 0.0
    else:
        import resource
        # Trên Linux, ru_maxrss trả về kilobytes
        usage = resource.getrusage(resource.RUSAGE_SELF)
        return usage.ru_maxrss / 1024.0


def benchmark(audio_path: str, model_size: str, device: str = "cpu", compute_type: str = "int8"):
    print(f"=== BẮT ĐẦU ĐO THỬ WHISPER ===")
    print(f"Audio file    : {audio_path}")
    print(f"Model size    : {model_size}")
    print(f"Device        : {device}")
    print(f"Compute type  : {compute_type}")
    print(f"RAM ban đầu   : {get_peak_ram_mb():.2f} MB")

    if not os.path.exists(audio_path):
        print(f"Lỗi: Không tìm thấy file âm thanh tại '{audio_path}'", file=sys.stderr)
        sys.exit(1)

    from faster_whisper import WhisperModel

    t0 = time.perf_counter()
    model = WhisperModel(model_size, device=device, compute_type=compute_type)
    t_load = time.perf_counter() - t0
    print(f"Thời gian tải model: {t_load:.2f}s | RAM sau khi tải: {get_peak_ram_mb():.2f} MB")

    t1 = time.perf_counter()
    segments, info = model.transcribe(audio_path, beam_size=1)
    
    transcript_parts = []
    for seg in segments:
        transcript_parts.append(seg.text)
    t_transcribe = time.perf_counter() - t1

    full_text = " ".join(transcript_parts).strip()
    peak_ram = get_peak_ram_mb()

    print("\n--- KẾT QUẢ ĐO ---")
    print(f"Ngôn ngữ phát hiện : {info.language} (độ tin cậy: {info.language_probability:.2f})")
    print(f"Độ dài file audio  : {info.duration:.2f}s")
    print(f"Thời gian xử lý    : {t_transcribe:.2f}s (tỉ lệ RTF: {t_transcribe / max(info.duration, 0.001):.2f}x realtime)")
    print(f"RAM đỉnh (Peak)    : {peak_ram:.2f} MB")
    print(f"Đoạn trích (50 ký tự): {full_text[:50]}...")
    print("------------------\n")
    print(f"Dòng điền vào PLAN.md:")
    os_name = "Windows" if os.name == "nt" else "Proxmox"
    print(f"| {os_name} | {model_size} | {info.duration:.1f}s | {t_transcribe:.2f}s | {peak_ram:.1f} MB | int8, load {t_load:.1f}s |")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Spike benchmark faster-whisper")
    parser.add_argument("--audio", required=True, help="Đường dẫn file audio (WAV, MP3, WebM...)")
    parser.add_argument("--model", default="tiny", choices=["tiny", "base", "small"], help="Kích thước model whisper")
    parser.add_argument("--device", default="cpu", help="Thiết bị (cpu/cuda)")
    parser.add_argument("--compute_type", default="int8", help="Kiểu tính toán (int8/float32)")
    args = parser.parse_args()

    benchmark(args.audio, args.model, args.device, args.compute_type)
