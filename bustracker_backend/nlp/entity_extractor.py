import logging
import re
from typing import Dict, List, Optional, Tuple
from thefuzz import fuzz
from thefuzz import process
from sqlalchemy.orm import Session

logger = logging.getLogger("entity_extractor")


def extract_bus_number(query: str) -> Optional[str]:
    """Extract bus number from query. Handles: 'bus 14', 'bus 21A', 'bus TN-38 AB 1234'."""
    lower = query.lower().strip()
    
    # Pattern: 'bus TN-38 AB 1234' or 'bus TN38AB1234'
    m = re.search(r"bus\s+([a-z]{2}[\-\s]?\d{1,2}[\s]?[a-z]{1,2}[\s]?\d{1,4})", lower)
    if m:
        return m.group(1).strip().upper()
    
    # Pattern: 'bus 21A' or 'bus 14' or 'bus A21'
    m = re.search(r"bus\s+([a-z0-9][a-z0-9\-]{0,8})", lower)
    if m:
        candidate = m.group(1).strip().upper()
        # Avoid matching common words like "to", "from", "the"
        if candidate not in {"TO", "FROM", "THE", "A", "AN", "AT", "IN", "IS", "IT"}:
            return candidate
    
    return None


def extract_stop_names(query: str) -> Dict[str, List[str]]:
    """Extract origin/destination stop names from query."""
    origins = []
    destinations = []
    lower = query.lower()
    
    # Pattern: 'from X to Y'
    from_match = re.search(r"from\s+(.+?)(?:\s+to\s+|$)", lower)
    if from_match:
        origins.append(from_match.group(1).strip())
    
    # Pattern: 'to X' (general destination)
    to_match = re.search(r"\bto\s+(.+?)(?:\s+(?:via|at|by)|[?.!]|$)", lower)
    if to_match:
        destinations.append(to_match.group(1).strip())
    
    # Pattern: 'reach X' or 'arrive at X' (for 'when will bus X reach Y?')
    reach_match = re.search(r"(?:reach|arrive\s+at|get\s+to)\s+(.+?)(?:[?.!]|$)", lower)
    if reach_match and not destinations:
        destinations.append(reach_match.group(1).strip())
    
    return {"origins": origins, "destinations": destinations}


def extract_city_name(query: str, known_cities: List[str]) -> Optional[str]:
    """Extract city name from query using fuzzy matching against known cities."""
    if not known_cities:
        return None
    best_match, score = process.extractOne(query.lower(), [c.lower() for c in known_cities], scorer=fuzz.token_set_ratio)
    if score >= 70:
        # Return the original-cased city name
        for city in known_cities:
            if city.lower() == best_match:
                return city
    return None


def fuzzy_match_location(query_location: str, candidates: List[str], threshold: int = 60) -> Optional[str]:
    if not candidates:
        return None
    
    best_match, score = process.extractOne(query_location, candidates, scorer=fuzz.token_set_ratio)
    return best_match if score >= threshold else None


def fuzzy_match_stop(query_location: str, db_stops: List[Tuple[int, str]], threshold: int = 60) -> Optional[Tuple[int, str]]:
    if not db_stops:
        return None
    
    stop_names = [stop[1] for stop in db_stops]
    best_match, score = process.extractOne(query_location, stop_names, scorer=fuzz.token_set_ratio)
    
    if score >= threshold:
        for stop_id, stop_name in db_stops:
            if stop_name == best_match:
                return (stop_id, stop_name)
    return None


def extract_entities_advanced(
    query: str,
    db: Session,
    city_id: Optional[int] = None
) -> Dict[str, any]:
    from ..models import Stop, Route, Bus
    
    entities = {
        "bus_number": None,
        "origin": None,
        "destination": None,
        "origin_id": None,
        "destination_id": None,
        "stop_name": None,
        "stop_id": None,
    }
    
    bus_number = extract_bus_number(query)
    if bus_number:
        bus = db.query(Bus).filter(Bus.bus_number.ilike(bus_number)).first()
        if bus:
            entities["bus_number"] = bus.bus_number
    
    stop_names = extract_stop_names(query)
    
    stop_query = db.query(Stop)
    if city_id:
        stop_query = stop_query.filter(Stop.city_id == city_id)
    
    all_stops = stop_query.all()
    stop_candidates = [(s.id, s.stop_name) for s in all_stops]
    
    if stop_names["origins"]:
        origin_name = stop_names["origins"][0]
        match = fuzzy_match_stop(origin_name, stop_candidates, threshold=60)
        if match:
            entities["origin_id"], entities["origin"] = match
    
    if stop_names["destinations"]:
        dest_name = stop_names["destinations"][0]
        match = fuzzy_match_stop(dest_name, stop_candidates, threshold=60)
        if match:
            entities["destination_id"], entities["destination"] = match
    
    if "nearest" in query.lower() or "closest" in query.lower():
        entities["stop_name"] = "nearest"
    
    return entities


def resolve_entity_references(
    entities: Dict[str, any],
    db: Session,
    city_id: Optional[int] = None
) -> Dict[str, any]:
    from ..models import Route, Stop, Bus
    
    resolved = entities.copy()
    
    if entities.get("origin") and not entities.get("origin_id"):
        stop = db.query(Stop).filter(Stop.stop_name.ilike(f"%{entities['origin']}%"))
        if city_id:
            stop = stop.filter(Stop.city_id == city_id)
        found = stop.first()
        if found:
            resolved["origin_id"] = found.id
    
    if entities.get("destination") and not entities.get("destination_id"):
        stop = db.query(Stop).filter(Stop.stop_name.ilike(f"%{entities['destination']}%"))
        if city_id:
            stop = stop.filter(Stop.city_id == city_id)
        found = stop.first()
        if found:
            resolved["destination_id"] = found.id
    
    return resolved
