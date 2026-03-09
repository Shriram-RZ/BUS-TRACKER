# Voice Assistant Implementation Checklist & Quick Start

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm
- Python 3.11+
- MySQL with BusTracker database
- Modern browser (Chrome/Edge recommended)

### 1. Clone & Setup

```bash
# Clone repository
git clone <repo>
cd bus_tracker

# Backend setup
cd bustracker_backend
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r requirements.txt
mysql -u root -p 1234 < setup.sql

# Frontend setup
cd ../bus_frontend
npm install
```

### 2. Start Application

**Terminal 1 - Backend:**

```bash
cd bustracker_backend
source venv/bin/activate
uvicorn main:app --reload --log-level info
# Backend lives at http://localhost:8000
```

**Terminal 2 - Frontend:**

```bash
cd bus_frontend
npm run dev
# Frontend lives at http://localhost:5173
```

### 3. Test Voice Assistant

1. Open browser: `http://localhost:5173`
2. Grant microphone permission when prompted
3. Listen for automatic greeting
4. Say: "Next bus to Gandhipuram"
5. Hear response and see transcript

---

## 📋 Implementation Checklist

### Frontend (Voice Assistant Component)

- [x] **Auto-startup greeting**
  - Location: `src/app/components/voice-assistant.tsx`
  - Greeting plays on component mount (500ms delay)
  - Automatically starts microphone after greeting

- [x] **Continuous microphone listening**
  - Records 5-second audio chunks
  - Automatic restart after processing
  - Never stops unless user manually stops

- [x] **Audio visualization**
  - 5-bar waveform animation
  - Real-time frequency analysis
  - Microphone level indicator
  - Visible only during recording

- [x] **Microphone indicator UI**
  - Listening/Speaking/Processing status
  - Pulsing animation when recording
  - Color-coded: blue (ready), red (listening), blue (speaking)

- [x] **Transcript display**
  - Shows recognized text from Whisper
  - "You said:" label
  - Gray box background

- [x] **Assistant response display**
  - Bot icon + assistant label
  - Indigo background box
  - Full response message from backend

- [x] **Error handling UI**
  - Red error box with message
  - X button to dismiss
  - Auto-retry on network errors

- [x] **State management**
  - isListening, isSpeaking, isProcessing
  - transcript, assistantMessage
  - hasPermission, initialized
  - micLevel (0-1 float)

- [x] **Permission request**
  - Requests microphone access on mount
  - Handles denied permission gracefully
  - Shows clear error message

- [x] **Speech synthesis**
  - Uses browser SpeechSynthesis API
  - Rate: 1, Pitch: 1, Volume: 1
  - Auto-resumes listening after speaking

### Backend (API Endpoints)

- [x] **`/transcribe-audio` endpoint**
  - Location: `routes/voice_api.py`
  - Accepts multipart audio file (webm/ogg/wav)
  - Uses faster-whisper for transcription
  - Returns `{ "text": "..." }`
  - Cleanup temp files properly

- [x] **`/voice-query` endpoint**
  - Classifies intent (greeting, next_bus, find_route, etc.)
  - Extracts entities (origin, destination, bus_number)
  - Queries database
  - Calculates ETAs
  - Returns natural language response

### Backend (Whisper Integration)

- [x] **Whisper model loading**
  - Singleton pattern (load once)
  - CPU-optimized (int8 compute type)
  - Model: "base" by default
  - Lazy loading on first transcription request

- [x] **Whisper segmentation**
  - VAD (Voice Activity Detection) enabled
  - Removes silence
  - Min speech duration: 250ms
  - Beam size: 5 (default)

- [x] **Audio file handling**
  - Accepts various formats (webm, ogg, wav, mp3)
  - Creates temp file for processing
  - Cleans up temp file after transcription
  - Error handling for empty files

### Backend (Intent Classification)

- [x] **Greeting intent**
  - Keywords: "hello", "hi", "hey", "good morning"
  - Response: Welcome message

- [x] **Next bus intent**
  - Pattern: "next bus to [destination]"
  - Finds routes, calculates ETA
  - Returns bus number and time

- [x] **Find route intent**
  - Pattern: "bus from [origin] to [destination]"
  - Uses Dijkstra shortest path
  - Returns route and distance

- [x] **Bus status intent**
  - Pattern: "where is bus [number]?"
  - Returns current bus position

- [x] **Nearest stop intent**
  - Finds closest stop to user (if location provided)
  - Returns distance and stop name

- [x] **Fallback/Unknown**
  - Helpful error message with examples
  - Suggestions for valid queries

### Features

- [x] **Real-time transcript display**
  - Shows what user said
  - Updates as audio is processed

- [x] **Real-time response display**
  - Shows AI response immediately
  - Reads response aloud

