import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import type { Bus, Route, BusLocation, Stop } from "./types";

interface BusContextType {
  buses: Bus[];
  routes: Route[];
  busLocations: BusLocation[];
  setBuses: React.Dispatch<React.SetStateAction<Bus[]>>;
  setRoutes: React.Dispatch<React.SetStateAction<Route[]>>;
  addRoute: (route: Route) => Promise<void>;
  addBus: (bus: Bus) => Promise<void>;
  toggleBusStatus: (busId: string) => void;
  deleteBus: (busId: string) => void;
  deleteRoute: (routeId: string) => void;
}

const BusContext = createContext<BusContextType | null>(null);

const API_BASE = "http://localhost:8000";

// Predefined colors for routes
const ROUTE_COLORS = [
  "#ef4444", "#f97316", "#f59e0b", "#84cc16", "#22c55e",
  "#14b8a6", "#06b6d4", "#0ea5e9", "#3b82f6", "#6366f1",
  "#8b5cf6", "#a855f7", "#d946ef", "#ec4899", "#f43f5e"
];

export function BusProvider({ children }: { children: React.ReactNode }) {
  const [buses, setBuses] = useState<Bus[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [busLocations, setBusLocations] = useState<BusLocation[]>([]);

  const fetchInitialData = useCallback(async () => {
    try {
      // Fetch routes
      const routesRes = await fetch(`${API_BASE}/routes`);
      if (!routesRes.ok) throw new Error(`Failed to fetch routes: ${routesRes.statusText}`);
      const routesData = await routesRes.json();

      const mappedRoutes: Route[] = routesData.map((r: any, idx: number) => {
        // Ensure stops array exists and is properly mapped
        const mappedStops = (r.stops || []).map((s: any) => ({
          id: s.id?.toString() || `stop-${s.stop_name}`,
          route_id: s.route_id?.toString() || r.id?.toString(),
          name: s.stop_name,
          lat: s.latitude,
          lng: s.longitude,
          order: s.stop_order
        }));

        return {
          id: r.id.toString(),
          name: `${r.start_location} → ${r.end_location}`,
          color: ROUTE_COLORS[idx % ROUTE_COLORS.length],
          stops: mappedStops
        };
      });
      setRoutes(mappedRoutes);

      // Fetch buses
      const busesRes = await fetch(`${API_BASE}/buses`);
      if (!busesRes.ok) throw new Error(`Failed to fetch buses: ${busesRes.statusText}`);
      const busesData = await busesRes.json();
      const mappedBuses: Bus[] = busesData.map((b: any) => ({
        id: b.id.toString(),
        name: b.bus_number,
        routeId: b.route_id.toString(),
        speed: b.average_speed_kmph,
        status: "running"
      }));
      setBuses(mappedBuses);

    } catch (err) {
      console.error("Failed to fetch backend data:", err);
    }
  }, []);

  const fetchLocations = useCallback(async () => {
    try {
      const locRes = await fetch(`${API_BASE}/bus-locations`);
      const locData = await locRes.json();
      const mappedLocs: BusLocation[] = locData.map((l: any) => ({
        busId: l.bus_id.toString(),
        busName: l.bus_number,
        lat: l.lat,
        lng: l.lng,
        eta: l.eta_minutes
      }));
      setBusLocations(mappedLocs);
    } catch (err) {
      console.error("Failed to fetch live locations:", err);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  // Polling loop for live locations (every 3 seconds)
  useEffect(() => {
    fetchLocations(); // initial fetch
    const interval = setInterval(() => {
      fetchLocations();
    }, 3000);
    return () => clearInterval(interval);
  }, [fetchLocations]);

  const addRoute = useCallback(async (route: Route) => {
    try {
      let start_location = "";
      let end_location = "";

      if (route.name.includes(" → ")) {
        [start_location, end_location] = route.name.split(" → ");
      } else {
        start_location = route.stops[0]?.name || route.name;
        end_location = route.stops[route.stops.length - 1]?.name || "Unknown";
      }

      // 1. Create Route
      const resRoute = await fetch(`${API_BASE}/admin/add-route`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          start_location: start_location,
          end_location: end_location
        }),
      });
      
      if (!resRoute.ok) {
        throw new Error(`Failed to create route: ${resRoute.statusText}`);
      }
      
      const createdRoute = await resRoute.json();

      // 2. Add Stops for this Route
      for (const stop of route.stops) {
        const resStop = await fetch(`${API_BASE}/admin/add-stop`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            route_id: Number(createdRoute.id),
            stop_name: stop.name,
            latitude: stop.lat,
            longitude: stop.lng,
            stop_order: stop.order // already 1-based from UI
          }),
        });
        
        if (!resStop.ok) {
          const text = await resStop.text();
          console.error(`Failed to add stop (${resStop.status}): ${text}`);
          // continue to attempt remaining stops
        }
      }

      // Wait a moment then refresh
      await new Promise((r) => setTimeout(r, 300));
      await fetchInitialData();
      return createdRoute;
    } catch (err) {
      console.error("Failed to add route via API", err);
      throw err;
    }
  }, [fetchInitialData]);

  const addBus = useCallback(async (bus: Bus) => {
    try {
      await fetch(`${API_BASE}/admin/add-bus`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bus_number: bus.name,
          route_id: parseInt(bus.routeId),
          average_speed_kmph: bus.speed
        }),
      });

      // Refresh all data
      await fetchInitialData();
    } catch (err) {
      console.error("Failed to add bus via API", err);
    }
  }, [fetchInitialData]);

  // Status and deletions remain strictly local to demo UI state
  const toggleBusStatus = useCallback((busId: string) => {
    setBuses((prev) =>
      prev.map((b) =>
        b.id === busId
          ? { ...b, status: b.status === "running" ? "stopped" : "running" }
          : b
      )
    );
  }, []);

  const deleteBus = useCallback(async (busId: string) => {
    try {
      const response = await fetch(`${API_BASE}/admin/delete-bus/${busId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });
      if (response.ok) {
        setBuses((prev) => prev.filter((b) => b.id !== busId));
      } else {
        console.error("Failed to delete bus:", response.statusText);
      }
    } catch (err) {
      console.error("Failed to delete bus via API", err);
    }
  }, []);

  const deleteRoute = useCallback(async (routeId: string) => {
    try {
      const response = await fetch(`${API_BASE}/admin/delete-route/${routeId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });
      if (response.ok) {
        setRoutes((prev) => prev.filter((r) => r.id !== routeId));
        setBuses((prev) => prev.filter((b) => b.routeId !== routeId));
      } else {
        console.error("Failed to delete route:", response.statusText);
      }
    } catch (err) {
      console.error("Failed to delete route via API", err);
    }
  }, []);

  return (
    <BusContext.Provider
      value={{
        buses,
        routes,
        busLocations,
        setBuses,
        setRoutes,
        addRoute,
        addBus,
        toggleBusStatus,
        deleteBus,
        deleteRoute,
      }}
    >
      {children}
    </BusContext.Provider>
  );
}

export function useBusContext() {
  const ctx = useContext(BusContext);
  if (!ctx) throw new Error("useBusContext must be used within BusProvider");
  return ctx;
}
