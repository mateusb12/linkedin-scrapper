import os
import sys
import shutil
import time
import datetime
import psutil
import subprocess  # <-- Required for running FFmpeg

from dotenv import load_dotenv

# --- Configuration ---
load_dotenv()

# 👇 Choose your transcription mode: 'LOCAL' or 'CLOUD'
TRANSCRIPTION_MODE = 'CLOUD'  # Options: 'LOCAL', 'CLOUD'

# 👇 Adjust this to your folder of audio files
BASE_DIR = r"C:\Users\Mateus\Documents\Chats\Marcelo"

# 👇 Set the language of the audio. Set to None for auto-detection.
LANG = "pt"

# --- Model Settings ---
LOCAL_MODEL_NAME = "large"
CLOUD_MODEL_NAME = "whisper-1"

# --- Optional Imports (handled gracefully) ---
try:
    import whisper
except ImportError:
    if TRANSCRIPTION_MODE == 'LOCAL':
        print("❌ 'whisper' library not found. Please run: pip install openai-whisper")
        sys.exit(1)

try:
    from openai import OpenAI
except ImportError:
    if TRANSCRIPTION_MODE == 'CLOUD':
        print("❌ 'openai' library not found. Please run: pip install openai")
        sys.exit(1)

try:
    import GPUtil

    GPU_AVAILABLE = True
except ImportError:
    GPU_AVAILABLE = False


def format_time(seconds):
    """Formats seconds into a human-readable HH:MM:SS string."""
    return str(datetime.timedelta(seconds=int(seconds)))


def print_system_stats():
    """Prints current CPU, RAM, and GPU stats."""
    cpu_usage = psutil.cpu_percent()
    ram_usage = psutil.virtual_memory().percent
    stats_str = f"📊 Stats: CPU {cpu_usage}% | RAM {ram_usage}%"

    if GPU_AVAILABLE and TRANSCRIPTION_MODE == 'LOCAL':
        try:
            gpus = GPUtil.getGPUs()
            if gpus:
                gpu = gpus[0]
                stats_str += f" | GPU {gpu.load * 100:.1f}% ({gpu.temperature}°C)"
            else:
                stats_str += " | GPU: Not found"
        except Exception:
            stats_str += " | GPU: Error getting stats"

    print(stats_str)


def list_opus_files(base_dir):
    """Recursively find all .opus files."""
    opus_files = []
    for root, _, files in os.walk(base_dir):
        for file in files:
            if file.lower().endswith(".opus"):
                opus_files.append(os.path.join(root, file))
    return opus_files


def transcribe_file_local(model, file_path):
    """Transcribe a single audio file using a local Whisper model."""
    txt_path = os.path.splitext(file_path)[0] + ".txt"

    if os.path.exists(txt_path):
        print(f"⏭️  Skipping (already exists): {os.path.basename(file_path)}")
        return None

    print(f"🎙️  Transcribing locally: {os.path.basename(file_path)}")
    start_time = time.time()
    try:
        result = model.transcribe(file_path, language=LANG)
        text = (result.get("text") or "").strip()

        with open(txt_path, "w", encoding="utf-8") as f:
            f.write(text)

        end_time = time.time()
        duration = end_time - start_time
        print(f"✅ Saved transcript to: {os.path.basename(txt_path)}")
        return duration

    except Exception as e:
        print(f"❌ An unexpected error occurred while transcribing {os.path.basename(file_path)}: {e}")
        return None


