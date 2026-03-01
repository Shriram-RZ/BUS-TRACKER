🧠 PROMPT START

Build a production-grade, accessibility-first Real-Time Bus Tracking Web Application with simulation.

🧰 TECH STACK

Frontend:

Next.js 14 (App Router)

Tailwind CSS (modern UI)

React Leaflet

Web Speech API

Backend:

Python FastAPI

SQLAlchemy

MySQL

Async background tasks

Map:

Leaflet.js

OpenStreetMap tiles

🎯 PURPOSE

Create a modern, clean, minimal bus tracking system designed for:

1️⃣ Blind users (voice interaction)
2️⃣ Deaf & mute users (visual interaction)
3️⃣ Admin panel (manage buses & routes)

The system must simulate real-time moving buses.

📦 COMPLETE FOLDER SETUP COMMANDS
1️⃣ Backend Setup
mkdir bus-backend
cd bus-backend
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install fastapi uvicorn sqlalchemy pymysql python-dotenv asyncio

Create structure:

touch main.py database.py models.py simulation.py routes.py utils.py
2️⃣ Frontend Setup
npx create-next-app@latest bus-frontend
cd bus-frontend
npm install react-leaflet leaflet axios
npm install -D tailwindcss postcss autoprefixer

Enable Tailwind.

Create folders:

/app/blind
/app/deaf
/app/admin
/components
/lib
🗄️ DATABASE SCHEMA

Create MySQL tables:

buses

routes

stops

bus_locations

Each stop must store:

latitude

longitude

stop_order

🧮 HAVERSINE FORMULA (Distance Calculation)

In utils.py implement:

import math

def haversine(lat1, lon1, lat2, lon2):
    R = 6371  # Earth radius in km
    
    dLat = math.radians(lat2 - lat1)
    dLon = math.radians(lon2 - lon1)
    
    a = (math.sin(dLat/2) ** 2 +
         math.cos(math.radians(lat1)) *
         math.cos(math.radians(lat2)) *
         math.sin(dLon/2) ** 2)
    
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    
    return R * c

Use this to:

Calculate bus → next stop distance

Estimate ETA

ETA formula:

eta_minutes = (distance_km / average_speed_kmph) * 60

Return ETA in rounded minutes.

🔁 BUS MOVEMENT INTERPOLATION LOGIC

In simulation.py:

Fetch ordered stops of route

Move bus from stop A → stop B

Use linear interpolation

Example:

def interpolate(start_lat, start_lng, end_lat, end_lng, steps):
    lat_step = (end_lat - start_lat) / steps
    lng_step = (end_lng - start_lng) / steps
    
    for i in range(steps):
        yield (
            start_lat + lat_step * i,
            start_lng + lng_step * i
        )

Simulation loop:

async def simulate_bus(bus_id, stops):
    while True:
        for i in range(len(stops) - 1):
            start = stops[i]
            end = stops[i+1]
            
            for lat, lng in interpolate(
                start.lat, start.lng,
                end.lat, end.lng,
                steps=20
            ):
                update_bus_location(bus_id, lat, lng)
                await asyncio.sleep(3)

This makes bus move smoothly every 3 seconds.

🗺️ LEAFLET SMOOTH ANIMATION (Frontend)

Install leaflet CSS in layout.

In /deaf page:

"use client"
import { MapContainer, TileLayer, Marker, Polyline } from "react-leaflet"
import L from "leaflet"
import { useEffect, useState } from "react"
import axios from "axios"

const busIcon = new L.Icon({
  iconUrl: "/bus-icon.png",
  iconSize: [40, 40]
})

export default function DeafPage() {
  const [buses, setBuses] = useState([])

  useEffect(() => {
    const fetchData = async () => {
      const res = await axios.get("http://localhost:8000/bus-locations")
      setBuses(res.data)
    }

    fetchData()
    const interval = setInterval(fetchData, 3000)

    return () => clearInterval(interval)
  }, [])

  return (
    <MapContainer center={[10.65, 77.01]} zoom={13} className="h-screen w-full">
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {buses.map(bus => (
        <Marker
          key={bus.bus_id}
          position={[bus.lat, bus.lng]}
          icon={busIcon}
        />
      ))}
    </MapContainer>
  )
}

Smooth movement occurs because backend gradually updates coordinates.

🎤 BLIND MODE (VOICE LOGIC)

In /blind page:

const recognition = new window.webkitSpeechRecognition()
recognition.lang = "en-IN"
recognition.start()

recognition.onresult = async (event) => {
  const transcript = event.results[0][0].transcript
  
  const res = await fetch("/api/search", {
    method: "POST",
    body: JSON.stringify({ query: transcript })
  })
  
  const data = await res.json()
  
  const speech = new SpeechSynthesisUtterance(data.message)
  window.speechSynthesis.speak(speech)
}

UI Requirements:

Large microphone button

Dark theme

High contrast text

Large typography

🎨 MODERN UI DESIGN RULES

Use Tailwind:

Glassmorphism cards

Soft shadows

Rounded-2xl containers

Smooth transitions

Accessible contrast

Large buttons for blind mode

Clean dashboard for admin

Design inspiration:

4
🧏 DEAF MODE UI

Route selection dropdown

Real-time ETA display

Distance indicator

Live map

Large readable typography

🛠️ ADMIN PANEL

Features:

Add routes

Add stops with lat/lng

Add bus with speed

Simple dashboard layout

🚀 FINAL SYSTEM MUST:

Simulate real-time moving buses

Calculate ETA using Haversine

Animate bus smoothly on Leaflet map

Support blind users via voice

Support deaf users visually

Have modern UI

Be production structured

Generate complete frontend + backend starter code with comments.

🧠 PROMPT END