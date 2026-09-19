"""
FastAPI application entry point for the BhoomiAI Land Record System.

Startup tasks:
  - Ensure the SQLite database tables exist
  - Ensure the uploads/ directory exists
  - Seed a demo admin user if the DB is empty
  - Seed sample reference parcels for demo/testing
"""

import os
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import models
from app.database import engine, SessionLocal
from app import routes

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Absolute path to the uploads directory (sibling of backend/)
UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "..", "uploads")


# 
#  Startup / Shutdown lifecycle
# 

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Code executed once on server startup (before any requests) and on shutdown.
    """
    #  Create DB tables 
    models.Base.metadata.create_all(bind=engine)
    logger.info("Database tables ensured.")

    #  Create uploads directory 
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    logger.info("Uploads directory ready: %s", os.path.abspath(UPLOAD_DIR))

    #  Seed demo data if DB is empty 
    _seed_demo_data()

    yield  # Application runs here

    logger.info("Shutting down SIH backend.")


def _seed_demo_data():
    """
    Insert a default admin user and sample parcels on first run.
    Idempotent  skips seeding if data already exists.
    """
    from app.auth import get_password_hash
    from app.models import User, Parcel

    db = SessionLocal()
    try:
        # Seed admin user
        if not db.query(User).filter(User.email == "admin@bhoomi.gov.in").first():
            admin = User(
                email="admin@bhoomi.gov.in",
                hashed_password=get_password_hash("admin123"),
                role="admin",
                is_active=True,
            )
            db.add(admin)
            logger.info("Seeded demo admin user: admin@bhoomi.gov.in / admin123")

        # Seed demo officer
        if not db.query(User).filter(User.email == "officer@bhoomi.gov.in").first():
            officer = User(
                email="officer@bhoomi.gov.in",
                hashed_password=get_password_hash("officer123"),
                role="officer",
                is_active=True,
            )
            db.add(officer)

        # Seed sample reference parcels with land classification + circle rates
        sample_parcels = [
            {"survey_number": "124/7",  "village": "Rampur",    "district": "Agra",    "tehsil": "Etmadpur",  "area": 2.5,  "land_classification": "Agricultural",             "circle_rate_per_sqm": 450},
            {"survey_number": "45A",    "village": "Sitapur",   "district": "Agra",    "tehsil": "Agra",      "area": 1.8,  "land_classification": "Residential",              "circle_rate_per_sqm": 12000},
            {"survey_number": "99/3B",  "village": "Fatehpur",  "district": "Agra",    "tehsil": "Fatehabad", "area": 5.0,  "land_classification": "Agricultural (Irrigated)", "circle_rate_per_sqm": 600},
            {"survey_number": "200/1",  "village": "Agra",      "district": "Agra",    "tehsil": "Agra",      "area": 0.75, "land_classification": "Commercial",               "circle_rate_per_sqm": 45000},
            {"survey_number": "312",    "village": "Mathura",   "district": "Mathura", "tehsil": "Mathura",   "area": 12.3, "land_classification": "Agricultural",             "circle_rate_per_sqm": 380},
            {"survey_number": "412/2",  "village": "Vrindavan", "district": "Mathura", "tehsil": "Mathura",   "area": 0.5,  "land_classification": "Industrial",               "circle_rate_per_sqm": 8500},
            {"survey_number": "58/C",   "village": "Aligarh",   "district": "Aligarh", "tehsil": "Koil",      "area": 3.2,  "land_classification": "Dry Crop Land",            "circle_rate_per_sqm": 320},
            {"survey_number": "77",     "village": "Firozabad", "district": "Firozabad","tehsil": "Firozabad", "area": 2.1,  "land_classification": "Government",               "circle_rate_per_sqm": None},
            {"survey_number": "19/B",   "village": "Tundla",    "district": "Firozabad","tehsil": "Tundla",    "area": 8.7,  "land_classification": "Forest",                   "circle_rate_per_sqm": None},
            {"survey_number": "303",    "village": "Hathras",   "district": "Hathras", "tehsil": "Hathras",   "area": 1.4,  "land_classification": "Residential",              "circle_rate_per_sqm": 6500},
        ]
        for p_data in sample_parcels:
            if not db.query(Parcel).filter(Parcel.survey_number == p_data["survey_number"]).first():
                db.add(Parcel(**p_data))
                logger.info("Seeded parcel: %s (%s)", p_data["survey_number"], p_data.get("land_classification"))

        db.commit()
    except Exception as exc:
        logger.error("Seed error: %s", exc)
        db.rollback()
    finally:
        db.close()


# 
#  FastAPI Application
# 

app = FastAPI(
    title="BhoomiAI  Intelligent Land Record Digitization and Validation System",
    description=(
        "Backend API for automated OCR extraction, rule-based validation, "
        "human-in-the-loop correction, and AI-assisted Q&A for land records."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

# Allow the Next.js frontend (and any origin during development)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount all API routes under /api prefix
app.include_router(routes.router, prefix="/api")


# 
#  Root health-check
# 

@app.get("/", tags=["Health"])
def root():
    return {
        "status": "ok",
        "message": "BhoomiAI  Land Record System API is running",
        "docs": "/docs",
        "version": "1.0.0",
    }

