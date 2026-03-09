# Voice Assistant Implementation Guide

## Overview

The BusTracker Voice Assistant is a **fully automatic, always-listening voice interface** that uses:

- **Frontend:** Browser Web Audio API for recording + React state management
- **Backend:** Local Whisper (faster-whisper) for speech-to-text
- **Intelligence:** DistilBERT intent classifier + entity extraction
- **Voice Output:** Browser SpeechSynthesis API for text-to-speech

---

## Architecture

### Component Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND (React)                         │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  1. VoiceAssistant Component                                │
│     ├─ Init → Request microphone permission                 │
│     ├─ Speak greeting (auto-start)                          │
│     ├─ Start continuous listening loop                      │
│     └─ Display UI: microphone status, transcript, response  │
│                                                               │
│  2. Audio Recording                                          │
│     ├─ MediaRecorder API (5-second chunks)                  │
│     ├─ Audio visualization (waveform animation)             │
│     └─ Real-time transcript display                         │
│                                                               │
│  3. State Management                                         │
│     ├─ isListening: boolean                                 │
│     ├─ isSpeaking: boolean                                  │
│     ├─ isProcessing: boolean                                │
│     ├─ transcript: string                                   │
│     ├─ assistantMessage: string                             │
│     ├─ micLevel: float (0-1)                                │
│     └─ error: string | null                                 │
│                                                               │
└─────────────────────────────────────────────────────────────┘
                            ↓ (HTTP)
