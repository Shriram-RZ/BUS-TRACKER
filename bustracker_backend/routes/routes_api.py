from typing import List, Optional

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import City, Route, Stop, Bus, BusLocation
from ..schemas import (
    CityOut,
    RouteOut,
    BusOut,
    BusLocationOut,
)
from ..utils.geo_utils import haversine
from ..ml.eta_model import build_feature_vector, predict_eta
from ..cache import get_cached_bus_location


router = APIRouter()


@router.get("/cities", response_model=List[CityOut], tags=["Public"])
def get_cities(db: Session = Depends(get_db)):
    """
    List all cities configured in the system.
    """
    return db.query(City).all()


@router.get("/routes", response_model=List[RouteOut], tags=["Public"])
def get_routes(
    city_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    """
    List routes, optionally filtered by city_id.
    """
    query = db.query(Route)
    if city_id is not None:
        query = query.filter(Route.city_id == city_id)
    return query.all()


@router.get("/buses", response_model=List[BusOut], tags=["Public"])
def get_buses(
    city_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    """
    List buses, optionally filtered by city_id.
    """
    query = db.query(Bus)
    if city_id is not None:
        query = query.filter(Bus.city_id == city_id)
    return query.all()


@router.get("/bus-locations", response_model=List[BusLocationOut], tags=["Public"])
def get_bus_locations(
    city_id: Optional[int] = None,
    user_lat: float | None = None,
    user_lng: float | None = None,
    db: Session = Depends(get_db),
):
    """
    Return live bus locations and ETAs.

    Uses a predictive ETA model when available, with a fallback to the
    simple distance/speed formula.
    """
    buses_query = db.query(Bus)
    if city_id is not None:
        buses_query = buses_query.filter(Bus.city_id == city_id)

    buses = buses_query.all()
    results: list[dict] = []

    for bus in buses:
        # Prefer cached location for quick polling
        cached = get_cached_bus_location(city_id=bus.city_id, bus_id=bus.id)
        if cached is not None:
            lat = float(cached["lat"])
            lng = float(cached["lng"])
            last_updated = None
        else:
            location: BusLocation | None = (
                db.query(BusLocation).filter(BusLocation.bus_id == bus.id).first()
            )
            if not location:
                continue
            lat = location.latitude
            lng = location.longitude
            last_updated = location.last_updated

        stops = (
            db.query(Stop)
            .filter(Stop.route_id == bus.route_id)
            .order_by(Stop.stop_order)
            .all()
        )

        eta_minutes: float = 0.0
        distance_km: float = 0.0

        if stops:
            if user_lat is not None and user_lng is not None:
                # nearest stop to the user
                min_user_dist = float("inf")
                target_stop: Stop | None = None
                for stop in stops:
                    dist = haversine(user_lat, user_lng, stop.latitude, stop.longitude)
                    if dist < min_user_dist:
                        min_user_dist = dist
                        target_stop = stop

                if target_stop:
                    distance_km = haversine(
                        lat,
                        lng,
                        target_stop.latitude,
                        target_stop.longitude,
                    )
            else:
                # nearest stop to the bus along the route
                min_dist = float("inf")
                for stop in stops:
                    dist = haversine(lat, lng, stop.latitude, stop.longitude)
                    if dist < min_dist:
                        min_dist = dist
                distance_km = min_dist if stops else 0.0

        # Build features and predict ETA (with fallback inside predict_eta)
        features = build_feature_vector(
            distance_km=distance_km,
            speed_kmph=bus.average_speed_kmph,
        )
        eta_minutes = predict_eta(features)

        results.append(
            {
                "bus_id": bus.id,
                "bus_number": bus.bus_number,
                "lat": round(lat, 6),
                "lng": round(lng, 6),
                "eta_minutes": eta_minutes,
                "city_id": bus.city_id,
                "last_updated": last_updated,
            }
        )

    return results


