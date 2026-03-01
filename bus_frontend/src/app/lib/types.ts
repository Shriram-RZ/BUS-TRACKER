export interface Stop {
  id: string;
  route_id: string;
  name: string;
  lat: number;
  lng: number;
  order: number;
}

export interface Route {
  id: string; // backend returns int, we'll cast to string for uniqueness
  name: string; // mapped from start_location -> end_location
  color: string; // we'll assign a random color on the frontend
  stops: Stop[];
}

export interface Bus {
  id: string;
  name: string; // mapped from bus_number
  routeId: string;
  speed: number;
  status: "running" | "stopped" | "maintenance"; // default to running
}

export interface BusLocation {
  busId: string;
  busName: string;
  lat: number;
  lng: number;
  eta: number; // eta_minutes from backend
}
