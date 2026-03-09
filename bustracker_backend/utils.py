"""
Backward-compatibility wrapper for geo utility functions.

The new canonical implementations live in ``utils/geo_utils.py`` and are
re-exported here so existing imports like ``from utils import haversine``
continue to work.
"""

from .utils.geo_utils import haversine, calculate_eta  # type: ignore[attr-defined]

