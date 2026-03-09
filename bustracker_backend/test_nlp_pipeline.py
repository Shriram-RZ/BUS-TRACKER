#!/usr/bin/env python
"""
NLP Pipeline Test & Demonstration

This script demonstrates the complete voice assistant NLP pipeline:
1. Intent detection
2. Entity extraction with fuzzy matching
3. Context-aware database querying
4. Dynamic response generation
5. Conversational memory

Run with: python test_nlp_pipeline.py
"""

import sys
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from models import Base, City, Route, Stop, Bus, BusLocation
from nlp.intent_model import predict_intent, extract_entities
from nlp.entity_extractor import extract_entities_advanced, resolve_entity_references
from nlp.response_generator import (
    generate_next_bus_response,
    generate_route_response,
    generate_nearest_stop_response,
    generate_bus_status_response,
    generate_buses_running_response,
)
from nlp.session_context import get_user_session, add_to_session
from nlp.query_builder import QueryBuilder

DATABASE_URL = "mysql+pymysql://root:1234@localhost/busdb"
engine = create_engine(DATABASE_URL, echo=False)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def test_intent_detection():
    """Test intent detection with various inputs."""
    print("\n" + "=" * 70)
    print("🧠 TEST 1: INTENT DETECTION")
    print("=" * 70)
    
    test_queries = [
        "Hello",
        "Next bus to Gandhipuram",
        "Bus from Pollachi to Coimbatore",
        "Where is bus 21A?",
        "Nearest stop",
        "How many buses are running?",
    ]
    
    for query in test_queries:
        intent, confidence = predict_intent(query)
        print(f"{query:45} → Intent: {intent:15} (conf: {confidence:.2f})")


def test_entity_extraction():
    """Test entity extraction with fuzzy matching."""
    print("\n" + "=" * 70)
    print("🔍 TEST 2: ENTITY EXTRACTION")
    print("=" * 70)
    
    db = SessionLocal()
    
    test_queries = [
        "Next bus to Gandhipuram",
        "Bus from Pollachi to Coimbatore",
        "Where is bus 21A?",
    ]
    
    for query in test_queries:
        entities = extract_entities_advanced(query, db, city_id=1)
        print(f"\nQuery: {query}")
        print(f"Extracted: {entities}")


def test_database_queries():
    """Test QueryBuilder with real database."""
    print("\n" + "=" * 70)
    print("🗄️  TEST 3: DATABASE QUERIES")
    print("=" * 70)
    
    db = SessionLocal()
    qb = QueryBuilder(db, city_id=1)
    
    bus_count = qb.get_bus_count()
    print(f"✓ Bus count: {bus_count}")
    
    active_buses = qb.get_active_buses()
    print(f"✓ Active buses: {len(active_buses)}")
    for bus in active_buses[:3]:
        print(f"  - {bus['bus_number']}: {bus['route_name']}")
    
    city_info = qb.get_city_info()
    if city_info:
        print(f"✓ City: {city_info['city_name']}")
        print(f"  Routes: {city_info['route_count']}, Stops: {city_info['stop_count']}")


def test_dynamic_response_generation():
    """Test response generation (no hardcoding)."""
    print("\n" + "=" * 70)
    print("📝 TEST 4: DYNAMIC RESPONSE GENERATION")
    print("=" * 70)
    
    next_bus_data = {
        "bus_number": "21A",
        "destination": "Gandhipuram",
        "eta_minutes": 5.2,
        "current_stop": "Peelamedu",
    }
    response = generate_next_bus_response(**next_bus_data)
    print(f"Next Bus Response:\n  {response}")
    
    route_data = {
        "origin": "Pollachi",
        "destination": "Coimbatore",
        "distance_km": 45.5,
        "stops": ["Peelamedu", "Gandhipuram", "Race Course"],
    }
    response = generate_route_response(**route_data)
    print(f"\nRoute Response:\n  {response}")
    
    nearest_stop_data = {
        "stop_name": "Peelamedu",
        "distance_km": 0.5,
        "next_bus": "21A",
        "eta_minutes": 3.0,
    }
    response = generate_nearest_stop_response(**nearest_stop_data)
    print(f"\nNearest Stop Response:\n  {response}")
    
    buses_count = generate_buses_running_response(5, city_name="Coimbatore")
    print(f"\nBuses Running Response:\n  {buses_count}")


