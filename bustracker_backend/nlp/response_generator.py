import logging
from typing import Dict, Optional, List, Any
from datetime import datetime

logger = logging.getLogger("response_generator")


class ResponseTemplate:
    def __init__(self, intent: str):
        self.intent = intent
        self.templates = self._load_templates()
    
    def _load_templates(self) -> Dict[str, List[str]]:
        return {
            "greeting": [
                "Hello! I'm your transit assistant. How can I help you?",
                "Hi there! What bus or route information do you need?",
                "Welcome! You can ask about buses, routes, or nearby stops.",
            ],
            "next_bus": [
                "Bus {bus_number} heading to {destination} will arrive in {eta_minutes} minutes.",
                "The next bus to {destination} is {bus_number}, arriving in about {eta_minutes} minutes.",
                "{bus_number} is your next option to {destination}, arriving in {eta_minutes} minutes.",
            ],
            "find_route": [
                "The route from {origin} to {destination} is {distance_km} kilometers. The stops are: {stops}.",
                "To get from {origin} to {destination}, you'll travel {distance_km} km through: {stops}.",
                "Here's your route: {stops}. Total distance is {distance_km} km.",
            ],
            "bus_status": [
                "Bus {bus_number} is currently running on its route.",
                "{bus_number} is active and at coordinates {latitude}, {longitude}.",
                "Bus {bus_number} is operating normally with no reported issues.",
            ],
            "nearest_stop": [
                "The closest stop to you is {stop_name}, approximately {distance_km} kilometers away.",
                "Your nearest bus stop is {stop_name}, about {distance_km} km from your location.",
                "{stop_name} is the closest stop, {distance_km} km away.",
            ],
            "buses_running": [
                "There are currently {count} buses running in this city.",
                "I can see {count} active buses right now.",
                "{count} buses are in operation at the moment.",
            ],
            "unknown": [
                "I didn't quite understand that. Could you rephrase?",
                "I'm not sure what you're asking. Try asking about buses, routes, or stops.",
                "That's unclear to me. Would you ask about a specific bus, route, or stop?",
            ],
        }
    
    def generate(self, **context) -> str:
        import random
        templates = self.templates.get(self.intent, self.templates["unknown"])
        template = random.choice(templates)
        try:
            return template.format(**context)
        except KeyError as e:
            logger.warning(f"Missing context key: {e} for intent {self.intent}")
            return templates[0]


def generate_response(
    intent: str,
    entities: Dict[str, Any],
    data: Dict[str, Any],
    context: Optional[Dict[str, Any]] = None
) -> str:
    """
    Generate natural, conversational response based on intent and data.
    Templates + data = dynamic, context-aware responses (no hardcoding).
    """
    generator = ResponseTemplate(intent)
    
    response_context = {
        **entities,
        **data
    }
    
    if context:
        response_context.update(context)
    
    return generator.generate(**response_context)


def format_stop_list(stops: List[str]) -> str:
    if len(stops) == 0:
        return "no stops"
    elif len(stops) == 1:
        return stops[0]
    elif len(stops) == 2:
        return f"{stops[0]} and {stops[1]}"
    else:
        return ", ".join(stops[:-1]) + f", and {stops[-1]}"


def enhance_response_with_context(
    base_response: str,
    previous_intent: Optional[str] = None,
    user_context: Optional[Dict[str, Any]] = None
) -> str:
    """
    Enhance response with contextual information from previous queries.
    """
    if not previous_intent:
        return base_response
    
    if previous_intent == "next_bus" and "bus" in base_response.lower():
        return base_response + " Would you like to know anything else about this bus?"
    
    if previous_intent == "find_route" and "stops" in base_response.lower():
        return base_response + " You can board at the first stop."
    
    return base_response


def generate_greeting_response(bus_count: int, city_name: Optional[str] = None, route_count: int = 0) -> str:
    """Dynamic greeting based on current bus and route status."""
    import random
    city_part = f" in {city_name}" if city_name else ""
    route_part = f" across {route_count} routes" if route_count > 0 else ""
    
    templates = [
        f"Welcome! There are currently {bus_count} buses operating{city_part}{route_part}. How can I help you?",
        f"Hello! I see {bus_count} active buses{city_part}{route_part}. What would you like to know?",
        f"Hi there! We have {bus_count} buses in service{city_part}{route_part} right now. Ask me about any bus, route, or stop!",
    ]
    return random.choice(templates)


def generate_nearest_stop_response(
    stop_name: str,
    distance_km: float,
    next_bus: Optional[str] = None,
    eta_minutes: Optional[float] = None
) -> str:
    """Generate natural response for nearest stop query."""
    response = f"The nearest stop is {stop_name}, about {distance_km:.2f} kilometers away."
    
    if next_bus and eta_minutes:
        response += f" Bus {next_bus} will arrive there in about {eta_minutes:.0f} minutes."
    
    return response


