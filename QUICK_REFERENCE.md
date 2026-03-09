# BusTracker - Developer Quick Reference Guide

## 📂 Folder Structure & Key Files

### Backend (`bustracker_backend/`)

```
📦 bustracker_backend
├── main.py                 ⭐ ENTRY POINT - FastAPI app initialization
├── database.py             Database connection & SessionLocal
├── models.py               SQLAlchemy ORM models (City, Route, Stop, Bus, BusLocation)
├── schemas.py              Pydantic request/response schemas
├── cache.py                Redis caching utilities
├── requirements.txt        Python dependencies
├── setup.sql               Database initialization script
│
├── routes/                 🔑 API ENDPOINTS
│   ├── __init__.py
│   ├── routes_api.py       GET /cities, /routes, /buses, /bus-locations
│   ├── admin_api.py        POST/DELETE /admin/* endpoints
│   └── voice_api.py        POST /search-route, /voice-query, /transcribe
│
├── simulation/             🚌 BUS MOVEMENT
│   └── bus_simulator.py    Async tasks for real-time bus position updates
│
├── ml/                     🤖 MACHINE LEARNING
│   └── eta_model.py        ETA prediction model (RandomForest/LightGBM)
│
├── nlp/                    🎤 SPEECH & LANGUAGE
│   ├── intent_model.py     DistilBERT intent classifier
│   └── whisper_transcriber.py  Speech-to-text
│
├── routing/                🗺️ PATHFINDING
│   └── graph.py            Dijkstra shortest path between bus stops
│
└── utils/
    └── geo_utils.py        Haversine distance, ETA calculations
```

### Frontend (`bus_frontend/src/app/`)

```
📦 src/app
├── App.tsx                 Router wrapper
├── routes.ts               React Router configuration
├── main.tsx                React entry point
│
├── components/             🎨 UI PAGES & COMPONENTS
│   ├── layout.tsx          Master layout + navbar + voice assistant
│   ├── home-page.tsx       Main dashboard with map + route selector
│   ├── deaf-page.tsx       Visual-optimized interface (Deaf/HoH users)
│   ├── blind-page.tsx      Voice-optimized interface (Blind/LV users)
│   ├── admin-page.tsx      Route/bus management panel
│   ├── bus-map.tsx         Leaflet map with buses, stops, routes
│   ├── voice-assistant.tsx Floating voice UI
│   │
│   └── ui/                 📦 SHADCN/RADIX COMPONENTS
│       ├── button.tsx
│       ├── card.tsx
│       ├── dialog.tsx
│       ├── form.tsx
│       ├── glass-card.tsx
│       ├── input.tsx
│       ├── select.tsx
│       ├── table.tsx
│       ├── animated-button.tsx
│       └── ... (20+ more base components)
│
└── lib/                    🔧 STATE & UTILITIES
    ├── bus-context.tsx     🔑 Global state (BusContext + BusProvider)
    ├── types.ts            TypeScript interfaces
    ├── utils.ts            Helper functions
    ├── haversine.ts        Geographic distance
    └── imports/
        └── bus-tracking-app.md  Project documentation
```

---

## 🔄 Data Flow Walkthrough

### Backend: How a Bus Location Request Works

```
User opens app
    ↓
GET /bus-locations?city_id=1
    ↓
routes_api.py:get_bus_locations()
    ├─ Query all buses for city
    ├─ For each bus:
    │  ├─ Check Redis cache first (fast path)
    │  ├─ If miss, query BusLocation table
    │  ├─ Calculate ETAs:
    │  │  ├─ Get stops on route
    │  │  ├─ Calculate distance
    │  │  ├─ Try ML prediction
    │  │  └─ Fallback to simple formula
    │  └─ Build response
    └─ Return JSON array

    ↓
Frontend receives data
    ↓
BusContext.setBusLocations()
    ↓
Components re-render with new positions
```

### Full Voice Processing Pipeline

