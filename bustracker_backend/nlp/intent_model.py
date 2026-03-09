"""
DistilBERT-based intent classifier and lightweight entity extractor.

This module wraps a HuggingFace Transformers model for intent
classification. It assumes that a fine-tuned checkpoint exists locally
with a classification head over the following labels:

    ["find_route", "next_bus", "nearest_stop", "bus_status", "greeting", "unknown"]

If no fine-tuned checkpoint is configured, the model falls back to a
simple heuristic ruleset for intents, while still running DistilBERT
for embedding extraction if desired.
"""

from __future__ import annotations

import logging
import os
import re
from typing import Dict, Tuple

from transformers import AutoTokenizer, AutoModelForSequenceClassification  # type: ignore[import-untyped]
import torch  # type: ignore[import-untyped]


logger = logging.getLogger("intent_model")

BASE_MODEL_NAME = "distilbert-base-uncased"
INTENT_MODEL_PATH_ENV = "INTENT_MODEL_PATH"

INTENT_LABELS = [
    "find_route",
    "next_bus",
    "nearest_stop",
    "bus_status",
    "buses_running",
    "bus_eta",
    "greeting",
    "unknown",
]

_TOKENIZER = None
_MODEL = None
_TRANSFORMER_DISABLED = False


def load_model() -> None:
    """
    Load tokenizer and (optionally fine-tuned) DistilBERT classification model.
    """
    global _TOKENIZER, _MODEL, _TRANSFORMER_DISABLED

    # If we already decided not to use transformers, do nothing.
    if _TRANSFORMER_DISABLED:
        return

    # If a custom fine-tuned path is not provided, stay fully local and rely
    # on the rule-based classifier instead of downloading from the hub.
    model_path = os.getenv(INTENT_MODEL_PATH_ENV)
    if not model_path:
        logger.warning(
            "INTENT_MODEL_PATH not set; using rule-based intent detection only "
            "(no DistilBERT download)."
        )
        _TRANSFORMER_DISABLED = True
        _TOKENIZER = None
        _MODEL = None
        return

    if _TOKENIZER is not None and _MODEL is not None:
        return

    logger.info("Loading intent model from %s", model_path)
    _TOKENIZER = AutoTokenizer.from_pretrained(model_path)
    _MODEL = AutoModelForSequenceClassification.from_pretrained(
        model_path,
        num_labels=len(INTENT_LABELS),
    )
    _MODEL.eval()


def _ensure_loaded() -> None:
    if _TOKENIZER is None or _MODEL is None:
        load_model()


def predict_intent(query: str) -> Tuple[str, float]:
    """
    Predict the high-level intent for a user query.

    Returns (intent_label, confidence).
    """
    text = query.strip().lower()

    # Lightweight rule-based short-circuit for obvious greetings.
    # Use word-boundary matching to avoid false positives (e.g. 'hi' in 'Pollachi').
    _GREETING_WORDS = [r"\bhello\b", r"\bhi\b", r"\bhey\b", r"\bgood morning\b", r"\bgood evening\b", r"\bgreetings\b"]
    if any(re.search(pat, text) for pat in _GREETING_WORDS):
        return "greeting", 0.99

    _ensure_loaded()

    # If transformers are disabled or failed to load, fall back to a very
    # simple heuristic classifier.
    if _TRANSFORMER_DISABLED or _TOKENIZER is None or _MODEL is None:
        # heuristic intents when transformers are disabled

        # "how many buses" / "buses running" / "active buses"
        if ("how many" in text and "bus" in text) or \
           ("running" in text and "bus" in text) or \
           ("active" in text and "bus" in text):
            return "buses_running", 0.85

        # "when will bus X reach/arrive at Y?" style queries
        if ("when" in text or "how long" in text) and \
           ("reach" in text or "arrive" in text or "get to" in text):
            return "bus_eta", 0.85

        if "nearest" in text and "stop" in text:
            return "nearest_stop", 0.8
        if "closest" in text and "stop" in text:
            return "nearest_stop", 0.8

        if "next" in text and "bus" in text:
            return "next_bus", 0.8

        # "bus to Gandhipuram" (no "from") → next_bus
        if "bus" in text and "to" in text and "from" not in text:
            return "next_bus", 0.75

        # "bus from X to Y" or "from X to Y"
        if "from" in text and "to" in text:
            return "find_route", 0.8
        # "bus from Gandhipuram" style origin-only queries
        if "bus" in text and "from" in text and "to" not in text:
            return "find_route", 0.7

        if "where" in text and "bus" in text:
            return "bus_status", 0.7
        if "status" in text and "bus" in text:
            return "bus_status", 0.7

        return "unknown", 0.5

    inputs = _TOKENIZER(
        text,
        return_tensors="pt",
        truncation=True,
        padding=True,
    )

    with torch.no_grad():
        outputs = _MODEL(**inputs)
        logits = outputs.logits
        probs = torch.softmax(logits, dim=-1)[0]

    conf, idx = torch.max(probs, dim=-1)
    intent = INTENT_LABELS[int(idx)]
    return intent, float(conf)


def extract_entities(query: str) -> Dict[str, str]:
    """
    Very lightweight entity extraction based on regex and patterns.

    Returns a dict with zero or more of:
    - stop_name
    - route_name
    - destination
    - origin
    """
    text = query.strip()
    lower = text.lower()
    entities: Dict[str, str] = {}

    # from X to Y
    m = re.search(r"from\s+(.+?)\s+to\s+(.+)", lower)
    if m:
        origin = m.group(1).strip()
        dest = m.group(2).strip()
        entities["origin"] = origin
        entities["destination"] = dest
        entities["route_name"] = f"{origin} to {dest}"
        return entities

    # from X (origin only)
    m = re.search(r"from\s+(.+)$", lower)
    if m:
        origin = m.group(1).strip()
        entities["origin"] = origin

    # to DEST
    m = re.search(r"\bto\s+([a-z0-9\s]+)", lower)
    if m:
        dest = m.group(1).strip()
        entities["destination"] = dest

    # nearest stop
    if "nearest stop" in lower or "closest stop" in lower:
        entities.setdefault("stop_name", "nearest")

    # crude bus number extraction (e.g. 'bus 21a')
    m = re.search(r"bus\s+([a-z0-9\-]+)", lower)
    if m:
        entities["route_name"] = m.group(1).strip()

    return entities