def generate_next_bus_response(
    bus_number: str,
    destination: str,
    eta_minutes: float,
    route_number: Optional[str] = None,
    current_stop: Optional[str] = None
) -> str:
    """Generate natural response for next bus query."""
    import random
    
    stop_part = f" It's currently near {current_stop}." if current_stop else ""
    
    templates = [
        f"Bus {bus_number} is heading to {destination} and will arrive in about {eta_minutes:.0f} minutes.{stop_part}",
        f"Your next bus is {bus_number} to {destination}, arriving in roughly {eta_minutes:.0f} minutes.{stop_part}",
        f"Bus {bus_number} going to {destination} will be here in {eta_minutes:.0f} minutes.{stop_part}",
    ]
    return random.choice(templates)


def generate_route_response(
    origin: str,
    destination: str,
    distance_km: float,
    stops: List[str],
    estimated_time_minutes: Optional[float] = None
) -> str:
    """Generate natural response for route finding query."""
    stop_string = format_stop_list(stops)
    import random
    
    templates = [
        f"The route from {origin} to {destination} goes through: {stop_string}, covering about {distance_km:.2f} kilometers.",
        f"To get to {destination} from {origin}, you'll pass through: {stop_string} ({distance_km:.2f} km total).",
        f"Here's your route: {stop_string}. That's {distance_km:.2f} kilometers from {origin} to {destination}.",
    ]
    
    response = random.choice(templates)
    
    if estimated_time_minutes:
        response += f" This typically takes about {estimated_time_minutes:.0f} minutes."
    
    return response


def generate_bus_status_response(
    bus_number: str,
    latitude: float,
    longitude: float,
    current_stop: Optional[str] = None,
    eta_next_stop: Optional[float] = None,
    route_name: Optional[str] = None,
) -> str:
    """Generate natural response for bus status query."""
    route_part = f" on the {route_name} route" if route_name else ""
    response = f"Bus {bus_number} is currently operating{route_part}."
    
    if current_stop:
        response += f" It's near {current_stop}."
        if eta_next_stop:
            response += f" Next stop arrival in about {eta_next_stop:.0f} minutes."
    
    return response


def generate_buses_running_response(count: int, city_name: Optional[str] = None) -> str:
    """Generate natural response for buses running query."""
    city_suffix = f" in {city_name}" if city_name else ""
    
    if count == 0:
        return f"No buses are currently running{city_suffix}."
    elif count == 1:
        return f"There's 1 bus running{city_suffix} right now."
    else:
        return f"There are {count} buses running{city_suffix} at the moment."


def generate_active_buses_detail_response(
    buses: List[Dict[str, Any]],
    city_name: Optional[str] = None,
) -> str:
    """Generate a detailed response listing active buses with their current positions."""
    if not buses:
        city_suffix = f" in {city_name}" if city_name else ""
        return f"There are no active buses{city_suffix} right now."
    
    count = len(buses)
    city_suffix = f" in {city_name}" if city_name else ""
    
    if count > 5:
        # Summarize if too many buses
        bus_list = ", ".join(b["bus_number"] for b in buses[:5])
        response = f"There are {count} buses running{city_suffix}. Some of them are: {bus_list}, and {count - 5} more."
    else:
        bus_details = []
        for b in buses:
            detail = f"Bus {b['bus_number']}"
            if b.get("current_stop"):
                detail += f" (near {b['current_stop']})"
            elif b.get("route_name"):
                detail += f" on {b['route_name']}"
            bus_details.append(detail)
        
        response = f"There are {count} buses running{city_suffix}: {', '.join(bus_details)}."
    
    return response


def generate_bus_eta_response(
    bus_number: str,
    destination: str,
    eta_minutes: float,
    current_stop: Optional[str] = None,
    distance_km: Optional[float] = None,
) -> str:
    """Generate natural response for 'when will bus X reach Y?' queries."""
    import random
    
    current_part = f" It's currently near {current_stop}." if current_stop else ""
    distance_part = f" ({distance_km:.1f} km away)" if distance_km else ""
    
    templates = [
        f"Bus {bus_number} will reach {destination} in approximately {eta_minutes:.0f} minutes{distance_part}.{current_part}",
        f"Bus {bus_number} is about {eta_minutes:.0f} minutes away from {destination}{distance_part}.{current_part}",
        f"Estimated arrival of bus {bus_number} at {destination} is {eta_minutes:.0f} minutes from now{distance_part}.{current_part}",
    ]
    return random.choice(templates)
