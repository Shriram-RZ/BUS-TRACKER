"""
Simple Redis-backed cache utilities for live locations and metadata.
"""

from __future__ import annotations

import json
import logging
import os
from typing import Optional, Dict, Any

import redis  # type: ignore[import-untyped]


logger = logging.getLogger("cache")

REDIS_URL_ENV = "REDIS_URL"
DEFAULT_REDIS_URL = "redis://localhost:6379/0"

_CLIENT: Optional[redis.Redis] = None
_CACHE_DISABLED: bool = False


def get_client() -> Optional[redis.Redis]:
    """
    Get or initialize a singleton Redis client.
    """
    global _CLIENT, _CACHE_DISABLED

    if _CACHE_DISABLED:
        return None
    if _CLIENT is not None:
        return _CLIENT

    url = os.getenv(REDIS_URL_ENV, DEFAULT_REDIS_URL)
    try:
        _CLIENT = redis.from_url(url)
        # light health check
        _CLIENT.ping()
        logger.info("✅ Connected to Redis at %s", url)
    except Exception:
        logger.warning("Redis unavailable at %s; caching will be disabled.", url)
        _CLIENT = None
        _CACHE_DISABLED = True
    return _CLIENT


def cache_bus_location(
    *,
    city_id: Optional[int],
    bus_id: int,
    lat: float,
    lng: float,
    last_updated: str,
) -> None:
    """
    Store a bus location snapshot in Redis.
    """
    client = get_client()
    if client is None:
        return

    key = f"bus_location:{city_id or 0}:{bus_id}"
    value = json.dumps(
        {"bus_id": bus_id, "lat": lat, "lng": lng, "last_updated": last_updated}
    )
    try:
        client.set(key, value, ex=60)  # 1 minute TTL
    except Exception:
        logger.exception("Failed to cache bus location for bus_id=%d", bus_id)


def get_cached_bus_location(
    *,
    city_id: Optional[int],
    bus_id: int,
) -> Optional[Dict[str, Any]]:
    """
    Retrieve a cached bus location snapshot, if present.
    """
    client = get_client()
    if client is None:
        return None

    key = f"bus_location:{city_id or 0}:{bus_id}"
    try:
        raw = client.get(key)
        if not raw:
            return None
        return json.loads(raw)
    except Exception:
        logger.exception("Failed to fetch cached bus location for bus_id=%d", bus_id)
        return None

