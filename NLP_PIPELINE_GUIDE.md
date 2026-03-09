# Advanced NLP Pipeline Implementation Guide

## ✅ Implementation Complete

Your BusTracker voice assistant now has a **complete intelligent NLP pipeline** with **zero hardcoded responses**.

---

## 🎯 What Was Implemented

### 1. **Entity Extraction Module** (`entity_extractor.py`)

Advanced entity extraction with **fuzzy matching** against database values:

```python
from nlp.entity_extractor import extract_entities_advanced, resolve_entity_references

# Fuzzy match locations against actual stops in database
entities = extract_entities_advanced(
    query="next bus to gandipuram",  # typo!
    db=db_session,
    city_id=1
)
# Returns: destination="Gandhipuram" (fuzzy matched!)

# Resolve entity references to database IDs
resolved = resolve_entity_references(entities, db, city_id=1)
# Returns: destination_id=15, origin_id=8
```

**Features:**

- Bus number extraction
- Stop name fuzzy matching (handles typos!)
- Location origin/destination parsing
- Database ID resolution

---

### 2. **Response Generation Module** (`response_generator.py`)

Dynamic response generation using **templates + data** (NO hardcoding):

```python
from nlp.response_generator import (
    generate_next_bus_response,
    generate_route_response,
    generate_nearest_stop_response,
)

# All responses are dynamically generated
response = generate_next_bus_response(
    bus_number="21A",
    destination="Gandhipuram",
    eta_minutes=5.2,
    current_stop="Peelamedu"
)
# Possible outputs (randomly selected):
# - "Bus 21A heading to Gandhipuram will arrive in about 5 minutes."
# - "The next bus to Gandhipuram is 21A, arriving in roughly 5 minutes."
# - "Bus 21A going to Gandhipuram will be here in 5 minutes."
```

**Key Principle:** No hardcoded responses. All responses generated from templates + real data.

---

### 3. **Session Context Memory** (`session_context.py`)

Conversational context management for multi-turn conversations:

```python
from nlp.session_context import (
    get_user_session,
    add_to_session,
    get_previous_intent,
)

# User session created per user
session = get_user_session("user_123", city_id=1)

# Query 1: "Next bus to Gandhipuram"
add_to_session("user_123", query1, "next_bus", entities1)

# Query 2: "What is the bus number?"
# System knows from context that we're talking about that bus!
add_to_session("user_123", query2, "bus_status", entities2)

# Retrieve context
previous_intent = get_previous_intent("user_123")  # "next_bus"
```

**Features:**

- Per-user conversation history (10 queries max)
- Entity history tracking
- Intent correlation detection
- Session expiry (30 min TTL)
- Global session manager with cleanup

---

### 4. **Query Builder Module** (`query_builder.py`)

Structured database querying builder:

```python
from nlp.query_builder import QueryBuilder

qb = QueryBuilder(db, city_id=1)

# Get bus count
count = qb.get_bus_count()

# Find next bus to destination
result = qb.find_next_bus(
    destination="Gandhipuram",
    user_lat=11.0168,
    user_lng=76.9558
)
# Returns: {
#     "bus_number": "21A",
#     "eta_minutes": 5.2,
#     "destination": "Gandhipuram",
#     "next_stop": "Race Course"
# }

# Find nearest stop
nearest = qb.find_nearest_stop(11.0168, 76.9558)

# Find route with path
route = qb.find_route_with_path(origin_id=1, destination_id=5)

# Get bus status
status = qb.get_bus_status(bus_id=1)

# Get city info
city = qb.get_city_info()
```

---

### 5. **Enhanced Voice API** (`voice_api.py`)

Completely rewritten `/voice-query` endpoint:

```
User Query
   ↓
/voice-query endpoint
   ↓
1. Intent Detection (DistilBERT)
   ↓
2. Entity Extraction (fuzzy matching)
   ↓
3. Entity Resolution (database IDs)
   ↓
4. QueryBuilder (structured database queries)
   ↓
5. Dynamic Response Generation (templates + data)
   ↓
6. Session Tracking (conversation history)
   ↓
Response
```

**Supports 6 intent types:**

- `greeting` - Greet user with active bus count
- `next_bus` - Find next bus to destination
- `find_route` - Path between two stops (Dijkstra)
- `bus_status` - Current location of specific bus
- `nearest_stop` - Closest stop to user location
- `buses_running` - Count of active buses
- `unknown` - Helpful fallback