- [x] **Continuous conversation loop**
  - Listen → Process → Speak → Listen again
  - No manual re-activation needed

- [x] **Audio level visualization**
  - Animated waveform bars
  - Shows microphone input level

- [x] **Microphone status indicator**
  - Listening / Speaking / Processing / Ready states
  - Pulse animation when recording

- [x] **Error recovery**
  - Graceful handling of permission denied
  - Automatic retry on network errors
  - Continues listening on partial failures

### Testing

- [ ] **Manual testing checklist**
  - [ ] Grant microphone permission
  - [ ] Hear automatic greeting
  - [ ] See microphone indicator
  - [ ] Say "Next bus to Gandhipuram"
  - [ ] See transcript in UI
  - [ ] Hear response
  - [ ] Microphone auto-resumes
  - [ ] Say another query without clicking
  - [ ] Repeat without manual activation

- [ ] **Error scenario testing**
  - [ ] Deny microphone permission → Error message
  - [ ] Disconnect network → Auto-retry
  - [ ] Backend unavailable → Error message
  - [ ] Speak silently → Silence detected
  - [ ] Speak too fast → Full transcript captured
  - [ ] Speak too slow → Waits for completion

- [ ] **Browser compatibility**
  - [ ] Chrome (primary)
  - [ ] Firefox
  - [ ] Edge
  - [ ] Safari (limited support)

- [ ] **Performance testing**
  - [ ] Whisper model loads in <5 seconds
  - [ ] Transcription takes <2 seconds per 5s audio
  - [ ] Intent classification <100ms
  - [ ] Total latency <3 seconds
  - [ ] Memory usage <2GB during transcription

### Deployment

- [ ] **Environment setup**
  - [ ] Set `WHISPER_MODEL` if needed
  - [ ] Set API base URL for production
  - [ ] Configure CORS for frontend origin

- [ ] **Security**
  - [ ] Enable HTTPS (required for microphone)
  - [ ] Validate audio file size (max 25MB recommended)
  - [ ] Rate limit transcription endpoint
  - [ ] Sanitize user input

- [ ] **Monitoring**
  - [ ] Log all transcriptions for analysis
  - [ ] Monitor Whisper model latency
  - [ ] Track error rates
  - [ ] Monitor memory/CPU usage

- [ ] **Documentation**
  - [ ] Update API docs (Swagger)
  - [ ] Create user guide
  - [ ] Document configuration
  - [ ] List browser requirements

---

## 📂 File Structure

```
bus_tracker/
├── bus_frontend/
│   └── src/app/
│       ├── components/
│       │   └── voice-assistant.tsx          ⭐ Main voice UI
│       ├── lib/
│       │   └── bus-context.tsx              Context (provides selectedCityId)
│       └── ...
│
├── bustracker_backend/
│   ├── routes/
│   │   ├── voice_api.py                     ⭐ /transcribe-audio, /voice-query
│   │   ├── routes_api.py                    /bus-locations (ETA calc)
│   │   └── admin_api.py
│   │
│   ├── nlp/
│   │   ├── whisper_transcriber.py          ⭐ Whisper model (singleton)
│   │   ├── intent_model.py                  Intent classification
│   │   └── ...
│   │
│   ├── ml/
│   │   └── eta_model.py                     ETA prediction
│   │
│   ├── utils/
│   │   └── geo_utils.py                     Haversine, calculate_eta
│   │
│   └── main.py                              FastAPI app
│
└── VOICE_ASSISTANT_GUIDE.md                 ⭐ Complete documentation
```

---

## 🔄 Data Flow

### Simple Query Flow

```
User opens webpage
    ↓
VoiceAssistant mounts
    ↓
requestMicrophonePermission()
    ↓ (user grants permission)
initializeAssistant()
    ├─ speak(greeting)
    └─ startRecording()

Recording loop:
    ↓
recordingTimer (5 seconds)
    ↓
mediaRecorder.stop()
    ↓
transcribeAndProcess(audioBlob)
    ├─ POST /transcribe-audio → { text: "next bus to x" }
    ├─ POST /voice-query → { message: "Bus 21A in 5 min" }
    ├─ speak(message)
    └─ resumeListening()

    ↓
(repeat from Recording loop)
```

---

## 🔧 Configuration

### Frontend

**File:** `src/app/components/voice-assistant.tsx`

```typescript
// Change API base URL for production
const API_BASE = "http://localhost:8000";
// → "https://api.bustrack.example.com" for production
```

### Backend

**File:** `bustracker_backend/.env` or environment variables

```bash
# Default model (change if needed)
WHISPER_MODEL=base    # or "small", "medium", etc.

# Database (from database.py)
DATABASE_URL=mysql+pymysql://root:1234@localhost/busdb
```

