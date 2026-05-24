import sys
import json
import os

def transcribe(file_path, model_size="small"):
    # Output loading messages to stderr so stdout only contains the final JSON
    print(f"Loading local Whisper model '{model_size}'...", file=sys.stderr)
    
    # We delay faster_whisper import inside the function to ensure smooth startup logging
    from faster_whisper import WhisperModel
    
    # Try using GPU (cuda) with float16 computation, fallback to CPU with int8 quantization
    try:
        print("Attempting to use GPU (CUDA)...", file=sys.stderr)
        model = WhisperModel(model_size, device="cuda", compute_type="float16")
        print("GPU loaded successfully!", file=sys.stderr)
    except Exception as e:
        print(f"GPU loading failed ({e}). Falling back to CPU with int8 quantization...", file=sys.stderr)
        model = WhisperModel(model_size, device="cpu", compute_type="int8")
        print("CPU loaded successfully!", file=sys.stderr)
    
    print("Starting transcription process...", file=sys.stderr)
    # Transcribe audio file. beam_size=5 is standard for good accuracy.
    segments, info = model.transcribe(file_path, beam_size=5)
    
    print(f"Detected language: {info.language} with probability {info.language_probability:.2f}", file=sys.stderr)
    
    text_segments = []
    for segment in segments:
        # Print progress to stderr
        print(f"[{segment.start:.2f}s -> {segment.end:.2f}s]: {segment.text}", file=sys.stderr)
        text_segments.append(segment.text)
        
    return " ".join(text_segments), info.language

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "No file path provided"}))
        sys.exit(1)
        
    file_path = sys.argv[1]
    
    model_size = "small"
    if len(sys.argv) >= 3:
        model_size = sys.argv[2]
        
    if not os.path.exists(file_path):
        print(json.dumps({"success": False, "error": f"File not found: {file_path}"}))
        sys.exit(1)
        
    try:
        text, lang = transcribe(file_path, model_size)
        print(json.dumps({
            "success": True, 
            "transcription": text,
            "language": lang
        }))
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))