---

## 🔄 Complete Example Flow

### User says: "Next bus to Gandhipuram"

```
1️⃣  Speech Transcription
   Input: Audio → Whisper → "next bus to gandhipuram"

2️⃣  Intent Detection
   DistilBERT: "next_bus" (confidence: 0.95)

3️⃣  Entity Extraction
   Regex + Fuzzy Match: destination="Gandhipuram"

4️⃣  Entity Resolution
   DB Query: destination_id=15

5️⃣  Database Query (QueryBuilder)
   SELECT buses ON route TO Gandhipuram
   Calculate distance + ETA
   Result: {bus_number: "21A", eta_minutes: 5.2, ...}

6️⃣  Response Generation
   Template: "Bus {bus_number} to {destination} in {eta_minutes}min"
   + Data: bus_number="21A", destination="Gandhipuram", eta_minutes=5.2
   Output: "Bus 21A heading to Gandhipuram will arrive in about 5 minutes."

7️⃣  Session Storage
   user_123 → [query="next bus to gandhipuram", intent="next_bus", ...]

8️⃣  Speech Synthesis
   Browser SpeechSynthesis API plays the response

✅ Everything is dynamic, context-aware, and user-specific!
```

---

## 🚀 Testing the Pipeline

### Test 1: Intent Detection

```bash
cd /home/shriram-dev/Documents/college_projects/bus_tracker
source bustracker_backend/venv/bin/activate
python bustracker_backend/test_nlp_pipeline.py
```

### Test 2: Via API

```bash
# Start backend
uvicorn bustracker_backend.main:app --reload

# In another terminal, test voice query
curl -X POST http://localhost:8000/voice-query \
  -H "Content-Type: application/json" \
  -d '{
    "query": "next bus to gandhipuram",
    "city_id": 1,
    "user_lat": 11.0168,
    "user_lng": 76.9558,
    "user_id": "user_123"
  }'

# Returns:
# {
#   "intent": "next_bus",
#   "entities": {
#     "destination": "Gandhipuram",
#     "bus_number": "21A",
#     "eta_minutes": "5.2"
#   },
#   "message": "Bus 21A heading to Gandhipuram will arrive in about 5 minutes."
# }
```

### Test 3: Frontend Integration

```bash
cd bus_frontend
npm run dev

# Open http://localhost:5173
# Microphone auto-starts
# Say: "Next bus to Gandhipuram"
# Watch the magic happen! 🎤✨
```

---

## 📊 Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                      VOICE ASSISTANT SYSTEM                      │
└─────────────────────────────────────────────────────────────────┘

┌─ Frontend ────────────────────────────────────────────────────────┐
│  voice-assistant.tsx                                              │
│  ├─ Audio Capture (MediaRecorder)                                │
│  ├─ Frequency Visualization                                       │
│  ├─ Automatic Startup & Listening Loop                           │
│  └─ User Location (Geolocation API)                              │
└──────────────────────────────────────────────────────────────────┘
                              ↓
                    POST /transcribe-audio
                              ↓
