import json
import random
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from app.database import engine, Base, SessionLocal
from app.models import User, Document, ExtractedRecord, Parcel
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def get_password_hash(password):
    return pwd_context.hash(password)

def init_db():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    # 1. Create Users (Admin, Officer, Verifier)
    users = [
        User(email="admin@bhoomi.gov.in", hashed_password=get_password_hash("password"), role="admin"),
        User(email="officer@bhoomi.gov.in", hashed_password=get_password_hash("password"), role="officer"),
        User(email="verifier@bhoomi.gov.in", hashed_password=get_password_hash("password"), role="verifier")
    ]
    db.add_all(users)
    db.commit()

    # 2. Create GIS Parcels (Synthetic GeoJSON for Leaflet)
    # Using generic coordinates for demo
    parcels = [
        Parcel(
            survey_number="124/7", village="Rampur", area=2.5,
            geometry_geojson=json.dumps({"type": "Polygon", "coordinates": [[[78.123, 27.123], [78.124, 27.123], [78.124, 27.124], [78.123, 27.124], [78.123, 27.123]]]})
        ),
        Parcel(
            survey_number="125/2", village="Rampur", area=1.2,
            geometry_geojson=json.dumps({"type": "Polygon", "coordinates": [[[78.125, 27.123], [78.126, 27.123], [78.126, 27.124], [78.125, 27.124], [78.125, 27.123]]]})
        ),
        Parcel(
            survey_number="99/1", village="Shantipur", area=5.0,
            geometry_geojson=json.dumps({"type": "Polygon", "coordinates": [[[78.120, 27.120], [78.122, 27.120], [78.122, 27.122], [78.120, 27.122], [78.120, 27.120]]]})
        )
    ]
    db.add_all(parcels)
    db.commit()

    # 3. Create Documents and Extracted Records
    docs = [
        Document(filename="scan_1985_rampur.pdf", filepath="/uploads/scan_1985_rampur.pdf", status="Verified", uploader_id=2, upload_date=datetime.utcnow() - timedelta(days=2)),
        Document(filename="mutation_125_2.jpg", filepath="/uploads/mutation_125_2.jpg", status="Needs Verification", uploader_id=2, upload_date=datetime.utcnow() - timedelta(hours=5)),
        Document(filename="old_register_99_1.pdf", filepath="/uploads/old_register_99_1.pdf", status="Validating", uploader_id=2, upload_date=datetime.utcnow() - timedelta(minutes=30))
    ]
    db.add_all(docs)
    db.commit()

    # Create associated extracted records
    records = [
        # Record 1: Verified and Clean
        ExtractedRecord(
            document_id=1,
            owner_name="Ramesh Kumar", survey_number="124/7", khasra_number="45A", khata_number="101",
            area=2.5, village="Rampur", tehsil="Sadar", district="Agra", land_classification="Agricultural",
            ownership_type="Joint", mutation_number="MUT-85-11", registration_number="REG-1002",
            confidence_scores=json.dumps({"owner_name": "high", "survey_number": "high", "area": "high"}),
            validation_status="Passed",
            validation_errors=json.dumps([])
        ),
        # Record 2: Needs Verification (Area Mismatch)
        ExtractedRecord(
            document_id=2,
            owner_name="Suresh Singh", survey_number="125/2", khasra_number="45B", khata_number="102",
            area=1.8,  # Deliberate mismatch with parcel area 1.2
            village="Rampur", tehsil="Sadar", district="Agra", land_classification="Residential",
            ownership_type="Single", mutation_number="MUT-90-22", registration_number="REG-1055",
            confidence_scores=json.dumps({"owner_name": "high", "survey_number": "high", "area": "low"}),
            validation_status="Failed",
            validation_errors=json.dumps([{"field": "area", "issue": "Area extracted (1.8) does not match reference parcel area (1.2)"}])
        )
    ]
    db.add_all(records)
    db.commit()

    print("Demo Data Generated Successfully!")
    db.close()

if __name__ == "__main__":
    init_db()

