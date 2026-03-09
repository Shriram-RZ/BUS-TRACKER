from database import engine, SessionLocal
from models import Bus
from thefuzz import process, fuzz

def test():
    db = SessionLocal()
    all_buses = db.query(Bus).all()
    bus_names = [b.bus_number for b in all_buses]
    print("Bus Names in DB:", bus_names)
    
    query = "where is bus 21a"
    match_result = process.extractOne(query, bus_names, scorer=fuzz.token_set_ratio)
    print("Fuzz match result:", match_result)

if __name__ == "__main__":
    test()
