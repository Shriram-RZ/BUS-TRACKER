import logging
import re
import tempfile
import os
from typing import Optional
import uuid

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Route, Stop, Bus, BusLocation
from ..schemas import (
    SearchRouteRequest,
    SearchRouteResponse,
    VoiceQueryRequest,
    VoiceQueryResponse,
)
from ..utils.geo_utils import haversine, calculate_eta
from ..ml.eta_model import build_feature_vector, predict_eta
from ..nlp.intent_model import predict_intent, extract_entities
from ..nlp.entity_extractor import extract_entities_advanced, resolve_entity_references
from ..nlp.response_generator import (
    generate_response,
    generate_greeting_response,
    generate_next_bus_response,
    generate_route_response,
    generate_nearest_stop_response,
    generate_bus_status_response,
    generate_buses_running_response,
    generate_active_buses_detail_response,
    generate_bus_eta_response,
)
from ..nlp.session_context import (
    get_user_session,
    add_to_session,
    get_previous_intent,
    get_entity_from_context,
)
from ..nlp.query_builder import QueryBuilder
from ..routing.graph import build_graph_for_city, shortest_path
from ..nlp.whisper_transcriber import transcribe_file


logger = logging.getLogger("voice_api")
router = APIRouter()


@router.post(
    "/search-route",
    response_model=SearchRouteResponse,
    tags=["Voice"],
)
def search_route(payload: SearchRouteRequest, db: Session = Depends(get_db)):
    """
    Existing 'from X to Y' style query endpoint used by the BlindPage UI.
    """
    query = payload.query.strip().lower()

    match = re.search(r"from\s+(.+?)\s+to\s+(.+)", query)
    if not match:
        match = re.search(r"(.+?)\s+to\s+(.+)", query)

    if not match:
        raise HTTPException(
            status_code=400,
            detail=(
                "Could not parse origin and destination from query. "
                "Try: 'Bus from <start> to <end>'."
            ),
        )

    start_raw = match.group(1).strip()
    end_raw = match.group(2).strip()

    for prefix in ("bus", "a bus", "the bus"):
        if start_raw.startswith(prefix):
            start_raw = start_raw[len(prefix) :].strip()

    route = (
        db.query(Route)
        .filter(
            Route.start_location.ilike(f"%{start_raw}%"),
            Route.end_location.ilike(f"%{end_raw}%"),
        )
        .first()
    )

    if not route:
        return SearchRouteResponse(
            message=f"No route found from {start_raw.title()} to {end_raw.title()}."
        )

    bus = db.query(Bus).filter(Bus.route_id == route.id).first()
    if not bus:
        return SearchRouteResponse(
            message=(
                f"No buses currently assigned to "
                f"{route.start_location} → {route.end_location}."
            )
        )

    location = db.query(BusLocation).filter(BusLocation.bus_id == bus.id).first()
    if not location:
        return SearchRouteResponse(
            message=f"Bus {bus.bus_number} is assigned but has no location data yet."
        )

    stops = (
        db.query(Stop)
        .filter(Stop.route_id == route.id)
        .order_by(Stop.stop_order)
        .all()
    )

    eta_minutes: float = 0.0
    if stops:
        distances = [
            haversine(location.latitude, location.longitude, s.latitude, s.longitude)
            for s in stops
        ]
        min_dist = min(distances)
        eta_minutes = round(
            calculate_eta(min_dist, bus.average_speed_kmph),
            1,
        )

    return SearchRouteResponse(
        message=f"Bus {bus.bus_number} is arriving in {eta_minutes} minutes."
    )