```
🎤 Voice Input
    ↓ (MediaRecorder API captures 5-second audio chunks)
    ↓
🎙️  Whisper Transcription (whisper_transcriber.py)
    ├─ Load faster-whisper model (cached singleton)
    ├─ MFCC feature extraction
    ├─ Neural network inference
    └─ Return: "next bus to gandhipuram"
    ↓
🧠 Intent Model (DistilBERT - intent_model.py)
    ├─ Token embedding
    ├─ Transformer attention layers
    ├─ Classification: greeting|next_bus|find_route|bus_status|nearest_stop|unknown
    └─ Confidence score
    ↓
🔍 Entity Extraction (intent_model.py)
    ├─ Regex pattern matching: locations, bus numbers, stops
    ├─ Spell correction & fuzzy matching
    ├─ Map to database IDs
    └─ Extract: destination="gandhipuram", intent="next_bus"
    ↓
🗄️  Database Query (routes_api.py + models.py)
    ├─ Find route with destination
    ├─ Get all buses on route
    ├─ Find current location (BusLocation table)
    ├─ Query stops (Stop table)
    ├─ Calculate distance (Haversine)
    └─ Predict ETA (ML model or formula)
    ↓
📝 Dynamic Response Generation (voice_api.py)
    ├─ Format data into natural language
    ├─ Add context (distance, time, bus number)
    ├─ Handle edge cases (no buses, not found)
    └─ Return: "Bus 21A will arrive in 5 minutes at Gandhipuram"
    ↓
🔊 Speech Output (SpeechSynthesis API)
    ├─ Convert text to audio stream
    ├─ Play through speakers
    ├─ Wait for completion
    └─ Resume listening automatically
    ↓
🎤 Resume Listening
    └─ Loop back to Voice Input for next query
```

### Frontend: Voice Query Processing (Detailed)

```
User says: "Next bus to Gandhipuram"
    ↓
VoiceAssistant Component (voice-assistant.tsx)
    ├─ mediaStreamRef captures audio via MediaRecorder
    ├─ setupAudioVisualization() shows frequency bars
    ├─ recordingTimerRef stops after 5 seconds
    └─ Blob created from audio chunks
    ↓
POST /transcribe-audio (multipart: audio.webm)
    ↓
Backend: whisper_transcriber.py
    ├─ write temp file to disk
    ├─ load model (cached)
    ├─ model.transcribe(path)
    ├─ VAD filter removes silence
    └─ return { text: "next bus to gandhipuram" }
    ↓
Frontend receives transcript
    ├─ setTranscript(recognizedText)
    ├─ setIsProcessing(true)
    └─ Display "You said: next bus to gandhipuram"
    ↓
POST /voice-query { query, city_id, user_lat, user_lng }
    ↓
Backend: voice_api.py:voice_query()
    ├─ intent_model.classify(query)
    │  └─ returns: intent="next_bus", entities={destination:"gandhipuram"}
    ├─ lookup_intent_handler(intent)
    │  └─ route to database query logic
    ├─ find_route_by_destination(destination, city_id)
    │  └─ returns: Route object + Buses on route
    ├─ get_bus_eta(bus_id, destination_stop)
    │  ├─ calculate_distance(current_pos, destination)
    │  ├─ predict_eta(distance, speed) [ML or formula]
    │  └─ returns: 5 minutes (example)
    └─ format_response(intent, entities, data)
    ↓
Backend returns:
{
  "intent": "next_bus",
  "entities": {"destination": "gandhipuram"},
  "message": "Bus 21A will arrive in 5 minutes at Gandhipuram."
}
    ↓
Frontend receives response
    ├─ setAssistantMessage(response.message)
    ├─ setIsProcessing(false)
    └─ speak(response.message)
    ↓
SpeechSynthesis API
    ├─ utterance = new SpeechSynthesisUtterance(message)
    ├─ synth.speak(utterance)
    ├─ setIsSpeaking(true)
    └─ play: "Bus 21A will arrive in 5 minutes at Gandhipuram"
    ↓
When speech finishes
    ├─ utterance.onend() triggered
    ├─ setIsSpeaking(false)
    ├─ resumeListening() called
    └─ startRecording() auto-starts next cycle
    ↓
🎤 Ready for next query (loop continues)
```

