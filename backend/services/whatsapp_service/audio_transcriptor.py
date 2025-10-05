import os
import sys
import shutil
import whisper

# 👇 adjust this to your folder
BASE_DIR = r"C:\Users\Mateus\Documents\Chats\Marcelo"
MODEL_NAME = "large"  # tiny | base | small | medium | large
LANG = "pt"  # or None for autodetect


def list_opus_files(base_dir):
    """Recursively find all .opus files."""
    opus_files = []
    for root, _, files in os.walk(base_dir):
        for file in files:
            if file.lower().endswith(".opus"):
                opus_files.append(os.path.join(root, file))
    return opus_files


def transcribe_file(model, file_path):
    """Transcribe a single audio file with Whisper."""
    txt_path = os.path.splitext(file_path)[0] + ".txt"

    # Skip if already done
    if os.path.exists(txt_path):
        print(f"⏭️  Skipping (already exists): {txt_path}")
        return

    print(f"🎙️  Transcribing: {file_path}")
    try:
        result = model.transcribe(file_path, language=LANG)
        text = (result.get("text") or "").strip()
        with open(txt_path, "w", encoding="utf-8") as f:
            f.write(text)
        print(f"✅ Saved transcript: {txt_path}\n")
    except FileNotFoundError as e:
        # This is what happens when ffmpeg is missing from PATH on Windows
        print(f"❌ Error transcribing {file_path}: {e}")
        print("   Hint: Install FFmpeg and ensure 'ffmpeg' is on your PATH. "
              "Verify with:  ffmpeg -version")
    except Exception as e:
        print(f"❌ Error transcribing {file_path}: {e}")


def main():
    # --- Preflight: FFmpeg ---
    if not shutil.which("ffmpeg"):
        print("❌ FFmpeg not found on PATH. Whisper needs FFmpeg to read .opus.")
        print("   Install it (e.g., 'choco install ffmpeg' or via winget), then reopen your terminal.")
        print("   Verify with: ffmpeg -version")
        sys.exit(1)

    # Load Whisper model once (after the FFmpeg check)
    print(f"🧠 Loading Whisper model ({MODEL_NAME})...")
    model = whisper.load_model(MODEL_NAME)

    files = list_opus_files(BASE_DIR)
    if not files:
        print("❌ No .opus files found.")
        return

    print(f"🔍 Found {len(files)} .opus files.\n")
    for path in files:
        transcribe_file(model, path)

    print("🏁 Done!")


if __name__ == "__main__":
    main()
