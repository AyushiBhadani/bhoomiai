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
    Idempotent — skips seeding if data already exists.
    """
    from app.auth import get_password_hash
    from app.models import User, Parcel
    import json

    db = SessionLocal()
    try:
        # ── Users ────────────────────────────────────────────────────────────
        USERS = [
            {"email": "admin@bhoomi.gov.in",    "password": "admin123",    "role": "admin"},
            {"email": "officer@bhoomi.gov.in",  "password": "officer123",  "role": "officer"},
            {"email": "verifier@bhoomi.gov.in", "password": "verifier123", "role": "verifier"},
            {"email": "citizen@example.com",    "password": "citizen123",  "role": "citizen"},
        ]
        for u in USERS:
            if not db.query(User).filter(User.email == u["email"]).first():
                db.add(User(
                    email=u["email"],
                    hashed_password=get_password_hash(u["password"]),
                    role=u["role"],
                    is_active=True,
                ))
                logger.info("Seeded user: %s (%s)", u["email"], u["role"])

        # ── Parcels with REAL GPS polygon boundaries ──────────────────────
        # Each geometry_geojson contains an irregular polygon (not a rectangle)
        # to look authentic on the map — similar to actual cadastral boundaries.
        sample_parcels = [
            {
                "survey_number": "124/7",
                "village": "Rampur", "district": "Agra", "tehsil": "Etmadpur",
                "area": 2.5, "land_classification": "Agricultural",
                "circle_rate_per_sqm": 450,
                "geometry_geojson": json.dumps({"type": "Polygon", "coordinates": [[
                    [78.0081, 27.1767], [78.0095, 27.1772], [78.0102, 27.1765],
                    [78.0098, 27.1754], [78.0083, 27.1751], [78.0075, 27.1759],
                    [78.0081, 27.1767]
                ]], "center": [78.0088, 27.1762]}),
            },
            {
                "survey_number": "45A",
                "village": "Sitapur", "district": "Agra", "tehsil": "Agra",
                "area": 1.8, "land_classification": "Residential",
                "circle_rate_per_sqm": 12000,
                "geometry_geojson": json.dumps({"type": "Polygon", "coordinates": [[
                    [78.0241, 27.1902], [78.0256, 27.1908], [78.0261, 27.1899],
                    [78.0254, 27.1891], [78.0240, 27.1893], [78.0235, 27.1899],
                    [78.0241, 27.1902]
                ]], "center": [78.0248, 27.1899]}),
            },
            {
                "survey_number": "99/3B",
                "village": "Fatehpur", "district": "Agra", "tehsil": "Fatehabad",
                "area": 5.0, "land_classification": "Agricultural (Irrigated)",
                "circle_rate_per_sqm": 600,
                "geometry_geojson": json.dumps({"type": "Polygon", "coordinates": [[
                    [77.9980, 27.1630], [78.0005, 27.1638], [78.0012, 27.1622],
                    [78.0001, 27.1610], [77.9978, 27.1612], [77.9968, 27.1622],
                    [77.9980, 27.1630]
                ]], "center": [77.9990, 27.1624]}),
            },
            {
                "survey_number": "200/1",
                "village": "Agra", "district": "Agra", "tehsil": "Agra",
                "area": 0.75, "land_classification": "Commercial",
                "circle_rate_per_sqm": 45000,
                "geometry_geojson": json.dumps({"type": "Polygon", "coordinates": [[
                    [78.0350, 27.1840], [78.0360, 27.1844], [78.0364, 27.1837],
                    [78.0358, 27.1832], [78.0348, 27.1834], [78.0350, 27.1840]
                ]], "center": [78.0356, 27.1838]}),
            },
            {
                "survey_number": "312",
                "village": "Mathura", "district": "Mathura", "tehsil": "Mathura",
                "area": 12.3, "land_classification": "Agricultural",
                "circle_rate_per_sqm": 380,
                "geometry_geojson": json.dumps({"type": "Polygon", "coordinates": [[
                    [78.0180, 27.1700], [78.0215, 27.1712], [78.0228, 27.1695],
                    [78.0220, 27.1678], [78.0188, 27.1672], [78.0168, 27.1685],
                    [78.0180, 27.1700]
                ]], "center": [78.0198, 27.1692]}),
            },
            {
                "survey_number": "412/2",
                "village": "Vrindavan", "district": "Mathura", "tehsil": "Mathura",
                "area": 0.5, "land_classification": "Industrial",
                "circle_rate_per_sqm": 8500,
                "geometry_geojson": json.dumps({"type": "Polygon", "coordinates": [[
                    [78.0320, 27.1580], [78.0330, 27.1585], [78.0335, 27.1577],
                    [78.0327, 27.1572], [78.0318, 27.1575], [78.0320, 27.1580]
                ]], "center": [78.0326, 27.1579]}),
            },
            {
                "survey_number": "58/C",
                "village": "Aligarh", "district": "Aligarh", "tehsil": "Koil",
                "area": 3.2, "land_classification": "Dry Crop Land",
                "circle_rate_per_sqm": 320,
                "geometry_geojson": json.dumps({"type": "Polygon", "coordinates": [[
                    [78.0880, 27.8820], [78.0900, 27.8830], [78.0910, 27.8815],
                    [78.0902, 27.8802], [78.0882, 27.8805], [78.0874, 27.8814],
                    [78.0880, 27.8820]
                ]], "center": [78.0892, 27.8816]}),
            },
            {
                "survey_number": "77",
                "village": "Firozabad", "district": "Firozabad", "tehsil": "Firozabad",
                "area": 2.1, "land_classification": "Government",
                "circle_rate_per_sqm": None,
                "geometry_geojson": json.dumps({"type": "Polygon", "coordinates": [[
                    [78.3950, 27.1520], [78.3968, 27.1528], [78.3975, 27.1515],
                    [78.3965, 27.1505], [78.3948, 27.1508], [78.3942, 27.1516],
                    [78.3950, 27.1520]
                ]], "center": [78.3958, 27.1516]}),
            },
            {
                "survey_number": "19/B",
                "village": "Tundla", "district": "Firozabad", "tehsil": "Tundla",
                "area": 8.7, "land_classification": "Forest",
                "circle_rate_per_sqm": None,
                "geometry_geojson": json.dumps({"type": "Polygon", "coordinates": [[
                    [78.2330, 27.2120], [78.2365, 27.2135], [78.2380, 27.2112],
                    [78.2368, 27.2094], [78.2338, 27.2092], [78.2318, 27.2108],
                    [78.2330, 27.2120]
                ]], "center": [78.2349, 27.2113]}),
            },
            {
                "survey_number": "303",
                "village": "Hathras", "district": "Hathras", "tehsil": "Hathras",
                "area": 1.4, "land_classification": "Residential",
                "circle_rate_per_sqm": 6500,
                "geometry_geojson": json.dumps({"type": "Polygon", "coordinates": [[
                    [78.0560, 27.5950], [78.0574, 27.5957], [78.0580, 27.5947],
                    [78.0572, 27.5939], [78.0558, 27.5941], [78.0553, 27.5948],
                    [78.0560, 27.5950]
                ]], "center": [78.0566, 27.5948]}),
            },
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

# Allow the Next.js frontend origins (add your Render URL here)
ALLOWED_ORIGINS = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:3000,https://bhoomiai-1-xa0e.onrender.com,https://bhoomiai.onrender.com"
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept", "X-Requested-With"],
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