---

## 🚀 Common Development Tasks

### Add a New API Endpoint

**Backend:**

```python
# 1. Define schema (schemas.py)
class MyOutputSchema(BaseModel):
    id: int
    data: str

# 2. Create endpoint (routes/routes_api.py)
@router.get("/my-endpoint", response_model=MyOutputSchema)
def my_endpoint(db: Session = Depends(get_db)):
    """Docstring for Swagger UI"""
    data = db.query(MyModel).first()
    return MyOutputSchema.from_orm(data)

# 3. Endpoint auto-added to /docs
```

### Add a New Frontend Page

**Frontend:**

```typescript
// 1. Create component (components/my-page.tsx)
export function MyPage() {
  const { buses, routes } = useBusContext();
  return <div>{/* Your UI */}</div>;
}

// 2. Add route (routes.ts)
import { MyPage } from "./components/my-page";
export const router = createBrowserRouter([
  {
    path: "/",
    Component: Layout,
    children: [
      { path: "my-page", Component: MyPage },
    ],
  },
]);

// 3. Add nav link (components/layout.tsx)
const navItems = [
  { to: "/my-page", label: "My Page", icon: IconComponent },
];
```

### Update Bus Simulation Speed

```python
# simulation/bus_simulator.py
INTERPOLATION_STEPS: int = 20  # More = smoother
UPDATE_INTERVAL: float = 3.0   # Seconds between updates
```

### Change ETA Calculation

```python
# routes/routes_api.py
# Update the ETA calculation logic in get_bus_locations()

from ..ml.eta_model import predict_eta

# Use ML prediction if available
eta = predict_eta(features) if _ETA_MODEL else calculate_eta(distance, speed)
```

---

## 🔑 Key Classes & Patterns

### Backend

**BusContext (Frontend)** - Manages all bus/route/location state

```typescript
const { buses, routes, busLocations, addRoute, addBus } = useBusContext();
```

**SQLAlchemy Models** - ORM with relationships

```python
class Bus(Base):
    __tablename__ = "buses"
    id = Column(Integer, primary_key=True)
    route = relationship("Route", back_populates="buses")
    location = relationship("BusLocation", uselist=False)
```

**FastAPI Dependency Injection** - Database session

```python
def my_endpoint(db: Session = Depends(get_db)):
    bus = db.query(Bus).first()
```

### Frontend

**React Context** - State management

```typescript
export function BusProvider({ children }) {
  const [buses, setBuses] = useState<Bus[]>([]);
  // ... provide via BusContext
}

// In any component:
const { buses } = useBusContext();
```

**Leaflet Markers** - Custom bus icons

```typescript
function createBusIcon(color: string, status: string) {
  return L.divIcon({
    html: `<div style="background: ${color}">🚌</div>`,
    iconSize: [36, 36],
  });
}
```

---

## 📊 Database Relationships

**One-to-Many:**

- City → Routes (one city has many routes)
- City → Buses (one city has many buses)
- Route → Stops (one route has many stops)
- Route → Buses (one route has many buses)

**One-to-One:**

- Bus → BusLocation (one bus has one location)

**Query Example:**

```python
# Get all stops for route 5
stops = db.query(Stop).filter(Stop.route_id == 5).order_by(Stop.stop_order)

# Get buses with locations for city 1
buses = db.query(Bus).filter(Bus.city_id == 1).options(
    joinedload(Bus.location)
)
```

---

## 🎨 Styling & UI

**Tailwind Classes:**

```typescript
// Layout
className = "flex gap-4 p-6";
// Colors: text-indigo-600, bg-emerald-500, border-slate-200
// Responsive: md:w-96, lg:flex-row
// Animations: animate-pulse, transition-all
```

**Glass Card Component:**

```typescript
<GlassCard hoverEffect={false} className="rounded-3xl">
  {/* Frosted glass effect background */}
</GlassCard>
```

**Animation with Motion:**