@router.post(
    "/voice-query",
    response_model=VoiceQueryResponse,
    tags=["Voice"],
)
def voice_query(payload: VoiceQueryRequest, db: Session = Depends(get_db)):
    """
    Intelligent NLP-powered voice query endpoint.
    
    Pipeline:
    1. Intent Detection (DistilBERT / rule-based)
    2. Entity Extraction (NER + fuzzy matching with database)
    3. Pronoun Resolution (session context)
    4. Context Retrieval (database queries)
    5. Dynamic Response Generation (templates + data)
    6. Conversational Memory (session-based)
    """
    query = payload.query.strip()
    city_id = payload.city_id
    user_lat = payload.user_lat
    user_lng = payload.user_lng
    user_id = payload.user_id if payload.user_id else str(uuid.uuid4())
    
    logger.info(f"🎤 Processing query: '{query}' (user: {user_id}, city: {city_id})")
    
    # Step 1: Intent Detection
    intent, confidence = predict_intent(query)
    logger.info(f"🧠 Intent detected: {intent} (confidence: {confidence:.2f})")
    
    # Step 2: Entity Extraction with fuzzy matching
    entities = extract_entities_advanced(query, db, city_id)
    entities = resolve_entity_references(entities, db, city_id)
    logger.info(f"🔍 Entities extracted: {entities}")
    
    # Step 3: Pronoun Resolution from session context
    session = get_user_session(user_id, city_id)
    entities = session.resolve_pronouns(query, entities)
    logger.info(f"🔗 After pronoun resolution: {entities}")
    
    # Step 4: Log to session
    add_to_session(user_id, query, intent, entities)
    
    # Step 5: Build query engine
    qb = QueryBuilder(db, city_id)
    
    # ── Greeting ──────────────────────────────────────────────────────────
    if intent == "greeting":
        bus_count = qb.get_bus_count()
        city_info = qb.get_city_info()
        city_name = city_info["city_name"] if city_info else None
        route_count = city_info["route_count"] if city_info else 0
        response_text = generate_greeting_response(bus_count, city_name, route_count)
        return VoiceQueryResponse(intent=intent, entities=entities, message=response_text)
    
    # ── Buses Running ─────────────────────────────────────────────────────
    if intent == "buses_running":
        active_buses = qb.get_active_buses()
        city_info = qb.get_city_info()
        city_name = city_info["city_name"] if city_info else None
        response_text = generate_active_buses_detail_response(active_buses, city_name)
        return VoiceQueryResponse(intent=intent, entities=entities, message=response_text)
    
    # ── Bus ETA ("when will bus X reach Y?") ──────────────────────────────
    if intent == "bus_eta":
        bus_number = entities.get("bus_number")
        destination = entities.get("destination")
        
        if not bus_number:
            response_text = "Which bus are you asking about? Please include the bus number, like 'when will bus 21A reach Gandhipuram?'"
            return VoiceQueryResponse(intent=intent, entities=entities, message=response_text)
        
        if not destination:
            response_text = f"Where do you want bus {bus_number} to reach? Please say the stop name."
            return VoiceQueryResponse(intent=intent, entities=entities, message=response_text)
        
        result = qb.find_bus_eta_to_stop(bus_number, destination)
        
        if not result:
            response_text = f"I couldn't find bus {bus_number} or the stop {destination}. Please verify the bus number and stop name."
            return VoiceQueryResponse(intent=intent, entities=entities, message=response_text)
        
        response_text = generate_bus_eta_response(
            bus_number=result["bus_number"],
            destination=result["destination"],
            eta_minutes=result["eta_minutes"],
            current_stop=result.get("current_stop"),
            distance_km=result.get("distance_km"),
        )
        
        entities.update({
            "bus_number": result["bus_number"],
            "destination": result["destination"],
            "eta_minutes": result["eta_minutes"],
        })
        
        logger.info(f"✅ Response: {response_text}")
        return VoiceQueryResponse(intent=intent, entities=entities, message=response_text)
    
    # ── Next Bus ──────────────────────────────────────────────────────────
    if intent == "next_bus":
        if not entities.get("destination"):
            response_text = "Please tell me where you want to go. For example, 'Next bus to Gandhipuram'."
            return VoiceQueryResponse(intent=intent, entities=entities, message=response_text)
        
        result = qb.find_next_bus(
            entities["destination"],
            user_lat,
            user_lng
        )
        
        if not result:
            response_text = f"I couldn't find any buses to {entities['destination']} right now. Try asking about a different destination."
            return VoiceQueryResponse(intent=intent, entities=entities, message=response_text)
        
        response_text = generate_next_bus_response(
            bus_number=result["bus_number"],
            destination=result["destination"],
            eta_minutes=result["eta_minutes"],
            current_stop=result.get("next_stop")
        )
        
        entities.update({
            "bus_number": result["bus_number"],
            "eta_minutes": result["eta_minutes"],
        })
        
        logger.info(f"✅ Response: {response_text}")
        return VoiceQueryResponse(intent=intent, entities=entities, message=response_text)
    
    # ── Bus Status ────────────────────────────────────────────────────────
    if intent == "bus_status":
        if not entities.get("bus_number"):
            response_text = "Which bus would you like to know about? Please say the bus number, like 'Where is bus 21A?'"
            return VoiceQueryResponse(intent=intent, entities=entities, message=response_text)
        
        bus_info = qb.find_bus_by_number(entities["bus_number"])
        
        if not bus_info:
            response_text = f"I couldn't find bus {entities['bus_number']}. Please check the bus number and try again."
            return VoiceQueryResponse(intent=intent, entities=entities, message=response_text)
        
        # Get current stop for richer response
        bus_status = qb.get_bus_status(bus_info["bus_id"])
        route_name = f"{bus_info['route']['start']} → {bus_info['route']['end']}" if bus_info.get("route") else None
        
        response_text = generate_bus_status_response(
            bus_number=bus_info["bus_number"],
            latitude=bus_info["location"]["latitude"] or 0,
            longitude=bus_info["location"]["longitude"] or 0,
            current_stop=bus_status.get("current_stop") if bus_status else None,
            route_name=route_name,
        )
        
        entities.update({"bus_number": bus_info["bus_number"]})
        
        logger.info(f"✅ Response: {response_text}")
        return VoiceQueryResponse(intent=intent, entities=entities, message=response_text)
    
    # ── Nearest Stop ──────────────────────────────────────────────────────
    if intent == "nearest_stop":
        if not user_lat or not user_lng:
            response_text = "Please enable location sharing so I can find the nearest stop for you."
            return VoiceQueryResponse(intent=intent, entities=entities, message=response_text)
        
        nearest_stop = qb.find_nearest_stop(user_lat, user_lng)
        
        if not nearest_stop:
            response_text = "I couldn't find any nearby stops. Please make sure your location is correct."
            return VoiceQueryResponse(intent=intent, entities=entities, message=response_text)
        
        result = qb.find_next_bus(nearest_stop["stop_name"], user_lat, user_lng)
        
        response_text = generate_nearest_stop_response(
            stop_name=nearest_stop["stop_name"],
            distance_km=nearest_stop["distance_km"],
            next_bus=result["bus_number"] if result else None,
            eta_minutes=result["eta_minutes"] if result else None
        )
        
        entities.update({"stop_name": nearest_stop["stop_name"]})
        
        logger.info(f"✅ Response: {response_text}")
        return VoiceQueryResponse(intent=intent, entities=entities, message=response_text)
    
    # ── Find Route ────────────────────────────────────────────────────────
    if intent == "find_route":
        if not entities.get("origin_id") or not entities.get("destination_id"):
            response_text = "Please specify both your starting point and destination. For example, 'Route from Peelamedu to Gandhipuram'."
            return VoiceQueryResponse(intent=intent, entities=entities, message=response_text)
        
        route_info = qb.find_route_with_path(
            entities["origin_id"],
            entities["destination_id"]
        )
        
        if not route_info:
            response_text = f"I couldn't find a direct route from {entities.get('origin', 'your origin')} to {entities.get('destination', 'your destination')}. Try a nearby stop."
            return VoiceQueryResponse(intent=intent, entities=entities, message=response_text)
        
        response_text = generate_route_response(
            origin=route_info["origin"],
            destination=route_info["destination"],
            distance_km=route_info["distance_km"],
            stops=route_info["stops"]
        )
        
        entities.update({
            "stops": route_info["stops"],
            "distance_km": route_info["distance_km"],
        })
        
        logger.info(f"✅ Response: {response_text}")
        return VoiceQueryResponse(intent=intent, entities=entities, message=response_text)
    
    # ── Unknown / Fallback ────────────────────────────────────────────────
    city_info = qb.get_city_info()
    city_name = city_info["city_name"] if city_info else "your city"
    response_text = (
        f"I didn't quite catch that. You can ask me things like: "
        f"'Next bus to Gandhipuram', 'Bus from Pollachi to Coimbatore', "
        f"'When will bus 21A reach Ukkadam?', or 'Nearest bus stop'. "
        f"I'm tracking buses in {city_name}!"
    )
    logger.info(f"❓ Fallback response for unknown intent")
    return VoiceQueryResponse(intent="unknown", entities=entities, message=response_text)


