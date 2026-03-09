from database import engine, SessionLocal
from models import Bus, Route, Stop, BusLocation

def seed():
    db = SessionLocal()
    
    # Check if empty (excluding the dummy 's' bus)
    if not db.query(Route).filter(Route.start_location == "Pollachi").first():
        print("Seeding database...")
        route = Route(start_location="Pollachi", end_location="Coimbatore")
        db.add(route)
        db.commit()
        db.refresh(route)
        
        stop1 = Stop(route_id=route.id, stop_name="Pollachi Bus Stand", latitude=10.662, longitude=77.006, stop_order=1)
        stop2 = Stop(route_id=route.id, stop_name="Kinathukadavu", latitude=10.822, longitude=77.018, stop_order=2)
        stop3 = Stop(route_id=route.id, stop_name="Coimbatore Ukkadam", latitude=10.999, longitude=76.963, stop_order=3)
        db.add_all([stop1, stop2, stop3])
        
        bus = Bus(bus_number="21A", route_id=route.id, average_speed_kmph=45.0)
        db.add(bus)
        db.commit()
        db.refresh(bus)
        
        loc = BusLocation(bus_id=bus.id, latitude=10.822, longitude=77.018) # at kinathukadavu
        db.add(loc)
        db.commit()
        
        print("Database seeded with Route Pollachi->Coimbatore and Bus 21A.")
    else:
        print("Database already contains test data.")
        
if __name__ == "__main__":
    seed()