```typescript
<motion.div
  initial={{ opacity: 0 }}
  animate={{ opacity: 1 }}
  transition={{ duration: 0.3 }}
>
  Animated content
</motion.div>
```

---

## 🧪 Running Tests

**Backend:**

```bash
cd bustracker_backend
pytest tests/test_routes.py -v
pytest tests/test_simulation.py
```

**Frontend:**

```bash
cd bus_frontend
npm test
```

---

## 🔍 Debugging Tips

### Backend

- Check logs: `uvicorn main:app --log-level debug`
- Swagger UI: `http://localhost:8000/docs`
- Database: `mysql -u root -p 1234 busdb` then `SELECT * FROM buses;`

### Frontend

- Browser DevTools (F12)
- React DevTools extension for component tree
- Check network tab for API calls
- Console for JavaScript errors

### Redis

```bash
redis-cli
> KEYS *
> GET bus:1:5  # city_id=1, bus_id=5
> FLUSHDB      # Clear all cache
```

---

## 🚪 Entry Points

**Backend Start:**

```bash
uvicorn bustracker_backend.main:app --reload
# OR
cd bustracker_backend && uvicorn main:app --reload
```

**Frontend Start:**

```bash
cd bus_frontend && npm run dev
```

**Database:**

```bash
mysql -u root -p < setup.sql
```

---

## 📝 Response Format Examples

### `/bus-locations` Response

```json
[
  {
    "bus_id": 1,
    "bus_number": "21A",
    "lat": 11.0168,
    "lng": 76.9558,
    "eta_minutes": 5.2,
    "city_id": 1,
    "last_updated": "2024-03-04T10:30:45Z"
  }
]
```

### `/search-route` Response

```json
{
  "message": "Bus 21A on Pollachi → Coimbatore is arriving in 8 minutes at Gandhipuram."
}
```

### `/admin/add-route` Request

```json
{
  "start_location": "Pollachi",
  "end_location": "Coimbatore",
  "stops": [
    {
      "stop_name": "Station",
      "latitude": 10.65,
      "longitude": 77.01,
      "stop_order": 1
    }
  ]
}
```

---

## 🔐 Important Notes

1. **Comments Removed:** Source code has no comments per project requirement
2. **No Environment File:** Project self-contained, no .env needed
3. **Database Credentials:** Default `root:1234@localhost/busdb`
4. **CORS Enabled:** All origins allowed (restrict in production!)
5. **Async Actions:** Each bus runs in its own asyncio task
6. **Redis Optional:** Gracefully disables if unavailable

---

## 🎤 Voice Assistant Guide

### Voice-Related API Endpoints

**POST** `/transcribe-audio`

- **Purpose:** Convert audio to text using Whisper
- **Request:** multipart/form-data with audio file
- **Response:** `{ "text": "transcribed text" }`
- **File:** `routes/voice_api.py`
- **Model:** faster-whisper "base" (1.4GB, CPU int8)

**POST** `/voice-query`

- **Purpose:** Process transcribed text and return intelligent response
- **Request:**
  ```json
  {
    "query": "next bus to gandhipuram",
    "city_id": 1,
    "user_lat": 11.0168,
    "user_lng": 76.9558
  }
  ```
- **Response:**
  ```json
  {
    "intent": "next_bus",
    "entities": { "destination": "gandhipuram" },
    "message": "Bus 21A will arrive in 5 minutes at Gandhipuram."
  }
  ```
- **File:** `routes/voice_api.py`
- **Intents:** greeting, next_bus, find_route, bus_status, nearest_stop, unknown

### Voice Command Examples

| Command                           | Intent       | Entities            | Response                   |
| --------------------------------- | ------------ | ------------------- | -------------------------- |
| "Hello" / "Hi"                    | greeting     | -                   | Greets user with bus count |
| "Next bus to Gandhipuram"         | next_bus     | destination         | Bus number + ETA           |
| "Bus from Pollachi to Coimbatore" | find_route   | origin, destination | Route + bus info           |
| "Where is bus 21A?"               | bus_status   | bus_number          | Current location + route   |
| "Nearest stop"                    | nearest_stop | -                   | Closest stop + distance    |
| "What?"                           | unknown      | -                   | Helpful fallback message   |

