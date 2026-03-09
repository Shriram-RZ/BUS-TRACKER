import logging
from typing import Dict, Optional, List, Any, Tuple
from sqlalchemy.orm import Session

from ..models import Bus, BusLocation, Stop, Route, City
from ..utils.geo_utils import haversine, calculate_eta
from ..ml.eta_model import build_feature_vector, predict_eta

logger = logging.getLogger("query_builder")


class QueryBuilder:
    def __init__(self, db: Session, city_id: Optional[int] = None):
        self.db = db
        self.city_id = city_id
    
    def _apply_city_filter(self, query):
        if self.city_id:
            query = query.filter_by(city_id=self.city_id)
        return query
    
    def get_bus_count(self, status: str = "running") -> int:
        """Get count of buses by status."""
        query = self.db.query(Bus)
        query = self._apply_city_filter(query)
        return query.count()
    
    def get_active_buses(self) -> List[Dict[str, Any]]:
        """Get all active buses with their current location."""
        buses = self.db.query(Bus).filter(Bus.city_id == self.city_id).all() if self.city_id else self.db.query(Bus).all()
        
        result = []
        for bus in buses:
            location = self.db.query(BusLocation).filter(BusLocation.bus_id == bus.id).first()
            route = self.db.query(Route).filter(Route.id == bus.route_id).first()
            
            result.append({
                "bus_id": bus.id,
                "bus_number": bus.bus_number,
                "route_id": bus.route_id,
                "route_name": f"{route.start_location} → {route.end_location}" if route else "Unknown",
                "latitude": location.latitude if location else None,
                "longitude": location.longitude if location else None,
            })
        
        return result
    
    def find_bus_by_number(self, bus_number: str) -> Optional[Dict[str, Any]]:
        """Find a bus by its number."""
        bus = self.db.query(Bus).filter(Bus.bus_number.ilike(bus_number)).first()
        if not bus:
            return None
        
        location = self.db.query(BusLocation).filter(BusLocation.bus_id == bus.id).first()
        route = self.db.query(Route).filter(Route.id == bus.route_id).first()
        
        return {
            "bus_id": bus.id,
            "bus_number": bus.bus_number,
            "route": {
                "start": route.start_location if route else None,
                "end": route.end_location if route else None,
            },
            "location": {
                "latitude": location.latitude if location else None,
                "longitude": location.longitude if location else None,
            },
            "average_speed": bus.average_speed_kmph,
        }
    
    def find_next_bus(
        self,
        destination: str,
        user_lat: Optional[float] = None,
        user_lng: Optional[float] = None
    ) -> Optional[Dict[str, Any]]:
        """Find the next bus to a given destination."""
        query = self.db.query(Route).filter(Route.end_location.ilike(f"%{destination}%"))
        query = self._apply_city_filter(query)
        routes = query.all()
        
        if not routes:
            return None
        
        best_eta = float("inf")
        best_result = None
        
        for route in routes:
            bus_query = self.db.query(Bus).filter(Bus.route_id == route.id)
            buses = bus_query.all()
            
            for bus in buses:
                location = self.db.query(BusLocation).filter(BusLocation.bus_id == bus.id).first()
                if not location:
                    continue
                
                stops = self.db.query(Stop).filter(Stop.route_id == route.id).order_by(Stop.stop_order).all()
                if not stops:
                    continue
                
                if user_lat and user_lng:
                    target_stop = min(
                        stops,
                        key=lambda s: haversine(user_lat, user_lng, s.latitude, s.longitude)
                    )
                else:
                    target_stop = min(
                        stops,
                        key=lambda s: haversine(location.latitude, location.longitude, s.latitude, s.longitude)
                    )
                
                distance_km = haversine(
                    location.latitude,
                    location.longitude,
                    target_stop.latitude,
                    target_stop.longitude
                )
                
                features = build_feature_vector(
                    distance_km=distance_km,
                    speed_kmph=bus.average_speed_kmph,
                )
                eta_minutes = predict_eta(features)
                
                if eta_minutes < best_eta:
                    best_eta = eta_minutes
                    best_result = {
                        "bus_number": bus.bus_number,
                        "route_start": route.start_location,
                        "route_end": route.end_location,
                        "destination": destination,
                        "eta_minutes": eta_minutes,
                        "next_stop": target_stop.stop_name,
                    }
        
        return best_result
    
    def find_nearest_stop(self, user_lat: float, user_lng: float) -> Optional[Dict[str, Any]]:
        """Find the nearest stop to a user's location."""
        query = self.db.query(Stop)
        query = self._apply_city_filter(query)
        stops = query.all()
        
        if not stops:
            return None
        
        nearest = None
        best_distance = float("inf")
        
        for stop in stops:
            distance = haversine(user_lat, user_lng, stop.latitude, stop.longitude)
            if distance < best_distance:
                best_distance = distance
                nearest = stop
        
        return {
            "stop_id": nearest.id,
            "stop_name": nearest.stop_name,
            "distance_km": best_distance,
            "latitude": nearest.latitude,
            "longitude": nearest.longitude,
        } if nearest else None
    
    def find_route_with_path(
        self,
        origin_id: int,
        destination_id: int
    ) -> Optional[Dict[str, Any]]:
        """Find route path between two stops."""
        from ..routing.graph import build_graph_for_city, shortest_path
        
        origin_stop = self.db.query(Stop).filter(Stop.id == origin_id).first()
        dest_stop = self.db.query(Stop).filter(Stop.id == destination_id).first()
        
        if not origin_stop or not dest_stop:
            return None
        
        if self.city_id is None:
            self.city_id = origin_stop.city_id
        
        graph = build_graph_for_city(self.db, self.city_id)
        path_ids, total_distance = shortest_path(graph, origin_id, destination_id)
        
        if not path_ids:
            return None
        
        stops_by_id = {
            s.id: s for s in self.db.query(Stop).filter(Stop.id.in_(path_ids)).all()
        }
        
        ordered_stops = [stops_by_id[sid].stop_name for sid in path_ids if sid in stops_by_id]
        
        return {
            "origin": origin_stop.stop_name,
            "destination": dest_stop.stop_name,
            "stops": ordered_stops,
            "distance_km": total_distance,
            "path_ids": path_ids,
        }
    
    def get_bus_status(self, bus_id: int) -> Optional[Dict[str, Any]]:
        """Get current status of a bus."""
        bus = self.db.query(Bus).filter(Bus.id == bus_id).first()
        if not bus:
            return None
        
        location = self.db.query(BusLocation).filter(BusLocation.bus_id == bus.id).first()
        route = self.db.query(Route).filter(Route.id == bus.route_id).first()
        
        stops = self.db.query(Stop).filter(Stop.route_id == bus.route_id).order_by(Stop.stop_order).all()
        
        current_stop = None
        if location and stops:
            current_stop = min(
                stops,
                key=lambda s: haversine(location.latitude, location.longitude, s.latitude, s.longitude)
            )
        
        return {
            "bus_number": bus.bus_number,
            "route": f"{route.start_location} → {route.end_location}" if route else None,
            "current_location": {
                "latitude": location.latitude if location else None,
                "longitude": location.longitude if location else None,
            },
            "current_stop": current_stop.stop_name if current_stop else None,
            "average_speed": bus.average_speed_kmph,
        }
    
    def find_bus_eta_to_stop(
        self,
        bus_number: str,
        destination: str,
    ) -> Optional[Dict[str, Any]]:
        """Find ETA of a specific bus to a specific stop."""
        bus = self.db.query(Bus).filter(Bus.bus_number.ilike(bus_number)).first()
        if not bus:
            return None
        
        location = self.db.query(BusLocation).filter(BusLocation.bus_id == bus.id).first()
        if not location:
            return None
        
        route = self.db.query(Route).filter(Route.id == bus.route_id).first()
        stops = self.db.query(Stop).filter(Stop.route_id == bus.route_id).order_by(Stop.stop_order).all()
        
        if not stops:
            return None
        
        # Find the target stop by fuzzy name match
        from thefuzz import fuzz, process
        stop_names = [s.stop_name for s in stops]
        best_match, score = process.extractOne(destination, stop_names, scorer=fuzz.token_set_ratio)
        
        if score < 50:
            return None
        
        target_stop = next(s for s in stops if s.stop_name == best_match)
        
        # Calculate distance from bus current location to target stop
        distance_km = haversine(
            location.latitude, location.longitude,
            target_stop.latitude, target_stop.longitude
        )
        
        # Find which stop the bus is nearest to currently
        current_stop = min(
            stops,
            key=lambda s: haversine(location.latitude, location.longitude, s.latitude, s.longitude)
        )
        
        features = build_feature_vector(distance_km=distance_km, speed_kmph=bus.average_speed_kmph)
        eta_minutes = predict_eta(features)
        
        return {
            "bus_number": bus.bus_number,
            "destination": target_stop.stop_name,
            "current_stop": current_stop.stop_name,
            "eta_minutes": eta_minutes,
            "distance_km": distance_km,
            "route_start": route.start_location if route else None,
            "route_end": route.end_location if route else None,
        }
    
    def find_buses_on_route(
        self,
        origin: Optional[str] = None,
        destination: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """Find all buses serving a route between origin and destination."""
        query = self.db.query(Route)
        query = self._apply_city_filter(query)
        
        if origin:
            query = query.filter(Route.start_location.ilike(f"%{origin}%"))
        if destination:
            query = query.filter(Route.end_location.ilike(f"%{destination}%"))
        
        routes = query.all()
        results = []
        
        for route in routes:
            buses = self.db.query(Bus).filter(Bus.route_id == route.id).all()
            for bus in buses:
                location = self.db.query(BusLocation).filter(BusLocation.bus_id == bus.id).first()
                
                # Find nearest stop to bus
                stops = self.db.query(Stop).filter(Stop.route_id == route.id).order_by(Stop.stop_order).all()
                current_stop = None
                if location and stops:
                    current_stop = min(
                        stops,
                        key=lambda s: haversine(location.latitude, location.longitude, s.latitude, s.longitude)
                    )
                
                results.append({
                    "bus_number": bus.bus_number,
                    "route_start": route.start_location,
                    "route_end": route.end_location,
                    "current_stop": current_stop.stop_name if current_stop else None,
                    "latitude": location.latitude if location else None,
                    "longitude": location.longitude if location else None,
                })
        
        return results

    def get_city_info(self) -> Optional[Dict[str, Any]]:
        """Get info about the current city."""
        if not self.city_id:
            return None
        
        city = self.db.query(City).filter(City.id == self.city_id).first()
        if not city:
            return None
        
        bus_count = self.db.query(Bus).filter(Bus.city_id == self.city_id).count()
        route_count = self.db.query(Route).filter(Route.city_id == self.city_id).count()
        stop_count = self.db.query(Stop).filter(Stop.city_id == self.city_id).count()
        
        return {
            "city_name": city.name,
            "country": city.country,
            "bus_count": bus_count,
            "route_count": route_count,
            "stop_count": stop_count,
        }
