

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Support both package and script execution (uvicorn main:app and
# uvicorn bustracker_backend.main:app) by trying relative imports
# first, then falling back to absolute imports.
try:  # package-style imports
    from .database import engine, Base  # type: ignore[import-not-found]
    from .routes import api_router  # type: ignore[import-not-found]
    from .simulation import start_simulation  # type: ignore[import-not-found]
except ImportError:  # script-style imports
    from database import engine, Base  # type: ignore[no-redef]
    from routes import api_router  # type: ignore[no-redef]
    from simulation import start_simulation  # type: ignore[no-redef]




logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
)
logger = logging.getLogger("main")





@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🗄️  Creating database tables (if not exist)…")
    Base.metadata.create_all(bind=engine)
    logger.info("✅ Tables ready.")

    logger.info("🚌 Starting bus simulation…")
    await start_simulation()
    logger.info("✅ Simulation tasks launched.")

    logger.info("=" * 60)
    logger.info("🚀 Bus Tracking Backend is LIVE at http://localhost:8000")
    logger.info("📖 Swagger docs  →  http://localhost:8000/docs")
    logger.info("📖 ReDoc          →  http://localhost:8000/redoc")
    logger.info("=" * 60)

    yield

    logger.info("👋 Shutting down Bus Tracking Backend…")





app = FastAPI(
    title="Real-Time Bus Tracking API",
    description=(
        "Production-ready backend for live bus tracking, ETA calculation, "
        "and voice-assisted route search."
    ),
    version="1.0.0",
    lifespan=lifespan,
)




app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)




app.include_router(api_router)