def transcribe_file_cloud(client, file_path):
    """
    Converts .opus to .mp3 and transcribes using the OpenAI Whisper API.
    """
    txt_path = os.path.splitext(file_path)[0] + ".txt"

    if os.path.exists(txt_path):
        print(f"⏭️  Skipping (already exists): {os.path.basename(file_path)}")
        return None

    converted_file_path = None
    try:
        # Define a temporary path for the converted MP3 file
        converted_file_path = file_path + ".mp3"
        print(f"⚙️  Converting to MP3 for API compatibility...")

        # Use FFmpeg to convert the file, hiding its console output
        command = [
            "ffmpeg", "-i", file_path, "-acodec", "libmp3lame",
            converted_file_path, "-hide_banner", "-loglevel", "error"
        ]
        subprocess.run(command, check=True, capture_output=True)

        print(f"☁️  Uploading converted file to OpenAI API...")
        start_time = time.time()

        with open(converted_file_path, "rb") as audio_file:
            transcript = client.audio.transcriptions.create(
                model=CLOUD_MODEL_NAME,
                file=audio_file,
                language=LANG
            )
        text = transcript.text.strip()

        with open(txt_path, "w", encoding="utf-8") as f:
            f.write(text)

        end_time = time.time()
        duration = end_time - start_time
        print(f"✅ Saved transcript to: {os.path.basename(txt_path)}")
        return duration

    except subprocess.CalledProcessError as e:
        print(f"❌ FFmpeg failed to convert {os.path.basename(file_path)}. Error: {e.stderr.decode()}")
        return None
    except Exception as e:
        print(f"❌ An API error occurred for {os.path.basename(file_path)}: {e}")
        return None
    finally:
        # Clean up by deleting the temporary .mp3 file
        if converted_file_path and os.path.exists(converted_file_path):
            os.remove(converted_file_path)


def main():
    """Main function to orchestrate the transcription process."""
    # FFmpeg is now required for both LOCAL and CLOUD modes
    if not shutil.which("ffmpeg"):
        print("❌ FFmpeg not found. It's required for audio processing.")
        print("   Please install FFmpeg and add it to your system's PATH.")
        sys.exit(1)

    transcriber = None
    transcribe_function = None

    if TRANSCRIPTION_MODE == 'LOCAL':
        print("--- ⚙️  Mode: LOCAL ---")
        print(f"🧠 Loading local Whisper model ('{LOCAL_MODEL_NAME}')...")
        try:
            model = whisper.load_model(LOCAL_MODEL_NAME)
            transcriber = model
            transcribe_function = transcribe_file_local
            print("✅ Model loaded successfully.")
        except Exception as e:
            print(f"❌ Failed to load model: {e}")
            sys.exit(1)

    elif TRANSCRIPTION_MODE == 'CLOUD':
        print("--- ⚙️  Mode: CLOUD ---")
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            print("❌ OPENAI_API_KEY environment variable not set.")
            print("   Please set it to use the OpenAI Whisper API.")
            sys.exit(1)

        print(f"☁️  Initializing OpenAI client for model '{CLOUD_MODEL_NAME}'...")
        try:
            client = OpenAI(api_key=api_key)
            transcriber = client
            transcribe_function = transcribe_file_cloud
            print("✅ OpenAI client initialized.")
        except Exception as e:
            print(f"❌ Failed to initialize OpenAI client: {e}")
            sys.exit(1)
    else:
        print(f"❌ Invalid TRANSCRIPTION_MODE: '{TRANSCRIPTION_MODE}'. Choose 'LOCAL' or 'CLOUD'.")
        sys.exit(1)

    files_to_process = list_opus_files(BASE_DIR)
    total_files = len(files_to_process)

    if not files_to_process:
        print("🤷 No .opus files found.")
        return

    print(f"\n🔍 Found {total_files} .opus files to process.")

    processed_count = 0
    total_transcription_time = 0

    for i, path in enumerate(files_to_process):
        print("\n" + "=" * 60)
        print(f"📂 Processing file {i + 1} of {total_files}: {os.path.basename(path)}")
        print_system_stats()

        duration = transcribe_function(transcriber, path)

        if duration is not None:
            processed_count += 1
            total_transcription_time += duration
            avg_time_per_file = total_transcription_time / processed_count
            files_remaining = total_files - (i + 1)
            eta_seconds = files_remaining * avg_time_per_file

            print(f"🕒 Time for this file: {format_time(duration)}")
            print(f"⏳ Average time/file: {format_time(avg_time_per_file)}")
            print(f"ETA: {format_time(eta_seconds)}")

    print("\n" + "=" * 60)
    print("🏁 All files processed!")
    print(f"Total files transcribed in this session: {processed_count}")
    print(f"Total transcription time: {format_time(total_transcription_time)}")
    if processed_count > 0:
        print(f"Final average time per file: {format_time(total_transcription_time / processed_count)}")


if __name__ == "__main__":
    main()