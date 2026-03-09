import { useEffect, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  useMap,
  useMapEvents,
  Circle,
} from "react-leaflet";
import L from "leaflet";
import type { Bus, Route } from "../lib/types";
import { useBusContext } from "../lib/bus-context";

// Create a custom bus icon using a div icon
function createBusIcon(color: string, status: string) {
  const isRunning = status === "running";
  const glow = isRunning ? `0 0 20px 4px ${color}80` : "none";
  return L.divIcon({
    className: "custom-bus-icon bg-transparent border-0",
    html: `<div style="
      width: 36px;
      height: 36px;
      background: ${isRunning ? color : "#475569"};
      border: 3px solid #0B0F19;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: ${glow}, 0 4px 12px rgba(0,0,0,0.5);
      font-size: 16px;
      color: white;
      transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
    ">
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6v6"/><path d="M15 6v6"/><path d="M2 12h19.6"/><path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3"/><circle cx="7" cy="18" r="2"/><path d="M9 18h5"/><circle cx="16" cy="18" r="2"/></svg>
    </div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -20],
  });
}

// User location icon (human/person icon)
const userIcon = L.divIcon({
  className: "custom-user-icon bg-transparent border-0",
  html: `<div style="
    width: 36px;
    height: 36px;
    background: linear-gradient(135deg, #0ea5e9 0%, #06b6d4 100%);
    border: 3px solid #0B0F19;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 0 15px rgba(6, 182, 212, 0.6), 0 4px 12px rgba(0,0,0,0.5);
    font-size: 16px;
    color: white;
  ">
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="white" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
  </div>`,
  iconSize: [36, 36],
  iconAnchor: [18, 18],
  popupAnchor: [0, -20],
});

// Stop icon (solid dot with border)
const stopIcon = L.divIcon({
  className: "custom-stop-icon bg-transparent border-0",
  html: `<div style="
    width: 16px;
    height: 16px;
    background: #0B0F19;
    border: 3px solid #64748b;
    border-radius: 50%;
    box-shadow: 0 2px 8px rgba(0,0,0,0.5);
  "></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
  popupAnchor: [0, -10],
});

// Start point icon (Green map pin)
const startIcon = L.divIcon({
  className: "custom-start-icon bg-transparent border-0",
  html: `<div style="
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    filter: drop-shadow(0 0 8px rgba(16,185,129,0.5));
    color: #10b981;
  ">
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="currentColor" stroke="#0B0F19" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3" fill="#0B0F19"/></svg>
  </div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 30],
  popupAnchor: [0, -30],
});

// Destination point icon (Red location target with flag)
const destIcon = L.divIcon({
  className: "custom-dest-icon bg-transparent border-0",
  html: `<div style="
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    filter: drop-shadow(0 0 12px rgba(239,68,68,0.6));
    position: relative;
  ">
    <div style="
      position: absolute;
      width: 24px;
      height: 24px;
      background: radial-gradient(circle at 30% 30%, #ff5555, #ef4444);
      border: 3px solid #fff;
      border-radius: 50%;
      box-shadow: 0 0 0 2px rgba(239,68,68,0.3);
    "></div>
    <div style="
      position: absolute;
      width: 6px;
      height: 6px;
      background: #fff;
      border-radius: 50%;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
    "></div>
  </div>`,
  iconSize: [40, 40],
  iconAnchor: [20, 20],
  popupAnchor: [0, -30],
});

// Auto-fit map to show all markers
function FitBounds({
  buses,
  routes,
  userLocation,
}: {
  buses: Bus[];
  routes: Route[];
  userLocation: { lat: number; lng: number } | null;
}) {
  const map = useMap();
  const { busLocations } = useBusContext();

  useEffect(() => {
    const allPoints: [number, number][] = [];
    buses.forEach((b) => {
      const loc = busLocations.find((l) => l.busId === b.id);
      if (loc) allPoints.push([loc.lat, loc.lng]);
    });
    routes.forEach((r) =>
      r.stops.forEach((s) => allPoints.push([s.lat, s.lng]))
    );
    if (userLocation) {
      allPoints.push([userLocation.lat, userLocation.lng]);
    }
    if (allPoints.length > 0) {
      map.fitBounds(allPoints, { padding: [40, 40], maxZoom: 14 });
    }
  }, []);
  return null;
}

// Component to handle map clicks
function MapClickHandler({ onMapClick }: { onMapClick?: (lat: number, lng: number) => void }) {
  useMapEvents({
    click: (e) => {
      onMapClick?.(e.latlng.lat, e.latlng.lng);
    }
  });
  return null;
}

interface BusMapProps {
  buses: Bus[];
  routes: Route[];
  selectedRouteId?: string | null;
  className?: string;
  onMapClick?: (lat: number, lng: number) => void;
  clickMarker?: { lat: number, lng: number } | null;
  draftStops?: Array<{ lat: number; lng: number; name: string }>;
}

export function BusMap({
  buses,
  routes,
  selectedRouteId,
  className = "h-full w-full",
  onMapClick,
  clickMarker,
  draftStops = [],
}: BusMapProps) {
  const { busLocations } = useBusContext();
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  // Detect user location on mount
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          console.log("Geolocation error:", error);
          // Fallback to Coimbatore area
          setUserLocation({ lat: 11.0168, lng: 76.9558 });
        }
      );
    }
  }, []);

  const filteredRoutes = selectedRouteId
    ? routes.filter((r) => r.id === selectedRouteId)
    : routes;
  const filteredBuses = selectedRouteId
    ? buses.filter((b) => b.routeId === selectedRouteId)
    : buses;

  const routeColorMap = new Map(routes.map((r) => [r.id, r.color]));

  return (
    <MapContainer
      center={[11.0168, 76.9558]}
      zoom={13}
      className={className}
      style={{ zIndex: 0 }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
      />
      <FitBounds buses={filteredBuses} routes={filteredRoutes} userLocation={userLocation} />
      <MapClickHandler onMapClick={onMapClick} />

      {/* User Location Marker */}
      {userLocation && (
        <>
          <Circle
            center={[userLocation.lat, userLocation.lng]}
            radius={500}
            pathOptions={{ color: "#06b6d4", fillColor: "#06b6d4", fillOpacity: 0.1, weight: 2 }}
          />
          <Marker position={[userLocation.lat, userLocation.lng]} icon={userIcon}>
            <Popup className="premium-popup">
              <div className="text-sm min-w-[180px] px-2 py-1">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2.5 h-2.5 rounded-full bg-cyan-400"></div>
                  <p className="!m-0 text-slate-100 font-semibold">Your Location</p>
                </div>
                <p className="!m-0 text-slate-400 text-xs mt-1 font-mono">
                  {userLocation.lat.toFixed(4)}, {userLocation.lng.toFixed(4)}
                </p>
              </div>
            </Popup>
          </Marker>
        </>
      )}

      {/* Temporary click marker */}
      {clickMarker && (
        <Marker position={[clickMarker.lat, clickMarker.lng]}>
          <Popup className="premium-popup">
            <div className="text-sm px-2 py-1">
              <p className="!m-0 text-slate-100 font-semibold">Selected Location</p>
              <p className="!m-0 text-slate-400 text-xs mt-1 font-mono">
                {clickMarker.lat.toFixed(4)}, {clickMarker.lng.toFixed(4)}
              </p>
            </div>
          </Popup>
        </Marker>
      )}

      {/* Draft Route Path & Markers */}
      {draftStops.length > 1 && (
        <Polyline
          positions={draftStops.map((s) => [s.lat, s.lng])}
          pathOptions={{
            color: "#6366f1",
            weight: 5,
            opacity: 0.9,
            className: "route-draft-polyline"
          }}
        />
      )}
      {draftStops.map((stop, i) => {
        const isStart = i === 0;
        const isDest = i === draftStops.length - 1;
        const icon = isStart ? startIcon : isDest ? destIcon : stopIcon;
        return (
          <Marker key={`draft-${i}`} position={[stop.lat, stop.lng]} icon={icon}>
            <Popup className="premium-popup">
              <div className="text-sm px-2 py-1">
                <p className="!m-0 font-semibold" style={{ color: isStart ? "#10b981" : isDest ? "#ef4444" : "#64748b" }}>
                  {stop.name || (isStart ? "Start Point" : isDest ? "Destination" : `Stop ${i}`)}
                </p>
                <p className="!m-0 text-slate-400 text-xs mt-1">Draft Stop</p>
              </div>
            </Popup>
          </Marker>
        );
      })}

      {/* Route polylines */}
      {filteredRoutes.map((route) => (
        <Polyline
          key={route.id}
          positions={route.stops.map((s) => [s.lat, s.lng])}
          pathOptions={{
            color: route.color,
            weight: 5,
            opacity: 0.85,
            lineCap: "round",
            lineJoin: "round"
          }}
        />
      ))}

      {/* Stop markers */}
      {filteredRoutes.map((route) =>
        route.stops.map((stop, i) => {
          const isStart = i === 0;
          const isDest = i === route.stops.length - 1;
          const icon = isStart ? startIcon : isDest ? destIcon : stopIcon;
          return (
            <Marker key={stop.id} position={[stop.lat, stop.lng]} icon={icon}>
              <Popup className="premium-popup">
                <div className="text-sm px-2 py-1">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: route.color }}></div>
                    <p className="!m-0 text-slate-100 font-semibold">{stop.name}</p>
                  </div>
                  <p className="!m-0 text-slate-400 text-xs mt-1">
                    {isStart ? "🟢 Start" : isDest ? "🔴 Destination" : "⚪ Stop"} • {route.name}
                  </p>
                  <p className="!m-0 text-slate-500 text-xs mt-2 font-mono opacity-70">
                    Lat: {stop.lat.toFixed(5)} | Lng: {stop.lng.toFixed(5)}
                  </p>
                </div>
              </Popup>
            </Marker>
          );
        })
      )}

      {/* Bus markers */}
      {filteredBuses.map((bus) => {
        const loc = busLocations.find((l) => l.busId === bus.id);
        const color = routeColorMap.get(bus.routeId) || "#3B82F6";

        if (!loc) return null;

        return (
          <Marker
            key={bus.id}
            position={[loc.lat, loc.lng]}
            icon={createBusIcon(color, bus.status)}
          >
            <Popup className="premium-popup bus-popup">
              <div className="text-sm min-w-[200px] px-2 py-1">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-3 h-3 rounded-full animate-pulse" style={{ backgroundColor: color }}></div>
                  <p className="!m-0 text-slate-100 font-semibold text-base">{bus.name}</p>
                </div>
                <div className="flex items-center gap-1 mb-3 text-slate-400 text-xs">
                  <span>🚌</span>
                  <span className="uppercase tracking-wider">Active Bus</span>
                  {bus.status === "running" && <span className="ml-auto text-emerald-400">● Running</span>}
                </div>
                <div className="border-t border-white/10 pt-2 flex justify-between items-center">
                  <span className="text-slate-400 text-xs uppercase tracking-wider">Arrival Time</span>
                  <span className="text-cyan-400 font-bold tracking-tight">{loc.eta} min</span>
                </div>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
