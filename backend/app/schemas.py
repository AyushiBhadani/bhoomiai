"""
Pydantic schemas for the BhoomiAI Land Record Digitization System.
These define the shape of data flowing in/out of the API endpoints.
"""

from enum import Enum
from pydantic import BaseModel
from typing import Optional, Any, List
from datetime import datetime


# ─────────────────────────────────────────────
#  Auth Schemas
# ─────────────────────────────────────────────

class UserCreate(BaseModel):
    email: str
    password: str
    role: Optional[str] = "verifier"  # admin | officer | verifier


class UserLogin(BaseModel):
    email: str
    password: str


class UserResponse(BaseModel):
    id: int
    email: str
    role: str
    is_active: bool

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class TokenData(BaseModel):
    """Payload embedded inside the JWT."""
    email: Optional[str] = None
    user_id: Optional[int] = None
    role: Optional[str] = None


# ─────────────────────────────────────────────
#  Document Schemas
# ─────────────────────────────────────────────

class DocumentCreate(BaseModel):
    filename: str
    filepath: str


class DocumentResponse(BaseModel):
    id: int
    filename: str
    filepath: str
    upload_date: Optional[datetime]
    status: str
    uploader_id: Optional[int]
    records_count: Optional[int] = 0  # Populated by route handler

    class Config:
        from_attributes = True


# ─────────────────────────────────────────────
#  Extracted Record Schemas
# ─────────────────────────────────────────────

class ExtractedRecordResponse(BaseModel):
    id: int
    document_id: int
    ocr_raw_text: Optional[str]
    owner_name: Optional[str]
    survey_number: Optional[str]
    khasra_number: Optional[str]
    khata_number: Optional[str]
    area: Optional[float]
    village: Optional[str]
    tehsil: Optional[str]
    district: Optional[str]
    state: Optional[str]         # added
    plot_number: Optional[str]   # added
    land_classification: Optional[str]
    ownership_type: Optional[str]
    mutation_number: Optional[str]
    registration_number: Optional[str]
    confidence_scores: Optional[dict]
    validation_status: Optional[str]
    validation_errors: Optional[list]

    class Config:
        from_attributes = True


class RecordCorrection(BaseModel):
    """Payload sent by human verifier to correct a single extracted field.
    Accepts corrected_value (frontend) or new_value (legacy) interchangeably.
    """
    field_name: Optional[str] = None    # primary key name
    field: Optional[str] = None         # alias kept for client compatibility
    new_value: Optional[Any] = None     # Could be string or float depending on the field
    corrected_value: Optional[Any] = None  # Frontend sends this
    reason: Optional[str] = None        # verifier's reason for correction

    def get_value(self) -> Any:
        """Return whichever value field is populated."""
        return self.corrected_value if self.corrected_value is not None else self.new_value

    def get_field_name(self) -> Optional[str]:
        """Return field name from either field_name or field."""
        return self.field_name or self.field


# ─────────────────────────────────────────────
#  Search / Repository Schemas
# ─────────────────────────────────────────────

class SearchResult(BaseModel):
    """Paginated search results across all extracted records."""
    records: List[ExtractedRecordResponse]
    total: int


# ─────────────────────────────────────────────
#  Export Schemas
# ─────────────────────────────────────────────

class ExportFormat(str, Enum):
    """Supported export file formats."""
    csv = "csv"
    json = "json"


# ─────────────────────────────────────────────
#  Parcel Schemas
# ─────────────────────────────────────────────

class ParcelResponse(BaseModel):
    id: int
    survey_number: str
    village: Optional[str]
    area: Optional[float]
    geometry_geojson: Optional[dict]

    class Config:
        from_attributes = True


# ─────────────────────────────────────────────
#  Audit Log Schemas
# ─────────────────────────────────────────────

class AuditLogResponse(BaseModel):
    id: int
    record_id: int
    user_id: Optional[int]
    action: str
    field_name: Optional[str]
    old_value: Optional[str]
    new_value: Optional[str]
    comment: Optional[str]
    timestamp: Optional[datetime]

    class Config:
        from_attributes = True


# ─────────────────────────────────────────────
#  Dashboard Schemas
# ─────────────────────────────────────────────

class DashboardStats(BaseModel):
    total_documents: int
    verified_documents: int
    pending_verification: int
    failed_documents: int
    processing_documents: int    # documents currently being processed
    total_records: int           # total extracted records
    records_with_errors: int     # records whose validation_status == 'Failed'
    avg_confidence: float        # 0-100 average across all records
    recent_activity: list        # Last 10 audit logs as dicts


# ─────────────────────────────────────────────
#  Agent / AI Q&A Schemas
# ─────────────────────────────────────────────

class AgentQuery(BaseModel):
    """Question posed to the land-record intelligence agent."""
    question: str
    record_id: Optional[int] = None   # Optional — not needed for general chat
    context: Optional[dict] = {}      # Extra context the frontend may pass


class AgentResponse(BaseModel):
    answer: str


# ─────────────────────────────────────────────
#  Optional Comment Body (approve / reject)
# ─────────────────────────────────────────────

class CommentBody(BaseModel):
    """Optional request body for approve/reject endpoints."""
    comment: Optional[str] = None
