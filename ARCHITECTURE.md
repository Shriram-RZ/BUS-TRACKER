# BusTracker - Architecture & Design Patterns

## 🏗️ Architectural Overview

BusTracker follows a **layered architecture** with clear separation of concerns:

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (React/TypeScript)             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │  Pages       │  │  Components  │  │  lib (utils)     │  │
│  │ (Routes)     │  │  (UI)        │  │ (BusContext)     │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
│                            ↑                                  │
├─────────────────────────────────────────────────────────────┤
│                    HTTP/REST API Layer                       │
│            (localhost:8000)                                  │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                  Backend (Python/FastAPI)                   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ API Routes (routes_api, admin_api, voice_api)       │   │
│  └──────────────────────────────────────────────────────┘   │
│               ↓              ↓              ↓                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Business     │  │ ML/NLP       │  │ Utilities    │      │
│  │ Logic        │  │ (intent,ETA) │  │ (geo_utils)  │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│               ↓              ↓              ↓                │
│  ┌──────────────────────────────────────────────────────┐   │
│  │          Data Access Layer (SQLAlchemy ORM)         │   │
│  └──────────────────────────────────────────────────────┘   │
│               ↓              ↓                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Cache Layer (Optional Redis)                         │   │
│  └──────────────────────────────────────────────────────┘   │
│               ↓              ↓                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Persistence Layer (MySQL)                            │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎯 Design Patterns Used

### 1. **Provider Pattern** (Frontend)

**Location:** `lib/bus-context.tsx`

**Purpose:** Global state management without Redux

```typescript
// Creation
<BusProvider>
  <App />
</BusProvider>

// Usage anywhere
const { buses, routes } = useBusContext();
```

**Benefits:**

- Simple, built-in React API
- No external dependencies
- Scoped to provider boundaries
- Type-safe with TypeScript

---

### 2. **Repository/Data Access Pattern** (Backend)

**Location:** `routes/` directory with dependency injection

**Purpose:** Abstract database queries behind clean interfaces

```python
# Dependency injection
def get_buses(db: Session = Depends(get_db)):
    return db.query(Bus).all()

# Benefits:
# - Easy to test (mock db)
# - Decouples API from database
# - Reusable across endpoints
```

---

### 3. **Singleton Pattern** (Backend)

**Location:** `cache.py`, `ml/eta_model.py`, `nlp/intent_model.py`

**Purpose:** Load expensive resources once

```python
_CLIENT: Optional[redis.Redis] = None

def get_client() -> Optional[redis.Redis]:
    global _CLIENT
    if _CLIENT is None:
        _CLIENT = redis.from_url(url)
    return _CLIENT
```

**Benefits:**

- ML models loaded once (expensive!)
- Redis connection pooled
- Lazy initialization

---

### 4. **Strategy Pattern** (Backend)

**Location:** `routes/routes_api.py` - ETA calculation

**Purpose:** Switch between different algorithms at runtime

```python
# Strategy 1: ML prediction
eta = predict_eta(features)

# Strategy 2: Simple formula (fallback)
eta = calculate_eta(distance, speed)
```

**Benefits:**

- Graceful degradation
- No configuration needed
- Easy to add new strategies

---

### 5. **Observer Pattern** (Frontend)

**Location:** Polling in `bus-context.tsx`

**Purpose:** Watch for data changes via polling

```typescript
// Poll every 3 seconds
useEffect(() => {
  const interval = setInterval(() => {
    fetchLocations(); // Notify subscribers
  }, 3000);
  return () => clearInterval(interval);
}, []);
```

**Benefits:**

- Real-time updates without WebSockets
- Simple polling mechanism
- Easy to debug state changes

---

### 6. **Factory Pattern** (Frontend)

**Location:** `components/bus-map.tsx`

**Purpose:** Create complex objects (icons)

```typescript
function createBusIcon(color: string, status: string) {
  return L.divIcon({
    html: `<div style="background: ${color}">...</div>`,
    iconSize: [36, 36],
  });
}

// Usage
const icon = createBusIcon("#ff0000", "running");
```

---

### 7. **Adapter Pattern** (Frontend)

**Location:** `lib/bus-context.tsx` - API response mapping

**Purpose:** Transform backend data to frontend types

```typescript
// Backend response
{ id: 1, bus_number: "21A", route_id: 5, ... }

// Adapt to frontend structure
const bus: Bus = {
  id: "1",
  name: "21A",
  routeId: "5",
  ...
};
```

**Benefits:**

- Decouples frontend from backend schema
- Easy to update API without breaking UI
- Type safety at boundaries

