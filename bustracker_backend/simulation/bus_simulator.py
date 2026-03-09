import asyncio
import logging
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from ..database import SessionLocal
from ..models import Bus, Stop, BusLocation
from ..cache import cache_bus_location


logger = logging.getLogger("simulation")

INTERPOLATION_STEPS: int = 20
UPDATE_INTERVAL: float = 3.0


async def _simulate_bus(
    bus_id: int,
    bus_number: str,
    route_id: int,
    *,
    max_cycles: int | None = None,
) -> None:
    """Continuously update the position of a single bus."""
    logger.info("🚌 Starting simulation for Bus %s (id=%d)", bus_number, bus_id)

    cycle_count = 0
    while max_cycles is None or cycle_count < max_cycles:
        db: Session = SessionLocal()
        try:
            stops = (
                db.query(Stop)
                .filter(Stop.route_id == route_id)
                .order_by(Stop.stop_order)
                .all()
            )

            if len(stops) < 2:
                logger.warning(
                    "Bus %s has fewer than 2 stops — skipping simulation cycle.",
                    bus_number,
                )
                await asyncio.sleep(UPDATE_INTERVAL * 5)
                continue

            loop_stops = stops + [stops[0]]
            for i in range(len(loop_stops) - 1):
                start_stop = loop_stops[i]
                end_stop = loop_stops[i + 1]

                for step in range(INTERPOLATION_STEPS):
                    t = step / INTERPOLATION_STEPS
                    lat = start_stop.latitude + (end_stop.latitude - start_stop.latitude) * t
                    lng = start_stop.longitude + (end_stop.longitude - start_stop.longitude) * t

                    location = (
                        db.query(BusLocation)
                        .filter(BusLocation.bus_id == bus_id)
                        .first()
                    )

                    now = datetime.now(timezone.utc)
                    if location:
                        location.latitude = lat
                        location.longitude = lng
                        location.last_updated = now
                    else:
                        location = BusLocation(
                            bus_id=bus_id,
                            latitude=lat,
                            longitude=lng,
                            last_updated=now,
                        )
                        db.add(location)

                    db.commit()

                    # Also push to Redis cache for fast reads
                    cache_bus_location(
                        city_id=getattr(location.bus, "city_id", None)
                        if hasattr(location, "bus")
                        else None,
                        bus_id=bus_id,
                        lat=lat,
                        lng=lng,
                        last_updated=now.isoformat(),
                    )
                    await asyncio.sleep(UPDATE_INTERVAL)

            cycle_count += 1

        except Exception:
            logger.exception("Error in simulation for Bus %s", bus_number)
            db.rollback()
            await asyncio.sleep(UPDATE_INTERVAL)
        finally:
            db.close()


async def start_simulation() -> None:
    """Launch background tasks to simulate all buses."""
    db: Session = SessionLocal()
    try:
        buses = db.query(Bus).all()
        if not buses:
            logger.info("⚠️  No buses in database — simulation idle.")
            return

        logger.info("🚀 Launching simulation for %d bus(es)…", len(buses))
        for bus in buses:
            asyncio.create_task(
                _simulate_bus(bus.id, bus.bus_number, bus.route_id)
            )
    finally:
        db.close()