@router.post(
    "/transcribe-audio",
    tags=["Voice"],
)
async def transcribe_audio(file: UploadFile = File(...)):
    """
    Transcribe an uploaded audio file using **local Whisper** (faster-whisper).

    Expects multipart/form-data with a 'file' field containing audio in a
    browser-friendly format (e.g. webm, ogg, wav, mp3).
    
    Returns JSON: { \"text\": \"transcribed text\" }
    
    Features:
    - Uses CPU-optimized int8 model (\"base\" by default)
    - Handles silence and backgroundnoise via VAD
    - Returns empty string on transcription errors
    - Automatically cleans up temporary files
    """
    suffix = ""
    if file.filename and "." in file.filename:
        suffix = "." + file.filename.rsplit(".", 1)[-1]

    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            content = await file.read()
            if not content or len(content) == 0:
                logger.warning("Empty audio file received")
                return {"text": ""}
            
            tmp.write(content)
            tmp_path = tmp.name

        logger.info("Transcribing audio file: %s (size: %d bytes)", tmp_path, len(content))
        text = transcribe_file(tmp_path)
        
        if not text:
            logger.warning("Transcription returned empty result")
            return {"text": ""}
        
        logger.info("✅ Transcribed audio: %s", text)
        return {"text": text}

    except Exception as e:
        logger.exception("Transcription failed: %s", e)
        return {"text": ""}
    
    finally:
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.unlink(tmp_path)
                logger.debug("Cleaned up temporary file: %s", tmp_path)
            except Exception as e:
                logger.warning("Failed to cleanup temp file %s: %s", tmp_path, e)


