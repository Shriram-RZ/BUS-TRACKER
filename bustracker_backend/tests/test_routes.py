import os

# force an in‑memory sqlite database before any imports that use database
os.environ["DATABASE_URL"] = "sqlite:///:memory:"

from fastapi.testclient import TestClient

from bustracker_backend import main
from bustracker_backend.database import Base, engine, SessionLocal
from bustracker_backend.models import Route, Stop, Bus, BusLocation


client = TestClient(main.app)


# override get_db so that the same in-memory session is used

def override_get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


main.app.dependency_overrides = {}
from bustracker_backend.database import get_db
main.app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(autouse=True)
def setup_database():
    # create tables and add a minimal dataset
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        route = Route(start_location="Alpha", end_location="Beta")
        db.add(route)
        db.flush()  # populate id

        stop = Stop(
            route_id=route.id,
            stop_name="Alpha Station",
            latitude=10.0,
            longitude=20.0,
            stop_order=1,
        )
        db.add(stop)

        bus = Bus(bus_number="42A", route_id=route.id, average_speed_kmph=60.0)
        db.add(bus)
        db.flush()

        location = BusLocation(bus_id=bus.id, latitude=10.0, longitude=20.0)
        db.add(location)

        db.commit()
    finally:
        db.close()
    yield
    # drop all tables after each test so state is fresh
    Base.metadata.drop_all(bind=engine)


def test_get_routes():
    resp = client.get("/routes")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert any(r["start_location"] == "Alpha" for r in data)


def test_search_route_success():
    payload = {"query": "Bus from alpha to beta"}
    resp = client.post("/search-route", json=payload)
    assert resp.status_code == 200
    assert "arriving" in resp.json()["message"].lower()


def test_search_route_failure():
    payload = {"query": "no such route"}
    resp = client.post("/search-route", json=payload)
    assert resp.status_code == 400 or resp.json().get("message")


def test_get_bus_locations():
    resp = client.get("/bus-locations")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert data and data[0]["bus_number"] == "42A"