---

### 8. **Command Pattern** (Frontend)

**Location:** Form submissions in admin-page.tsx

**Purpose:** Encapsulate actions as objects

```typescript
const handleAddRoute = async () => {
  // Encapsulate entire "add route" operation
  const route = buildRoute(); // Validate
  await addRoute(route); // Execute
  showToast("Route added"); // Feedback
};
```

---

### 9. **Template Method Pattern** (Backend)

**Location:** `simulation/bus_simulator.py`

**Purpose:** Define algorithm skeleton, subclasses fill details

```python
async def _simulate_bus(bus_id, route_id):
    while True:
        # Template structure
        stops = fetch_stops(route_id)              # Step 1
        for i in range(len(stops)):
            start, end = stops[i], stops[i+1]
            for step in range(INTERPOLATION_STEPS):  # Step 2
                lat, lng = interpolate(start, end)
                update_location(bus_id, lat, lng)    # Step 3
            await asyncio.sleep(UPDATE_INTERVAL)     # Step 4
```

---

### 10. **Middleware Pattern** (Backend)

**Location:** `main.py` - CORS middleware

**Purpose:** Process requests/responses globally

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
)
```

**Benefits:**

- Cross-cutting concerns
- Centralized configuration
- Applied to all routes

---

## 🔌 Integration Points

### Backend ↔ Frontend Communication

**Synchronous (REST):**

```
UI Action → Fetch Request → FastAPI Endpoint
     ↓
   Backend Processing (DB query, ML inference, calculations)
     ↓
   JSON Response → State Update → Re-render
```

**Asynchronous (Polling):**

```
Frontend starts interval timer
     ↓ (every 3s)
Fetch /bus-locations
     ↓
Process response (map, filter, adapt)
     ↓
BusContext.setBusLocations()
     ↓
Components re-render with new data
```

---

## 🔐 Data Flow Security

### Input Validation

**Frontend:**

```typescript
// Validate before sending
if (!newRouteName.trim()) {
  showToast("Route name required");
  return;
}
```

**Backend:**

```python
# Pydantic automatic validation
class RouteCreate(BaseModel):
    start_location: str = Field(..., min_length=1)
    end_location: str = Field(..., min_length=1)
```

### SQL Injection Prevention

**SQLAlchemy ORM** (parameterized queries):

```python
# ✅ Safe
db.query(Route).filter(Route.id == route_id)

# ❌ Unsafe
db.execute(f"SELECT * FROM routes WHERE id = {route_id}")
```

---

## 📊 State Management Strategy

### Frontend State Hierarchy

```
BusContext (Global)
├── buses: Bus[]
├── routes: Route[]
├── busLocations: BusLocation[]
├── cities: City[]
├── selectedCityId: string | null
└── setter functions

Component State (Local)
├── HomePage
│  └── isSheetOpen
├── AdminPage
│  ├── showAddRoute
│  ├── newRouteName
│  └── newStops[]
└── BlindPage
   ├── isListening
   └── transcript
```

**Principle:** Global data in context, UI state in components

---

## ⚡ Performance Optimizations

### Frontend

1. **Memoization:** `useCallback` for event handlers

```typescript
const fetchInitialData = useCallback(async () => {
  // Only recreated when dependencies change
}, [selectedCityId]);
```

2. **Lazy Loading:** Components loaded on-demand

```typescript
const HomePage = lazy(() => import("./home-page"));
```

3. **Image Optimization:** Leaflet tile layers cached by browser

### Backend

1. **Connection Pooling:** 10 persistent connections

```python
pool_size=10, max_overflow=20
```

2. **Redis Caching:** Fast read for frequently accessed locations

```python
cached = get_cached_bus_location(city_id, bus_id)
```

3. **Async Tasks:** Non-blocking simulation

```python
asyncio.create_task(_simulate_bus(...))
```

4. **Query Optimization:**

```python
buses = db.query(Bus).filter(...).options(joinedload(Bus.location))
```

---

## 🛠️ Error Handling Strategy

### Frontend Error Handling

**Try-Catch:**

```typescript
try {
  const res = await fetch(`${API_BASE}/routes`);
  if (!res.ok) throw new Error(`Failed: ${res.statusText}`);
  const data = await res.json();
} catch (err) {
  console.error("Failed to fetch routes:", err);
  // Show user-friendly message
}
```

**Voice Error Messages:**

```typescript
if (!SpeechRecognition) {
  const msg = "Speech recognition not supported. Try Chrome.";
  speak(msg); // Speak error to user
}
```

### Backend Error Handling

**HTTP Exceptions:**

```python
if not route:
    raise HTTPException(
        status_code=404,
        detail="Route not found"
    )
