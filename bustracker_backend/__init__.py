"""Package entry point for the bus tracker backend.

This file makes the various modules available when the package is imported
(e.g. in tests) and provides a convenient namespace.
"""

from . import database, models, routes, schemas, utils, simulation

# expose common symbols at package level
from .main import app  # FastAPI application

__all__ = [
    "database",
    "models",
    "routes",
    "schemas",
    "utils",
    "simulation",
    "app",
]