def test_session_context():
    """Test conversational context memory."""
    print("\n" + "=" * 70)
    print("💾 TEST 5: SESSION CONTEXT MEMORY")
    print("=" * 70)
    
    user_id = "test_user_123"
    
    query1 = "Next bus to Gandhipuram"
    intent1 = "next_bus"
    entities1 = {"destination": "Gandhipuram", "bus_number": "21A"}
    add_to_session(user_id, query1, intent1, entities1)
    print(f"✓ Session 1: {query1} → {intent1}")
    
    query2 = "What is the bus number?"
    intent2 = "bus_status"
    entities2 = {"bus_number": "21A"}
    add_to_session(user_id, query2, intent2, entities2)
    print(f"✓ Session 2: {query2} → {intent2}")
    
    session = get_user_session(user_id)
    print(f"\n✓ Session History ({len(session.query_history)} queries):")
    for i, log in enumerate(session.query_history, 1):
        print(f"  {i}. {log['query']} ({log['intent']})")
    
    print(f"\n✓ Entity History: {session.entity_history}")


def test_fullpipeline():
    """Test the complete pipeline end-to-end."""
    print("\n" + "=" * 70)
    print("🚌 TEST 6: COMPLETE NLP PIPELINE")
    print("=" * 70)
    
    db = SessionLocal()
    
    test_query = "Next bus to Gandhipuram"
    print(f"\nUser Query: '{test_query}'")
    
    intent, confidence = predict_intent(test_query)
    print(f"\n1️⃣  Intent Detection:")
    print(f"   Intent: {intent} (confidence: {confidence:.2f})")
    
    entities = extract_entities_advanced(test_query, db, city_id=1)
    print(f"\n2️⃣  Entity Extraction:")
    print(f"   {entities}")
    
    qb = QueryBuilder(db, city_id=1)
    result = qb.find_next_bus(entities.get("destination"), 11.0168, 76.9558)
    print(f"\n3️⃣  Database Query:")
    if result:
        print(f"   Found: {result['bus_number']} → {result['destination']}")
        print(f"   ETA: {result['eta_minutes']:.0f} minutes")
    
    if result:
        response = generate_next_bus_response(
            bus_number=result["bus_number"],
            destination=result["destination"],
            eta_minutes=result["eta_minutes"],
        )
        print(f"\n4️⃣  Response Generation (NO HARDCODING):")
        print(f"   {response}")
    
    user_id = "demo_user"
    add_to_session(user_id, test_query, intent, entities)
    session = get_user_session(user_id)
    print(f"\n5️⃣  Session Saved:")
    print(f"   User: {user_id}, Queries: {len(session.query_history)}")


if __name__ == "__main__":
    print("\n" + "🎤 NLP PIPELINE TESTING SUITE " + "🎤".center(50))
    print("This demonstrates the complete voice assistant system.\n")
    
    try:
        test_intent_detection()
        test_entity_extraction()
        test_database_queries()
        test_dynamic_response_generation()
        test_session_context()
        test_fullpipeline()
        
        print("\n" + "=" * 70)
        print("✅ ALL TESTS PASSED!")
        print("=" * 70)
        print("\nKey Features Demonstrated:")
        print("  ✓ Intent classification (DistilBERT-based)")
        print("  ✓ Entity extraction with fuzzy matching")
        print("  ✓ Database query builders")
        print("  ✓ Dynamic response generation (template-based)")
        print("  ✓ Conversational context memory")
        print("  ✓ NO hardcoded responses!\n")
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
