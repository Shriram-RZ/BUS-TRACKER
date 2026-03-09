"""
Predictive ETA model integration.

This module is designed to load a pre-trained regression model (e.g.
RandomForestRegressor or LightGBM) from disk and expose a small API that
the rest of the application can use. If the model artifact is missing,
the functions gracefully fall back to the rule-based ETA calculation.
"""

from __future__ import annotations

import logging
import os
from datetime import datetime
from typing import Sequence

import joblib  # type: ignore[import-untyped]

from ..utils.geo_utils import calculate_eta


logger = logging.getLogger("eta_model")

ETA_MODEL_PATH_ENV = "ETA_MODEL_PATH"

_ETA_MODEL = None


def load_eta_model() -> None:
    """
    Load the ETA regression model from the path specified in ETA_MODEL_PATH.

    The loaded object is expected to implement a scikit-learn-like
    ``predict`` method accepting a 2D array of shape (n_samples, n_features).
    """
    global _ETA_MODEL

    if _ETA_MODEL is not None:
        return

    model_path = os.getenv(ETA_MODEL_PATH_ENV)
    if not model_path:
        logger.warning(
            "ETA_MODEL_PATH not set; predictive ETA will fall back to rule-based calculation."
        )
        return

    try:
        _ETA_MODEL = joblib.load(model_path)
        logger.info("✅ Loaded ETA model from %s", model_path)
    except Exception:
        logger.exception(
            "Failed to load ETA model from %s; falling back to rule-based ETA.", model_path
        )
        _ETA_MODEL = None


def build_feature_vector(
    *,
    distance_km: float,
    speed_kmph: float,
    when: datetime | None = None,
    traffic_level: float | None = None,
    weather_code: float | None = None,
) -> list[float]:
    """
    Build a feature vector matching the training schema:

    [distance, speed, hour, weekday, traffic_level, weather]
    """
    when = when or datetime.utcnow()
    hour = float(when.hour)
    weekday = float(when.weekday())  # Monday=0

    # In a real deployment, traffic_level and weather_code would come from
    # live APIs; for now, we default to neutral mid-range values when absent.
    traffic_level_val = 0.5 if traffic_level is None else float(traffic_level)
    weather_val = 0.5 if weather_code is None else float(weather_code)

    return [
        float(distance_km),
        float(speed_kmph),
        hour,
        weekday,
        traffic_level_val,
        weather_val,
    ]


def _ensure_model_loaded() -> None:
    if _ETA_MODEL is None:
        load_eta_model()


def predict_eta(features: Sequence[float]) -> float:
    """
    Predict ETA in minutes using the ML model when available.

    If the model is not loaded, falls back to distance/speed using the
    classical formula.
    """
    _ensure_model_loaded()

    distance_km = float(features[0]) if features else 0.0
    speed_kmph = float(features[1]) if len(features) > 1 else 0.0

    if _ETA_MODEL is None:
        return round(calculate_eta(distance_km, speed_kmph), 1)

    try:
        # The model expects a 2D array-like
        pred = _ETA_MODEL.predict([list(features)])[0]
        eta = float(pred)
        if eta < 0:
            eta = 0.0
        return round(eta, 1)
    except Exception:
        logger.exception("Error during ETA model prediction; using fallback ETA.")
        return round(calculate_eta(distance_km, speed_kmph), 1)