---

## 🧪 Testing Commands

### Frontend Testing

```bash
# Check microphone support
node -e "console.log(!!navigator.mediaDevices)"

# Test audio context
node -e "console.log(!!window.AudioContext)"

# Check speech synthesis
node -e "console.log(!!window.speechSynthesis)"
```

### Backend Testing

```bash
# Test transcribe endpoint
curl -X POST http://localhost:8000/transcribe-audio \
  -F "file=@test_audio.webm"

# Test voice-query endpoint
curl -X POST http://localhost:8000/voice-query \
  -H "Content-Type: application/json" \
  -d '{
    "query": "next bus to gandhipuram",
    "city_id": 1
  }'

# Check Swagger docs
open http://localhost:8000/docs
```

### Database Testing

```bash
mysql -u root -p 1234 busdb
> SELECT COUNT(*) FROM buses;
> SELECT * FROM bus_locations;
> SELECT * FROM routes;
```

---

## 🚦 Troubleshooting

### Issue: Microphone not detected

**Check:**

```bash
# Browser console
navigator.mediaDevices.enumerateDevices()
  .then(devices => console.log(devices))
```

**Fix:**

- Restart browser
- Check OS microphone permissions
- Try different browser

### Issue: Assistant not responding

**Check:**

```bash
# Backend running?
curl http://localhost:8000/docs

# Frontend network tab
watch /transcribe-audio and /voice-query requests
```

**Fix:**

- Start backend: `uvicorn main:app --reload`
- Check firewall (port 8000)
- Verify API base URL

### Issue: Whisper model loading slow

**Expect:**

- First transcription: 3-5 seconds (model loading)
- Subsequent: <2 seconds (cached)

**Optimize:**

```bash
# Use smaller model
export WHISPER_MODEL=tiny  # 39MB, ~10x faster

# Or use larger model for better accuracy
export WHISPER_MODEL=small  # 3GB, 5x faster than large
```

---

## 📊 Performance Expectations

### Typical Latency (5-second audio)

| Component             | Time      |
| --------------------- | --------- |
| Audio capture         | Real-time |
| Network upload        | 100-500ms |
| Whisper transcription | 1-2s      |
| Intent classification | <100ms    |
| Database query        | <100ms    |
| Response generation   | <100ms    |
| Speech synthesis      | ~2-5s     |
| **Total**             | **2-3s**  |

### System Requirements

- **CPU:** 2+ cores (4+ recommended)
- **RAM:** 2GB minimum (4GB+ recommended)
- **Network:** 1Mbps upload minimum
- **Browser:** Modern (Chrome/Firefox/Edge)

---

## ✅ Verification Checklist

Run this to verify everything works:

```bash
# 1. Backend starts
cd bustracker_backend
python -m pytest tests/  # If tests exist

# 2. Frontend builds
cd ../bus_frontend
npm run build

# 3. Database connected
mysql -u root -p 1234 busdb -e "SELECT VERSION();"

# 4. Whisper model can load
python -c "from faster_whisper import WhisperModel; \
  m = WhisperModel('base', device='cpu', compute_type='int8'); \
  print('✅ Whisper ready')"

# 5. API endpoints respond
curl -s http://localhost:8000/docs | grep -q "openapi" && echo "✅ API ready"

# 6. Frontend loads
curl -s http://localhost:5173 | grep -q "BusTracker" && echo "✅ Frontend ready"
```

---

## 📞 Support

### Debug Mode

Enable debug logging:

```bash
# Backend
uvicorn main:app --reload --log-level debug 2>&1 | tee debug.log

# Check logs for voice operations
grep -i "voice\|transcrib\|whisper" debug.log
```

### Browser DevTools

```javascript
// Console commands for debugging
console.log("Listening?", isListening);
console.log("Current transcript:", transcript);
console.log("Assistant:", assistantMessage);
console.log("Error?", error);

// Network tab
// Watch for:
// - POST /transcribe-audio
// - POST /voice-query
// - GET /bus-locations (polling)
```

---

## 🎓 Learning Resources

- **Whisper Model:** https://github.com/openai/whisper
- **faster-whisper:** https://github.com/guillaumekln/faster-whisper
- **Web Audio API:** https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API
- **MediaRecorder API:** https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder
- **FastAPI:** https://fastapi.tiangolo.com/
- **React:** https://react.dev/

---

## 🎉 Success!

If everything works:

1. ✅ Website loads
2. ✅ Microphone requested
3. ✅ Greeting plays
4. ✅ Microphone indicator shows
5. ✅ Say anything
6. ✅ Transcript appears
7. ✅ Response speaks
8. ✅ Listening resumes automatically

**You now have a fully functional voice assistant!** 🚀