### Voice Assistant Component Files

**Frontend:**

- `bus_frontend/src/app/components/voice-assistant.tsx` (400 lines)
  - State: isListening, isSpeaking, isProcessing, transcript, assistantMessage
  - Refs: mediaStreamRef, mediaRecorderRef, audioContextRef, analyzerRef
  - Frequency visualization: 20-bar real-time graph
  - Auto-start greeting on mount
  - Continuous 5-second recording loop
  - Resume listening after speech

**Backend:**

- `bustracker_backend/routes/voice_api.py` (400+ lines)
  - /transcribe-audio endpoint
  - /voice-query endpoint
  - Response formatting
- `bustracker_backend/nlp/whisper_transcriber.py` (60 lines)
  - Singleton model loading
  - Cached faster-whisper model
  - VAD (Voice Activity Detection)
  - CPU int8 optimization
- `bustracker_backend/nlp/intent_model.py` (100 lines)
  - DistilBERT classifier
  - Rule-based fallback
  - Entity extraction with regex

### Voice System Troubleshooting

| Issue                      | Cause               | Solution                                           |
| -------------------------- | ------------------- | -------------------------------------------------- |
| Microphone not working     | Permission denied   | Check browser settings, refresh page               |
| Assistant not speaking     | Volume muted        | Check system volume, browser settings              |
| No transcript shown        | Empty audio         | Speak clearly, avoid background noise              |
| Slow transcription         | Model loading       | First call is slow (3-5s), subsequent calls <100ms |
| Wrong intent detected      | Poor audio quality  | Speak naturally, minimize background noise         |
| No response generated      | Backend error       | Check console, verify database connection          |
| Frequency bars not showing | React state issue   | Ensure isListening is true, check browser console  |
| Commands not recognized    | Intent not matching | Use natural language, refer to examples            |

### Testing Voice Queries

**Manual Testing with cURL:**

```bash
# 1. Test transcription
curl -X POST http://localhost:8000/transcribe-audio \
  -F "file=@audio.webm"

# Response: { "text": "your transcribed text" }

# 2. Test intent classification
curl -X POST http://localhost:8000/voice-query \
  -H "Content-Type: application/json" \
  -d '{
    "query": "next bus to gandhipuram",
    "city_id": 1,
    "user_lat": 11.0168,
    "user_lng": 76.9558
  }'

# Response: { "intent": "next_bus", "entities": {...}, "message": "..." }
```

### Voice System Performance Metrics

| Metric                        | Value       | Notes                           |
| ----------------------------- | ----------- | ------------------------------- |
| Model Load Time (first)       | 3-5 seconds | Single-threaded, cached to disk |
| Model Load Time (cached)      | <100ms      | Already in memory               |
| Transcription Latency         | 1-2 seconds | Per 5-second audio chunk        |
| Intent Classification         | <100ms      | Rule-based or DistilBERT        |
| Entity Extraction             | <50ms       | Regex patterns                  |
| Database Query                | 50-200ms    | Depends on Dijkstra complexity  |
| Speech Synthesis              | Real-time   | Native browser API              |
| End-to-End (user to response) | 2-3 seconds | Total latency for quick queries |
| Memory Peak                   | ~2GB        | During Whisper transcription    |
| CPU Usage                     | 70-80%      | During transcription, <5% idle  |

### Voice Assistant Browser Support

| Browser       | Support    | Notes                                |
| ------------- | ---------- | ------------------------------------ |
| Chrome 90+    | ✅ Full    | Best performance, all APIs           |
| Firefox 88+   | ✅ Full    | Good performance                     |
| Edge 90+      | ✅ Full    | Chromium-based, same as Chrome       |
| Safari 14.1+  | ⚠️ Limited | SpeechSynthesis works, check Whisper |
| Mobile Chrome | ✅ Full    | Works on Android                     |
| Mobile Safari | ⚠️ Limited | iOS limitations on APIs              |
