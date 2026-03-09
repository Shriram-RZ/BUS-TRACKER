from fastapi import APIRouter

from .routes_api import router as routes_router
from .admin_api import router as admin_router
from .voice_api import router as voice_router


api_router = APIRouter()
api_router.include_router(routes_router)
api_router.include_router(admin_router)
api_router.include_router(voice_router)

