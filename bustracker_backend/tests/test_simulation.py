import asyncio

import pytest

from bustracker_backend import simulation
from bustracker_backend.database import SessionLocal
from bustracker_backend.models import Bus, BusLocation


@pytest.mark.usefixtures("setup_database")
def test_simulation_updates_location(monkeypatch):
    # make the simulation run instantly for the test
    monkeypatch.setattr(simulation, "UPDATE_INTERVAL", 0)
    monkeypatch.setattr(simulation, "INTERPOLATION_STEPS", 2)

    db = SessionLocal()
    try:
        bus = db.query(Bus).first()
        assert bus is not None, "there should be at least one bus in the test db"

        loc_before = (
            db.query(BusLocation)
            .filter(BusLocation.bus_id == bus.id)
            .first()
        )
        assert loc_before is not None

        # run exactly one complete cycle of movement
        asyncio.run(
            simulation._simulate_bus(
                bus.id, bus.bus_number, bus.route_id, max_cycles=1
            )
        )

        loc_after = (
            db.query(BusLocation)
            .filter(BusLocation.bus_id == bus.id)
            .first()
        )
        assert loc_after is not None
        assert (
            loc_after.latitude != loc_before.latitude
            or loc_after.longitude != loc_before.longitude
        ), "location should have changed after one simulation cycle"
    finally:
        db.close()
