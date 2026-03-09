import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import City, Route, Stop, Bus, BusLocation
from ..schemas import (
    CityCreate,
    CityOut,
    RouteCreate,
    RouteOut,
    StopCreate,
    StopOut,
    BusCreate,
    BusOut,
)


logger = logging.getLogger("admin_api")
router = APIRouter()


@router.post(
    "/admin/cities",
    response_model=CityOut,
    status_code=201,
    tags=["Admin"],
)
def create_city(data: CityCreate, db: Session = Depends(get_db)):
    """
    Create a new city that can contain routes, stops, and buses.
    """
    existing = db.query(City).filter(City.name.ilike(data.name)).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"City '{data.name}' already exists (id={existing.id}).",
        )

    city = City(
        name=data.name,
        country=data.country,
        lat=data.lat,
        lng=data.lng,
    )
    db.add(city)
    db.commit()
    db.refresh(city)
    logger.info("✅ Created City #%d: %s, %s", city.id, city.name, city.country)
    return city


@router.post(
    "/admin/add-route",
    response_model=RouteOut,
    status_code=201,
    tags=["Admin"],
)
def add_route(data: RouteCreate, db: Session = Depends(get_db)):
    """
    Create a new route.
    """
    route_kwargs: dict = {
        "start_location": data.start_location,
        "end_location": data.end_location,
    }
    # forward-compat: if RouteCreate has city_id, pass it through
    city_id: Optional[int] = data.city_id
    if city_id is not None:
        city = db.query(City).filter(City.id == city_id).first()
        if not city:
            raise HTTPException(
                status_code=404,
                detail=f"City {city_id} not found.",
            )
        route_kwargs["city_id"] = city_id

    route = Route(**route_kwargs)
    db.add(route)
    db.commit()
    db.refresh(route)
    logger.info(
        "✅ Created Route #%d: %s → %s",
        route.id,
        route.start_location,
        route.end_location,
    )
    return route


@router.post(
    "/admin/add-stop",
    response_model=StopOut,
    status_code=201,
    tags=["Admin"],
)
def add_stop(data: StopCreate, db: Session = Depends(get_db)):
    """
    Append a stop to a route.
    """
    route = db.query(Route).filter(Route.id == data.route_id).first()
    if not route:
        raise HTTPException(status_code=404, detail=f"Route {data.route_id} not found.")

    stop_city_id: Optional[int] = data.city_id or route.city_id  # type: ignore[assignment]
    stop_kwargs: dict = {
        "route_id": data.route_id,
        "stop_name": data.stop_name,
        "latitude": data.latitude,
        "longitude": data.longitude,
        "stop_order": data.stop_order,
        "city_id": stop_city_id,
    }

    stop = Stop(**stop_kwargs)
    db.add(stop)
    db.commit()
    db.refresh(stop)
    logger.info(
        "✅ Added Stop '%s' (order=%d) to Route #%d",
        stop.stop_name,
        stop.stop_order,
        stop.route_id,
    )
    return stop


@router.post(
    "/admin/add-bus",
    response_model=BusOut,
    status_code=201,
    tags=["Admin"],
)
def add_bus(data: BusCreate, db: Session = Depends(get_db)):
    """
    Register a new bus against a route and seed its initial location.
    """
    route = db.query(Route).filter(Route.id == data.route_id).first()
    if not route:
        raise HTTPException(status_code=404, detail=f"Route {data.route_id} not found.")

    bus_city_id: Optional[int] = data.city_id or route.city_id  # type: ignore[assignment]
    bus_kwargs: dict = {
        "bus_number": data.bus_number,
        "route_id": data.route_id,
        "average_speed_kmph": data.average_speed_kmph,
        "city_id": bus_city_id,
    }

    bus = Bus(**bus_kwargs)
    db.add(bus)
    db.commit()
    db.refresh(bus)

    # Seed initial location at first stop
    first_stop = (
        db.query(Stop)
        .filter(Stop.route_id == data.route_id)
        .order_by(Stop.stop_order)
        .first()
    )
    if first_stop:
        loc = BusLocation(
            bus_id=bus.id,
            latitude=first_stop.latitude,
            longitude=first_stop.longitude,
        )
        db.add(loc)
        db.commit()

    logger.info("✅ Registered Bus %s on Route #%d", bus.bus_number, bus.route_id)
    return bus


@router.delete(
    "/admin/delete-bus/{bus_id}", status_code=200, tags=["Admin"]
)
def delete_bus(bus_id: int, db: Session = Depends(get_db)):
    """
    Delete a bus and its location.
    """
    bus = db.query(Bus).filter(Bus.id == bus_id).first()
    if not bus:
        raise HTTPException(status_code=404, detail=f"Bus {bus_id} not found.")

    db.query(BusLocation).filter(BusLocation.bus_id == bus_id).delete()

    bus_number = bus.bus_number
    db.delete(bus)
    db.commit()

    logger.info("✅ Deleted Bus %s", bus_number)
    return {"message": f"Bus {bus_number} deleted successfully"}


@router.delete(
    "/admin/delete-route/{route_id}", status_code=200, tags=["Admin"]
)
def delete_route(route_id: int, db: Session = Depends(get_db)):
    """
    Delete a route and all of its dependent entities (stops, buses, locations).
    """
    route = db.query(Route).filter(Route.id == route_id).first()
    if not route:
        raise HTTPException(status_code=404, detail=f"Route {route_id} not found.")

    route_name = f"{route.start_location} → {route.end_location}"

    # delete locations for all buses on this route
    buses = db.query(Bus).filter(Bus.route_id == route_id).all()
    for bus in buses:
        db.query(BusLocation).filter(BusLocation.bus_id == bus.id).delete()
    db.query(Bus).filter(Bus.route_id == route_id).delete()

    # delete stops and the route itself
    db.query(Stop).filter(Stop.route_id == route_id).delete()
    db.delete(route)
    db.commit()

    logger.info("✅ Deleted Route: %s", route_name)
    return {"message": f"Route {route_name} and its fleet deleted successfully"}

