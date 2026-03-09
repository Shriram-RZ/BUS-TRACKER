"""
Legacy router module.

The canonical route implementations now live under the ``routes`` package:

- routes/routes_api.py
- routes/admin_api.py
- routes/voice_api.py

This module re-exports a combined ``router`` for backward compatibility.
"""

from fastapi import APIRouter

from .routes import api_router

router = APIRouter()
router.include_router(api_router)

