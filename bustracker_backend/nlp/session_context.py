import logging
from typing import Dict, Optional, List, Any
from datetime import datetime, timedelta
from collections import defaultdict

logger = logging.getLogger("session_context")


class ConversationContext:
    def __init__(self, user_id: str, city_id: Optional[int] = None):
        self.user_id = user_id
        self.city_id = city_id
        self.created_at = datetime.now()
        self.last_activity = datetime.now()
        self.query_history: List[Dict[str, Any]] = []
        self.entity_history: Dict[str, Any] = {}
        self.previous_intent: Optional[str] = None
        self.max_history = 10
        self.ttl_minutes = 30
    
    def add_query(self, query: str, intent: str, entities: Dict[str, Any]) -> None:
        """Log a query with its intent and entities."""
        self.query_history.append({
            "timestamp": datetime.now(),
            "query": query,
            "intent": intent,
            "entities": entities.copy()
        })
        self.previous_intent = intent
        self.entity_history.update(entities)
        self.last_activity = datetime.now()
        
        if len(self.query_history) > self.max_history:
            self.query_history.pop(0)
    
    def get_entity_from_history(self, entity_key: str) -> Optional[Any]:
        """Retrieve entity from conversation history."""
        return self.entity_history.get(entity_key)
    
    def get_previous_intent(self) -> Optional[str]:
        """Get the intent from the previous query."""
        return self.previous_intent
    
    def get_last_query(self) -> Optional[Dict[str, Any]]:
        """Get the most recent query log."""
        return self.query_history[-1] if self.query_history else None
    
    def is_expired(self) -> bool:
        """Check if session has expired."""
        return datetime.now() - self.last_activity > timedelta(minutes=self.ttl_minutes)
    
    def get_context_summary(self) -> Dict[str, Any]:
        """Return summary of conversation context."""
        return {
            "user_id": self.user_id,
            "city_id": self.city_id,
            "query_count": len(self.query_history),
            "previous_intent": self.previous_intent,
            "entity_history": self.entity_history,
            "last_activity": self.last_activity,
        }
    
    def resolve_pronouns(self, query: str, entities: Dict[str, Any]) -> Dict[str, Any]:
        """
        Resolve pronouns like 'it', 'that bus', 'there' from conversation history.
        
        If a user says "when will it reach Gandhipuram?", 'it' refers to the
        bus_number from the previous query context.
        """
        resolved = entities.copy()
        lower = query.lower()
        
        pronouns_for_bus = ["it", "that bus", "the bus", "this bus"]
        pronouns_for_stop = ["there", "that stop", "that place"]
        
        # If the query contains a bus pronoun but no bus_number was extracted
        if not resolved.get("bus_number"):
            for pronoun in pronouns_for_bus:
                if pronoun in lower:
                    historical_bus = self.entity_history.get("bus_number")
                    if historical_bus:
                        resolved["bus_number"] = historical_bus
                        break
        
        # If the query contains a stop pronoun but no destination was extracted
        if not resolved.get("destination"):
            for pronoun in pronouns_for_stop:
                if pronoun in lower:
                    historical_dest = self.entity_history.get("destination")
                    if historical_dest:
                        resolved["destination"] = historical_dest
                        break
        
        # If no origin was extracted, check history
        if not resolved.get("origin") and not resolved.get("origin_id"):
            historical_origin = self.entity_history.get("origin")
            historical_origin_id = self.entity_history.get("origin_id")
            if historical_origin and ("from" not in lower):
                # Only auto-fill if the user didn't specify a new origin
                pass  # Don't auto-fill origin unless pronoun used
        
        return resolved


class SessionManager:
    def __init__(self):
        self.sessions: Dict[str, ConversationContext] = {}
        self.user_sessions: Dict[str, str] = {}
    
    def get_or_create_session(self, user_id: str, city_id: Optional[int] = None) -> ConversationContext:
        """Get existing session or create new one for user."""
        session_id = self.user_sessions.get(user_id)
        
        if session_id and session_id in self.sessions:
            session = self.sessions[session_id]
            if not session.is_expired():
                return session
            else:
                del self.sessions[session_id]
        
        session_id = f"{user_id}_{datetime.now().timestamp()}"
        context = ConversationContext(user_id, city_id)
        self.sessions[session_id] = context
        self.user_sessions[user_id] = session_id
        
        logger.info(f"Created new session for user {user_id}")
        return context
    
    def get_session(self, user_id: str) -> Optional[ConversationContext]:
        """Get user's active session."""
        session_id = self.user_sessions.get(user_id)
        if session_id and session_id in self.sessions:
            session = self.sessions[session_id]
            if not session.is_expired():
                return session
            else:
                del self.sessions[session_id]
                del self.user_sessions[user_id]
        return None
    
    def end_session(self, user_id: str) -> None:
        """End user's session."""
        session_id = self.user_sessions.pop(user_id, None)
        if session_id:
            self.sessions.pop(session_id, None)
            logger.info(f"Ended session for user {user_id}")
    
    def cleanup_expired_sessions(self) -> int:
        """Remove expired sessions, return count of removed sessions."""
        expired_session_ids = [
            sid for sid, ctx in self.sessions.items()
            if ctx.is_expired()
        ]
        
        for sid in expired_session_ids:
            ctx = self.sessions[sid]
            self.user_sessions.pop(ctx.user_id, None)
            del self.sessions[sid]
        
        logger.info(f"Cleaned up {len(expired_session_ids)} expired sessions")
        return len(expired_session_ids)
    
    def get_all_sessions_summary(self) -> List[Dict[str, Any]]:
        """Get summary of all active sessions."""
        return [ctx.get_context_summary() for ctx in self.sessions.values()]


global_session_manager = SessionManager()


def get_session_manager() -> SessionManager:
    """Get the global session manager instance."""
    return global_session_manager


def get_user_session(user_id: str, city_id: Optional[int] = None) -> ConversationContext:
    """Get or create session for a user."""
    manager = get_session_manager()
    return manager.get_or_create_session(user_id, city_id)


def add_to_session(user_id: str, query: str, intent: str, entities: Dict[str, Any]) -> None:
    """Log a query to the user's session."""
    session = get_user_session(user_id)
    session.add_query(query, intent, entities)


def get_previous_intent(user_id: str) -> Optional[str]:
    """Get the previous intent from user's session."""
    manager = get_session_manager()
    session = manager.get_session(user_id)
    return session.get_previous_intent() if session else None


def get_entity_from_context(user_id: str, entity_key: str) -> Optional[Any]:
    """Get an entity from user's context history."""
    manager = get_session_manager()
    session = manager.get_session(user_id)
    return session.get_entity_from_history(entity_key) if session else None


def should_use_context(user_id: str, current_intent: str) -> bool:
    """Determine if we should use context from previous queries."""
    previous_intent = get_previous_intent(user_id)
    
    if not previous_intent:
        return False
    
    related_intents = {
        "next_bus": ["bus_status", "find_route"],
        "bus_status": ["next_bus"],
        "find_route": ["next_bus", "nearest_stop"],
        "nearest_stop": ["next_bus", "find_route"],
    }
    
    return current_intent in related_intents.get(previous_intent, [])