┌─ Backend (NLP Pipeline) ──────────────────────────────────────────┐
│                                                                    │
│  ┌─ whisper_transcriber.py ──────────────────────────────────┐   │
│  │ Audio File → Whisper Model (int8 CPU) → Text             │   │
│  └───────────────────────────────────────────────────────────┘   │
│                              ↓                                    │
│  ┌─ intent_model.py ─────────────────────────────────────────┐   │
│  │ Text → DistilBERT Classification → Intent + Confidence   │   │
│  │ Intents: next_bus, find_route, bus_status, nearest_stop  │   │
│  └───────────────────────────────────────────────────────────┘   │
│                              ↓                                    │
│  ┌─ entity_extractor.py ─────────────────────────────────────┐   │
│  │ Text + DB → Fuzzy Matching → Entities with IDs           │   │
│  │ Bus #, Origin, Destination, Stop Name, City              │   │
│  └───────────────────────────────────────────────────────────┘   │
│                              ↓                                    │
│  ┌─ session_context.py ──────────────────────────────────────┐   │
│  │ User ID + Intent + Entities → Context Storage            │   │
│  │ History: [Query 1, Query 2, ...] (max 10)                │   │
│  └───────────────────────────────────────────────────────────┘   │
│                              ↓                                    │
│  ┌─ query_builder.py ────────────────────────────────────────┐   │
│  │ Entities + Intent → Structured DB Query                  │   │
│  │ ├─ Find bus by number                                     │   │
│  │ ├─ Find next bus to destination (with ETA)               │   │
│  │ ├─ Find nearest stop (haversine)                          │   │
│  │ ├─ Find route path (Dijkstra)                            │   │
│  │ ├─ Get bus status (current location)                      │   │
│  │ └─ Get city info (counts)                                 │   │
│  └───────────────────────────────────────────────────────────┘   │
│                              ↓                                    │
│  ┌─ response_generator.py ───────────────────────────────────┐   │
│  │ Intent + Data → Dynamic Response (Templates + Data)       │   │
│  │ NO HARDCODING! All responses generated from templates.    │   │
│  │ ├─ Greeting: "Hello! There are {count} buses..."         │   │
│  │ ├─ Next Bus: "Bus {num} to {dest} in {eta} minutes"      │   │
│  │ ├─ Route: "{stops} route is {dist} km..."                │   │
│  │ ├─ Stop: "Nearest is {stop}, {dist} km..."               │   │
│  │ └─ Status: "Bus {num} is at {location}..."               │   │
│  └───────────────────────────────────────────────────────────┘   │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
                              ↓
                    Response + Intent + Entities
                              ↓
┌─ Frontend ────────────────────────────────────────────────────────┐
│  ├─ Display Transcript                                            │
│  ├─ Speech Synthesis (TTS)                                        │
│  ├─ Resume Listening (auto-loop)                                 │
│  └─ Frequency Visualization Update                               │
└──────────────────────────────────────────────────────────────────┘
```

---

## 🔧 Configuration & Customization

### Add a New Intent Type

1. **intent_model.py** - Add to `INTENT_LABELS`
2. **entity_extractor.py** - Add entity extraction logic
3. **response_generator.py** - Add response templates
4. **query_builder.py** - Add database query method
5. **voice_api.py** - Add intent handler

### Customize Response Templates

Edit `response_generator.py`:

```python
self.templates = {
    "next_bus": [
        "Bus {bus_number} to {destination} arrives in {eta_minutes} minutes.",
        "You can catch {bus_number} at {next_stop}, arriving in {eta_minutes}.",
        # Add more variations!
    ],
}
```

### Adjust Fuzzy Matching Threshold

In `entity_extractor.py`:

```python
# Lower = more lenient (catches typos better)
# Higher = more strict (fewer false matches)
fuzzy_match_stop("gandhipuram", stops, threshold=60)  # Default
```

---

## 📝 Files Modified/Created

| File                        | Type      | Purpose                           |
| --------------------------- | --------- | --------------------------------- |
| `nlp/entity_extractor.py`   | NEW       | Fuzzy matching entity extraction  |
| `nlp/response_generator.py` | NEW       | Dynamic response generation       |
| `nlp/session_context.py`    | NEW       | Conversation memory               |
| `nlp/query_builder.py`      | NEW       | Structured database queries       |
| `routes/voice_api.py`       | MODIFIED  | Complete NLP pipeline integration |
| `schemas.py`                | MODIFIED  | Added user_id field               |
| `voice-assistant.tsx`       | MODIFIED  | Added user_id + location tracking |
| `requirements.txt`          | ✓ UPDATED | All dependencies included         |

---

## 🎓 Key Principles

1. **Zero Hardcoding** - All responses generated dynamically
2. **Context Aware** - Conversation history per user
3. **Fuzzy Matching** - Typos don't break the system
4. **Intent-Driven** - Clear intent detection enables smart responses
5. **Database-Backed** - All data comes from DB, not config files
6. **Template-Based** - Easy to customize responses
7. **Extensible** - Add new intents/entities easily

---

## 🚀 Next Steps

1. ✅ Install dependencies: `pip install -r requirements.txt`
2. ✅ Start MySQL: `sudo service mysql start`
3. ✅ Run migrations: `python seed_db.py`
4. ✅ Start backend: `uvicorn main:app --reload`
5. ✅ Start frontend: `npm run dev`
6. ✅ Open browser: `http://localhost:5173`
7. ✅ Speak naturally and watch the magic happen!

The entire voice assistant system is now intelligent, context-aware, and completely free of hardcoded responses! 🎉
