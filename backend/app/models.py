from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, Float, DateTime, Text, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    role = Column(String, default="verifier")  # admin, officer, verifier, citizen
    is_active = Column(Boolean, default=True)
    citizen_profile = relationship("CitizenProfile", back_populates="user", uselist=False)

class CitizenProfile(Base):
    __tablename__ = "citizen_profiles"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True)
    full_name = Column(String)
    phone = Column(String, nullable=True)
    id_proof_type = Column(String, nullable=True)  # aadhaar, pan, driving_license, voter_id
    id_proof_filepath = Column(String, nullable=True)
    id_proof_verified = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    user = relationship("User", back_populates="citizen_profile")

class Document(Base):
    __tablename__ = "documents"
    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String)
    filepath = Column(String)
    upload_date = Column(DateTime, default=datetime.utcnow)
    status = Column(String, default="Uploaded")  # Uploaded, Processing, Needs Verification, Verified, Failed
    uploader_id = Column(Integer, ForeignKey("users.id"))
    source = Column(String, default="officer")   # "officer" or "citizen"
    citizen_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    citizen_note = Column(Text, nullable=True)
    records = relationship("ExtractedRecord", back_populates="document")

class ExtractedRecord(Base):
    __tablename__ = "extracted_records"
    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id"))

    # Raw OCR text
    ocr_raw_text = Column(Text, nullable=True)

    # Extracted fields
    owner_name = Column(String, nullable=True)
    survey_number = Column(String, index=True, nullable=True)
    khasra_number = Column(String, index=True, nullable=True)
    khata_number = Column(String, index=True, nullable=True)
    area = Column(Float, nullable=True)
    village = Column(String, nullable=True)
    tehsil = Column(String, nullable=True)
    district = Column(String, nullable=True)
    state = Column(String, nullable=True)
    plot_number = Column(String, nullable=True)
    land_classification = Column(String, nullable=True)
    ownership_type = Column(String, nullable=True)
    mutation_number = Column(String, nullable=True)
    registration_number = Column(String, nullable=True)

    # Confidence Scores as JSON {"owner_name": "high", ...}
    confidence_scores = Column(JSON, nullable=True)

    # Validation results
    validation_status = Column(String, default="Pending")  # Passed, Failed
    validation_errors = Column(JSON, nullable=True)

    document = relationship("Document", back_populates="records")
    audit_logs = relationship("AuditLog", back_populates="record")

class Parcel(Base):
    __tablename__ = "parcels"
    id = Column(Integer, primary_key=True, index=True)
    survey_number = Column(String, unique=True, index=True)
    village = Column(String)
    area = Column(Float)
    geometry_geojson = Column(JSON, nullable=True)

class AuditLog(Base):
    __tablename__ = "audit_logs"
    id = Column(Integer, primary_key=True, index=True)
    record_id = Column(Integer, ForeignKey("extracted_records.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    action = Column(String)  # field_corrected, approved, rejected
    field_name = Column(String, nullable=True)
    old_value = Column(String, nullable=True)
    new_value = Column(String, nullable=True)
    comment = Column(Text, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow)

    record = relationship("ExtractedRecord", back_populates="audit_logs")
