from __future__ import annotations

import logging
import os
from typing import Optional

from faster_whisper import WhisperModel


logger = logging.getLogger("whisper_transcriber")

_MODEL: Optional[WhisperModel] = None
_MODEL_LOADING = False


def get_model() -> WhisperModel:
    """
    Get or lazily load the Whisper model (singleton pattern).
    
    Uses the \"base\" checkpoint for fast inference on CPU.
    Switch to \"small\" or \"medium\" for better accuracy if needed.
    Automatically uses CPU-optimized int8 computation.
    """
    global _MODEL, _MODEL_LOADING

    if _MODEL is not None:
        return _MODEL

    if _MODEL_LOADING:
        logger.warning("Whisper model already loading, waiting...")
        # Simple wait for model to finish loading
        import time
        attempts = 0
        while _MODEL is None and attempts < 30:
            time.sleep(0.1)
            attempts += 1

    _MODEL_LOADING = True

    model_name = os.getenv("WHISPER_MODEL", "base")
    logger.info("Loading Whisper model: %s (CPU-optimized int8)", model_name)

    try:
        _MODEL = WhisperModel(
            model_name,
            device="cpu",
            compute_type="int8"
        )
        logger.info("✅ Whisper model loaded successfully")
    except Exception as e:
        logger.exception("Failed to load Whisper model: %s", e)
        raise

    _MODEL_LOADING = False
    return _MODEL


def transcribe_file(path: str, language: Optional[str] = None) -> str:
    """
    Transcribe a local audio file into text with error handling.
    
    Args:
        path: Path to audio file (supports wav, mp3, ogg, webm, etc.)
        language: Optional ISO-639-1 language code (e.g., \"en\", \"es\")
    
    Returns:
        Transcribed text, or empty string if transcription fails
    """
    try:
        model = get_model()
        
        logger.info("Transcribing audio file: %s", path)
        
        segments, info = model.transcribe(
            path,
            language=language,
            beam_size=5,
            best_of=1,
            patience=1.0,
            length_penalty=1.0,
            vad_filter=True,
            vad_parameters={"min_speech_duration_ms": 250}
        )
        
        parts: list[str] = []
        for segment in segments:
            text = (segment.text or "").strip()
            if text:
                parts.append(text)
                logger.debug("Segment [%.2f-%.2f]: %s", segment.start, segment.end, text)
        
        result = " ".join(parts)
        logger.info("✅ Transcription complete: %s", result)
        return result

    except Exception as e:
        logger.exception("Transcription failed for %s: %s", path, e)
        return ""