```

**Graceful Degradation:**

```python
# Try ML prediction
try:
    eta = predict_eta(features)
except:
    # Fall back to simple calculation
    eta = calculate_eta(distance, speed)
```

**Logging:**

```python
logger.exception("Error in simulation for Bus %s", bus_number)
```

---

## 🧬 Scalability Considerations

### Horizontal Scaling

- **Stateless API:** No session storage in backend
- **External Cache:** Redis shared across servers
- **Database Pooling:** Connection pooling distributes load

### Vertical Scaling

- **Async/Await:** Handles many concurrent connections
- **Connection Pooling:** Efficient resource use
- **Lazy Loading:** Models loaded only when needed

### Future Improvements

1. WebSockets for real-time updates (avoid polling)
2. Message queue (RabbitMQ) for heavy operations
3. Read replicas for database scaling
4. CDN for static assets

---

## 🔄 Update Flow Diagram

```
User interacts with UI
     ↓
Component handler (onClick, onChange, etc.)
     ↓
Validate input (if needed)
     ↓
API call (fetch POST/GET)
     ↓
Backend receives request
     ↓
Parse & validate (Pydantic)
     ↓
Query database (SQLAlchemy)
     ↓
Process data (ML, calculations)
     ↓
Build response
     ↓
Return JSON
     ↓
Frontend receives response
     ↓
Parse JSON
     ↓
Update state (BusContext)
     ↓
Components re-render
     ↓
UI updates (React computes new DOM)
```

---

## 📐 Extension Points

### Adding a New Feature: "Bus Capacity Tracking"

**Backend Steps:**

1. Add column to Bus model

```python
class Bus(Base):
    current_occupancy = Column(Integer, default=0)
    max_capacity = Column(Integer, default=50)
```

2. Add schema

```python
class BusOut(BaseModel):
    current_occupancy: int
    max_capacity: int
```

3. Update API

```python
@router.get("/bus-capacity/{bus_id}")
def get_capacity(bus_id: int, db: Session = Depends(get_db)):
    bus = db.query(Bus).filter(Bus.id == bus_id).first()
    return {"occupancy": bus.current_occupancy, "max": bus.max_capacity}
```

**Frontend Steps:**

1. Update Bus interface

```typescript
interface Bus {
  occupancy: number;
  maxCapacity: number;
}
```

2. Fetch in BusContext

```typescript
const capacityRes = await fetch(`${API_BASE}/bus-capacity/${bus.id}`);
```

3. Display in component

```typescript
<div className="w-full bg-gray-200 rounded-full h-2">
  <div
    className="bg-blue-600 h-2 rounded-full"
    style={{width: `${(bus.occupancy / bus.maxCapacity) * 100}%`}}
  />
</div>
```

---

## 🎓 Learning Resources

### Architecture Principles

- **DRY (Don't Repeat Yourself):** Shared utils, models
- **SOLID:**
  - **S**ingle Responsibility: Routes handle API, models handle data
  - **O**pen/Closed: Extend with new endpoints, don't modify existing
  - **L**iskov Substitution: Strategies (ETA calc) interchangeable
  - **I**nterface Segregation: Specific route handlers, not monolithic
  - **D**ependency Inversion: Depend on abstractions (Session), not concrete

### Design Patterns Used

- Refer to individual patterns section above for specific examples

---

## 🚀 Deployment Checklist

- [ ] Set environment variables (`DATABASE_URL`, `REDIS_URL`, `ETA_MODEL_PATH`)
- [ ] Configure CORS for production domain
- [ ] Enable HTTPS for all API calls
- [ ] Set up database backups
- [ ] Configure logging and monitoring
- [ ] Test all voice features across browsers
- [ ] Verify accessibility (WCAG 2.1 AA+)
- [ ] Load test under expected concurrent users
- [ ] Document API breaking changes
- [ ] Set up CI/CD pipeline

---

## Summary

BusTracker demonstrates **professional software engineering practices**:

✅ **Clean Architecture** - Separated concerns, layered design
✅ **Design Patterns** - Proven solutions to common problems
✅ **Type Safety** - TypeScript + Python type hints
✅ **Error Handling** - Graceful degradation, meaningful messages
✅ **Performance** - Caching, pooling, async operations
✅ **Scalability** - Stateless API, external cache, pooling
✅ **Accessibility** - WCAG compliance, multiple interfaces
✅ **Testability** - Modular code, dependency injection