┌─────────────────────────────────────────────────────────────┐
│                   BACKEND (FastAPI)                         │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  1. /transcribe-audio (POST)                                │
│     ├─ Input: multipart audio file (webm/ogg/wav)           │
│     ├─ Process: Load Whisper model (singleton)              │
│     │           Transcribe audio to text                    │
│     │           Clean up temp files                         │
│     └─ Output: { text: \"transcribed text\" }                │
│                                                               │
│  2. /voice-query (POST)                                     │
│     ├─ Input: { query, city_id?, user_lat?, user_lng? }    │
│     ├─ Process: Classify intent (DistilBERT)               │
│     │           Extract entities                           │
│     │           Query database                             │
│     │           Calculate ETAs                             │
│     │           Generate natural response                  │
│     └─ Output: { intent, entities, message }               │
│                                                               │
│  3. Intent Classification                                   │
│     ├─ greeting: \"Hi\", \"Hello\", etc.                     │
│     ├─ next_bus: \"Next bus to X\"                           │
│     ├─ nearest_stop: \"Nearest stop\"                        │
│     ├─ find_route: \"Bus from X to Y\"                       │
│     ├─ bus_status: \"Where is bus 21A?\"                     │
│     └─ unknown: Fallback response                           │
│                                                               │
│  4. Whisper Model (Singleton)                               │
│     ├─ Load once at first transcription request             │
│     ├─ CPU-optimized (int8 compute type)                    │
│     ├─ Model: \"base\" (1.4GB) or \"small\" (3GB)            │
│     └─ Performance: ~1-2s per 5s audio segment              │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## Frontend Implementation

### VoiceAssistant Component

**File:** `src/app/components/voice-assistant.tsx`

#### Key Features

**1. Automatic Startup**

```typescript
// On component mount:
// 1. Request microphone permission
// 2. Speak greeting
// 3. Auto-start listening
// 4. Set listening loop to continuous

useEffect(() => {
  initializeAssistant(); // Called after 500ms delay
}, []);
```

**2. Continuous Listening Loop**

```
Start Recording
    ↓
Record 5-second audio chunk
    ↓
Stop recording (auto)
    ↓
Send to /transcribe-audio
    ↓
Receive transcript
    ↓
Send to /voice-query
    ↓
Speak response
    ↓
Resume recording (500ms delay)
    ↓
(repeat)
```

**3. Audio Visualization**

```typescript
// Real-time waveform animation
// Analyzes audio frequency data
// Displays 5 bars with animated heights
// Shows microphone input level in real-time
```

**4. State Management**

| State              | Type           | Purpose                             |
| ------------------ | -------------- | ----------------------------------- |
| `isListening`      | boolean        | Recording audio now                 |
| `isSpeaking`       | boolean        | Playing text-to-speech              |
| `isProcessing`     | boolean        | Processing audio/sending to backend |
| `transcript`       | string         | Recognized text from Whisper        |
| `assistantMessage` | string         | Response from backend               |
| `micLevel`         | float 0-1      | Microphone volume level             |
| `error`            | string \| null | Error message if any                |
| `hasPermission`    | bool \| null   | Microphone permission status        |
| `initialized`      | boolean        | Assistant ready to listen           |

#### Hooks Used

```typescript
// Refs
const mediaStreamRef = useRef<MediaStream | null>(null);
const mediaRecorderRef = useRef<MediaRecorder | null>(null);
const audioContextRef = useRef<AudioContext | null>(null);
const analyzerRef = useRef<AnalyserNode | null>(null);
const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
const listeningRef = useRef(false);

// Callbacks
const requestMicrophonePermission = useCallback(...);
const speak = useCallback(...);
const resumeListening = useCallback(...);
const startRecording = useCallback(...);
const setupAudioVisualization = useCallback(...);
const transcribeAndProcess = useCallback(...);
const stopListening = useCallback(...);
const initializeAssistant = useCallback(...);

// Effects
useEffect(...); // Initialize on mount
useEffect(...); // Cleanup on unmount
```

#### UI Components

**Main Control Button**

- Blue gradient: Ready
- Red gradient: Listening
- Animated: Speaking
- Size: 64px x 64px
- Location: Bottom-right corner (fixed)

**Status Indicator**

- Microphone icon with pulse animation
- Text: "Listening...", "Speaking...", "Processing...", "Ready"

**Transcript Display**

- "You said:" label
- Gray background box
- User's recognized text

**Assistant Response**

- Bot icon
- "Assistant:" label
- Blue-tinted background
- AI response text

**Audio Waveform**

- 5 vertical bars
- Animated height based on mic level
- Gradient color (indigo)
- Appears only during recording

**Error Display**

- Red background
- Error message text
- X button to dismiss

---

## Backend Implementation

### `/transcribe-audio` Endpoint

**File:** `routes/voice_api.py`

```python
@router.post("/transcribe-audio")
async def transcribe_audio(file: UploadFile = File(...)):
    """
    Transcribe audio using local Whisper model.
    """
    # 1. Save uploaded file to temp location
    # 2. Load Whisper model (singleton - only once)
    # 3. Transcribe audio
    # 4. Clean up temp file
    # 5. Return { "text": "..." }
```

**Input:**

- multipart/form-data
- Field: `file` (audio file)
- Supported formats: webm, ogg, wav, mp3

**Output:**

```json
{
  "text": "next bus to gandhipuram"
}
```

**Error Handling:**

- Empty audio file → `{ "text": "" }`
- Failed transcription → `{ "text": "" }`
- Temp file cleanup always happens

### `/voice-query` Endpoint

**File:** `routes/voice_api.py`

```python
@router.post("/voice-query")
def voice_query(payload: VoiceQueryRequest):
    """
    Process voice query with intent classification and entity extraction.
    """
    # 1. Classify intent: greeting, next_bus, find_route, bus_status, etc.
    # 2. Extract entities: origin, destination, bus_number, stop_name
    # 3. Query database based on intent
    # 4. Calculate ETAs
    # 5. Generate natural language response
```

**Input:**

```python
{
  "query": "next bus to gandhipuram",
  "city_id": 1,              # optional
  "user_lat": 11.0168,        # optional
  "user_lng": 76.9558         # optional
}
```

**Output:**

```json
{
  "intent": "next_bus",
  "entities": {
    "destination": "gandhipuram"
  },
  "message": "Bus 21A will arrive in 5 minutes."
}
```

#### Intent Classification

**Greeting**

- Keywords: "hello", "hi", "hey", "good morning"
- Response: "Hello! I am your smart bus assistant..."

**Next Bus**

- Query: "next bus to [destination]"
- Process: Find routes ending at destination → Get closest bus → Calculate ETA
- Response: "The next bus to {destination} is {bus_number}, arriving in {eta:.1f} minutes."

**Find Route**

- Query: "bus from [origin] to [destination]"
- Process: Build city graph → Dijkstra shortest path → List stops
- Response: "The best route is: {path}. Total distance {distance:.2f} km."

**Bus Status**

- Query: "where is bus [number]?", "bus [number] location"
- Process: Find bus → Get current location
- Response: "Bus {number} is currently at ({lat}, {lng})."

**Nearest Stop**

- Query: "nearest stop", "closest stop to me"
- Process: Calculate distances to all stops → Find closest
- Response: "The nearest stop is {stop_name}, about {distance:.2f} km away."

**Unknown/Fallback**

- Response: "I'm not sure I understood that. You can ask things like 'next bus to Gandhipuram'..."

---

## Whisper Model

### Configuration

**File:** `nlp/whisper_transcriber.py`

```python
from faster_whisper import WhisperModel

# Load model once (singleton pattern)
model = WhisperModel(
    model_name="base",      # or "small", "medium", "large"
    device="cpu",
    compute_type="int8"     # CPU-optimized
)

# Transcribe
segments, info = model.transcribe(
    audio_file,
    language="en",          # Optional: force language
    beam_size=5,            # Default: 5 (balance speed/accuracy)
    vad_filter=True,        # Remove silence
    vad_parameters={
        "min_speech_duration_ms": 250
    }
)
```

### Model Sizes

| Model  | Size  | Speed | Accuracy  | Recommended       |
| ------ | ----- | ----- | --------- | ----------------- |
| tiny   | 39MB  | ~10x  | Low       | Quick testing     |
| base   | 1.4GB | ~7x   | Good      | ✅ Default        |
| small  | 3GB   | ~5x   | Better    | Slower devices    |
| medium | 8GB   | ~2x   | Very good | Powerful machines |
| large  | 16GB  | ~1x   | Best      | Production        |

**Recommended:** "base" model for balance of speed and accuracy

### Performance

- **Model Loading:** ~3-5 seconds (first time only)
- **Transcription:** ~1-2 seconds per 5-second audio segment
- **Memory Usage:** ~1-2GB during inference
- **CPU:** Works on any CPU, optimized with int8 compute type

---

## Frontend Usage Examples

### Example 1: Query Next Bus

**User says:** "Next bus to Gandhipuram"

**Flow:**

```
1. VoiceAssistant captures audio
2. Sends to /transcribe-audio
3. Backend returns: { "text": "next bus to gandhipuram" }
4. Frontend sends to /voice-query with query
5. Backend classifies: intent="next_bus", entities={"destination": "gandhipuram"}
6. Backend queries database for buses on routes ending in "gandhipuram"
7. Backend calculates ETA from closest bus
8. Backend returns: { "message": "Bus 21A will arrive in 5 minutes." }
9. Frontend speaks response via SpeechSynthesis
10. Automatically resuming listening
```

### Example 2: Route Query

**User says:** "Bus from Pollachi to Coimbatore"

**Flow:**

```
1. Transcribe: "bus from pollachi to coimbatore"
2. Intent: "find_route"
3. Entities: origin="pollachi", destination="coimbatore"
4. Database: Build graph → Find shortest path
5. Response: "The best route is: Pollachi → Gandhipuram → Coimbatore. Total distance 25 km."
6. Frontend speaks, listening continues
```

### Example 3: Greeting

**User says:** "Hi there"

**Flow:**

```
1. Transcribe: "hi there"
2. Intent: "greeting" (detected from keywords)
3. Response: "Hello! I am your smart bus assistant..."
4. Resume
```

---

## Error Handling

### Frontend Error Cases

| Error                | Handling                               |
| -------------------- | -------------------------------------- |
| Microphone denied    | Show error message, offer retry button |
| Backend unavailable  | Show "Connection error", auto-retry    |
| Empty transcript     | Log as silence, resume listening       |
| Network timeout      | Show error, auto-retry                 |
| SpeechSynthesis fail | Log error, resume listening            |
| Audio recording fail | Show error, request permission again   |

### Backend Error Cases

| Error                  | Response                                  |
| ---------------------- | ----------------------------------------- |
| Empty audio file       | `{ "text": "" }`                          |
| Whisper model fails    | `{ "text": "" }` (graceful fallback)      |
| Invalid query          | Fallback intent response                  |
| Database error         | Generic "I couldn't process that" message |
| Temp file cleanup fail | Log warning, continue                     |

---

## Configuration

### Environment Variables

```bash
# Whisper model to use (optional, default: "base")
export WHISPER_MODEL="base"

# API base URL (frontend)
export VITE_API_BASE="http://localhost:8000"
```

### Frontend Configuration

**API Base URL:**

```typescript
// In voice-assistant.tsx
const API_BASE = "http://localhost:8000";
// Change for production deployment
```

### Backend Configuration

**Whisper Model:**

```python
# In nlp/whisper_transcriber.py
model_name = os.getenv("WHISPER_MODEL", "base")
```

**Voice API Logging:**

```python
# In routes/voice_api.py
logger = logging.getLogger("voice_api")
logger.setLevel(logging.INFO)  # Set to DEBUG for verbose output
```

---

## Development

### Testing the Voice Assistant

**1. Start Backend:**

```bash
cd bustracker_backend
uvicorn main:app --reload --log-level info
```

**2. Start Frontend:**

```bash
cd bus_frontend
npm run dev
```

**3. Open Browser:**

```
http://localhost:5173
```

**4. Expected Behavior:**

- Page loads → Assistant greets automatically
- Greeting plays via speakers
- Microphone activates automatically
- Say something like "Next bus to Gandhipuram"
- Transcript appears in real-time
- Assistant responds with bus info
- Microphone automatically resumes

### Testing Voice Queries Manually

**Using curl:**

```bash
# 1. Transcribe audio
curl -X POST http://localhost:8000/transcribe-audio \
  -F "file=@recording.webm"

# 2. Process voice query
curl -X POST http://localhost:8000/voice-query \
  -H "Content-Type: application/json" \
  -d '{
    "query": "next bus to gandhipuram",
    "city_id": 1
  }'
```

### Debugging

**Frontend Console:**

```javascript
// Check microphone permission
navigator.permissions
  .query({ name: "microphone" })
  .then((result) => console.log(result.state)); // "granted", "denied", "prompt"

// Check browser support
console.log(!!navigator.mediaDevices.getUserMedia); // true/false
console.log(!!window.speechSynthesis); // true/false
console.log(!!window.webkitAudioContext); // Chrome support
```

**Backend Logs:**

```bash
# Watch logs in real-time
tail -f /tmp/busdb_logs.txt

# Or enable debug logging
uvicorn main:app --reload --log-level debug
```

---

## Performance Metrics

### Typical Latency (5-second audio segment)

| Step                  | Latency                        |
| --------------------- | ------------------------------ |
| Audio capture         | Real-time                      |
| Upload to backend     | 100-500ms (depends on network) |
| Whisper transcription | 1-2 seconds                    |
| Intent classification | <100ms                         |
| Database query        | <100ms                         |
| Response generation   | <100ms                         |
| **Total**             | **2-3 seconds**                |

### Optimization Tips

1. **Better accuracy:** Use "small" model instead of "base"
2. **Faster response:** Ensure MySQL has proper indexes
3. **Lower latency:** Host backend on same machine as frontend
4. **Network:** Use wired connection or WiFi 5GHz
5. **Audio:** Minimize background noise

---

## Troubleshooting

### Microphone not working

**Solution:**

1. Check browser permissions (Settings → Privacy)
2. Restart browser
3. Check device microphone (test in other app)
4. Try different audio format (webm, ogg, wav)

### Assistant not responding

**Solution:**

1. Check backend is running: `http://localhost:8000/docs`
2. Check network tab in DevTools
3. Look for error messages in console
4. Verify port 8000 is accessible

### Whisper model slow to load

**Solution:**

1. Use smaller model: `export WHISPER_MODEL="tiny"`
2. First transcription is always slow (model loading)
3. Subsequent transcriptions are fast (model cached)
4. Consider running on GPU if available

### Audio quality issues

**Solution:**

1. Reduce background noise
2. Speak more clearly
3. Use a better microphone
4. Try "small" or "medium" Whisper model

---

## Browser Compatibility

| Feature         | Chrome | Firefox | Safari       | Edge |
| --------------- | ------ | ------- | ------------ | ---- |
| Web Audio API   | ✅     | ✅      | ✅           | ✅   |
| MediaRecorder   | ✅     | ✅      | ⚠️ (limited) | ✅   |
| SpeechSynthesis | ✅     | ✅      | ✅           | ✅   |
| getUserMedia    | ✅     | ✅      | ✅           | ✅   |
| **Recommended** | ✅✅   | ✅      | ⚠️           | ✅   |

**Console Support:** Web Audio input NOT supported in mobile browsers (voice assistant requires desktop/laptop with microphone)

---

## Production Deployment

### Pre-Deployment Checklist

- [ ] Change API base URL to production domain
- [ ] Set `WHISPER_MODEL="base"` (or larger if CPU available)
- [ ] Enable HTTPS for microphone access (required)
- [ ] Configure CORS for production origin
- [ ] Set up monitoring/logging
- [ ] Test on target browsers/devices
- [ ] Verify microphone permissions dialog
- [ ] Load test with concurrent users
- [ ] Monitor memory usage during Whisper transcription

### Scaling Considerations

- **Single machine:** No issues, Whisper model loads once
- **Multiple servers:** Whisper model loads per server (cache locally)
- **Distributed:** Consider speech-to-text service AWS Transcribe, Azure Speech, Google Cloud Speech (cloud alternatives)

---

## Summary

The improved Voice Assistant system provides:

✅ **Automatic startup** - Greet and listen without user action
✅ **Continuous listening** - Always waiting for next query
✅ **Local Whisper** - Privacy-first, offline transcription
✅ **Intelligent intent** - DistilBERT-powered understanding
✅ **Natural responses** - Context-aware, database-backed answers
✅ **Real-time feedback** - Visual waveform, status indicators
✅ **Error resilience** - Graceful fallbacks, auto-recovery
✅ **Production-ready** - Optimized performance, comprehensive logging
