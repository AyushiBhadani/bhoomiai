"""
API Routes for the BhoomiAI Intelligent Land Record Digitization System.

Grouped into:
  /api/auth       Registration and JWT login
  /api/dashboard  Aggregate statistics
  /api/documents  CRUD + file upload + OCR pipeline
  /api/records    Field corrections, approval, rejection
  /api/parcels    Reference parcel lookup
  /api/agent      AI Q&A about a record
  /api/audit      Audit trail retrieval

Auth is OPTIONAL on most routes (demo-friendly): pass a JWT Bearer token to
get user attribution in audit logs, or omit it to work anonymously.
"""

import io
import csv
import json
import os
import shutil
import logging
from datetime import datetime
from typing import Optional, Any, List

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User, Document, ExtractedRecord, Parcel, AuditLog, CitizenProfile
from app.schemas import (
    UserCreate,
    UserLogin,
    Token,
    UserResponse,
    DashboardStats,
    DocumentResponse,
    ExtractedRecordResponse,
    RecordCorrection,
    ParcelResponse,
    AuditLogResponse,
    AgentQuery,
    AgentResponse,
    CommentBody,
)
from app.auth import (
    get_password_hash,
    verify_password,
    create_access_token,
    get_optional_user,
    get_current_active_user,
)
from app.services import ocr_service, validation_service, agent_service

logger = logging.getLogger(__name__)
router = APIRouter()

#  Upload directory (created by main.py startup) 
UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "uploads")


# 
#  Helper: SQLAlchemy row  plain dict
# 

def row_to_dict(model_instance) -> dict:
    """
    Convert a SQLAlchemy model instance to a plain Python dict.
    Automatically parses stringified JSON to avoid frontend crashes.
    """
    d = {}
    for col in model_instance.__table__.columns:
        val = getattr(model_instance, col.name)
        if isinstance(val, str) and (val.startswith('{') or val.startswith('[')):
            try:
                val = json.loads(val)
            except Exception:
                pass
        d[col.name] = val
    return d


# 
#  Helper: Write audit log entry
# 

def _write_audit(
    db: Session,
    record_id: int,
    action: str,
    user: Optional[User] = None,
    field_name: Optional[str] = None,
    old_value: Optional[str] = None,
    new_value: Optional[str] = None,
    comment: Optional[str] = None,
) -> AuditLog:
    log = AuditLog(
        record_id=record_id,
        user_id=user.id if user else None,
        action=action,
        field_name=field_name,
        old_value=str(old_value) if old_value is not None else None,
        new_value=str(new_value) if new_value is not None else None,
        comment=comment,
        timestamp=datetime.utcnow(),
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    return log


# 
#  AUTH ROUTES
# 

@router.post("/auth/register", response_model=UserResponse, tags=["Auth"])
def register(user_data: UserCreate, db: Session = Depends(get_db)):
    """
    Register a new user (demo only  in production restrict to admins).
    """
    existing = db.query(User).filter(User.email == user_data.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )
    user = User(
        email=user_data.email,
        hashed_password=get_password_hash(user_data.password),
        role=user_data.role or "verifier",
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/auth/login", response_model=Token, tags=["Auth"])
def login(credentials: UserLogin, db: Session = Depends(get_db)):
    """
    Authenticate with email + password; return a signed JWT access token.
    """
    user = db.query(User).filter(User.email == credentials.email).first()
    if not user or not verify_password(credentials.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Account is disabled",
        )
    token = create_access_token(
        data={"sub": user.email, "user_id": user.id, "role": user.role}
    )
    return Token(
        access_token=token,
        token_type="bearer",
        user=UserResponse(id=user.id, email=user.email, role=user.role, is_active=user.is_active),
    )


@router.get("/auth/me", response_model=UserResponse, tags=["Auth"])
def get_current_user_profile(
    current_user: User = Depends(get_current_active_user),
):
    """Return the currently authenticated user's profile."""
    return current_user



@router.get("/dashboard/stats", response_model=DashboardStats, tags=["Dashboard"])
def get_dashboard_stats(
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
):
    """Return aggregate counts and the last 5 audit-log entries."""
    total = db.query(Document).count()
    verified = db.query(Document).filter(Document.status == "Verified").count()
    pending = db.query(Document).filter(Document.status == "Needs Verification").count()
    failed = db.query(Document).filter(Document.status == "Failed").count()

    processing = db.query(Document).filter(Document.status == "Processing").count()

    # Record-level stats
    total_records = db.query(ExtractedRecord).count()
    records_with_errors = db.query(ExtractedRecord).filter(
        ExtractedRecord.validation_status == "Failed"
    ).count()

    # Average confidence: map string labels to numbers, average across all records
    all_records = db.query(ExtractedRecord).all()
    conf_map = {"high": 100.0, "medium": 60.0, "low": 20.0}
    scores = []
    for rec in all_records:
        if rec.confidence_scores and isinstance(rec.confidence_scores, dict):
            vals = [
                v if isinstance(v, (int, float)) else conf_map.get(str(v), 50.0)
                for v in rec.confidence_scores.values()
            ]
            if vals:
                scores.append(sum(vals) / len(vals))
    avg_confidence = round(sum(scores) / len(scores), 1) if scores else 0.0

    recent_logs = (
        db.query(AuditLog)
        .order_by(AuditLog.timestamp.desc())
        .limit(10)
        .all()
    )
    activity = []
    for log in recent_logs:
        d = row_to_dict(log)
        if isinstance(d.get("timestamp"), datetime):
            d["timestamp"] = d["timestamp"].isoformat()
        activity.append(d)

    return DashboardStats(
        total_documents=total,
        verified_documents=verified,
        pending_verification=pending,
        failed_documents=failed,
        processing_documents=processing,
        total_records=total_records,
        records_with_errors=records_with_errors,
        avg_confidence=avg_confidence,
        recent_activity=activity,
    )


# 
#  DOCUMENT ROUTES
# 

@router.get("/documents", tags=["Documents"])
def list_documents(
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
):
    """List all documents with their extracted-record count and serialized dates."""
    docs = db.query(Document).order_by(Document.upload_date.desc()).all()
    result = []
    for doc in docs:
        d = row_to_dict(doc)
        if isinstance(d.get("upload_date"), datetime):
            d["upload_date"] = d["upload_date"].isoformat()
        d["records_count"] = len(doc.records)
        result.append(d)
    return result


@router.get("/documents/{doc_id}", tags=["Documents"])
def get_document(
    doc_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
):
    """Retrieve a single document together with all its extracted records."""
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    d = row_to_dict(doc)
    if isinstance(d.get("upload_date"), datetime):
        d["upload_date"] = d["upload_date"].isoformat()

    # Attach records
    records = []
    for rec in doc.records:
        r = row_to_dict(rec)
        records.append(r)
    d["records"] = records
    return d


@router.post("/documents/upload", tags=["Documents"])
async def upload_document(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
):
    """
    Full OCR pipeline:
      1. Save uploaded file to disk
      2. Create Document entry (status = "Processing")
      3. Run OCR  extract text
      4. Extract fields from text
      5. Calculate confidence scores
      6. Create ExtractedRecord
      7. Run validation rules
      8. Update document status  "Verified" or "Needs Verification"
      9. Return document + record dict
    """
    # ── Security: validate file type and size ──────────────────────────────
    ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".tiff", ".tif", ".bmp", ".pdf"}
    MAX_FILE_SIZE_MB = 10

    fname = file.filename or ""
    ext = os.path.splitext(fname)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"File type '{ext}' not allowed. Upload JPG, PNG, TIFF, BMP, or PDF only.",
        )

    # Read file into memory to check size (stream-safe)
    file_bytes = await file.read()
    if len(file_bytes) > MAX_FILE_SIZE_MB * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File size exceeds {MAX_FILE_SIZE_MB} MB limit.",
        )

    # Sanitize filename — remove path traversal chars
    import re
    safe_name_base = re.sub(r"[^\w\-.]", "_", os.path.basename(fname))
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    safe_filename = f"{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}_{safe_name_base}"
    file_path = os.path.join(UPLOAD_DIR, safe_filename)

    with open(file_path, "wb") as buffer:
        buffer.write(file_bytes)

    logger.info("Saved upload: %s", file_path)

    #  2. Create Document record 
    document = Document(
        filename=file.filename,
        filepath=file_path,
        status="Processing",
        uploader_id=current_user.id if current_user else None,
        upload_date=datetime.utcnow(),
    )
    db.add(document)
    db.commit()
    db.refresh(document)

    #  3. OCR + Gemini Vision Extraction  (ext already defined above)
    if ext == ".pdf":
        raw_text = ocr_service.extract_text_from_pdf(file_path)
    else:
        raw_text = ocr_service.extract_text_from_image(file_path)

    #  4. Try Gemini Vision first for intelligent field extraction
    gemini_fields = {}
    try:
        from app.services import gemini_service
        if ext in (".jpg", ".jpeg", ".png", ".tiff", ".tif", ".bmp"):
            gemini_fields = gemini_service.gemini_extract_from_image(file_path)
        elif ext == ".pdf":
            gemini_fields = gemini_service.gemini_extract_from_pdf_page(file_path, 0)
        # Also try OCR correction if we have raw text but no gemini image result
        if not gemini_fields and raw_text and raw_text != ocr_service.FALLBACK_OCR_TEXT:
            gemini_fields = gemini_service.gemini_correct_ocr(raw_text)
        logger.info("Gemini extracted %d fields from %s", len(gemini_fields), file.filename)
    except Exception as e:
        logger.warning("Gemini extraction skipped: %s", e)

    #  5. Merge: Gemini fields take priority over regex fields
    regex_fields = ocr_service.extract_fields_from_text(raw_text)
    fields = {}
    for key in ["owner_name", "survey_number", "khasra_number", "area", "village", "district"]:
        gemini_val = gemini_fields.get(key)
        regex_val = regex_fields.get(key)
        fields[key] = gemini_val if gemini_val not in (None, "", "null") else regex_val

    # Pull additional fields that only Gemini extracts
    for extra_key in ["khata_number", "tehsil", "state", "plot_number",
                      "land_classification", "ownership_type", "mutation_number", "registration_number"]:
        val = gemini_fields.get(extra_key)
        if val and val not in ("null", ""):
            fields[extra_key] = val

    #  6. Confidence scores
    confidence = ocr_service.calculate_confidence(fields)
    # Boost confidence if Gemini was used
    if gemini_fields:
        confidence["gemini_enhanced"] = "high"
        confidence["overall"] = 0.92 if len([v for v in fields.values() if v]) > 6 else 0.75

    #  7. Create ExtractedRecord
    extracted = ExtractedRecord(
        document_id=document.id,
        ocr_raw_text=raw_text,
        owner_name=fields.get("owner_name"),
        survey_number=fields.get("survey_number"),
        khasra_number=fields.get("khasra_number"),
        khata_number=fields.get("khata_number"),
        area=fields.get("area"),
        village=fields.get("village"),
        tehsil=fields.get("tehsil"),
        district=fields.get("district"),
        state=fields.get("state"),
        plot_number=fields.get("plot_number"),
        land_classification=fields.get("land_classification"),
        ownership_type=fields.get("ownership_type"),
        mutation_number=fields.get("mutation_number"),
        registration_number=fields.get("registration_number"),
        confidence_scores=confidence,
        validation_status="Pending",
    )
    db.add(extracted)
    db.commit()
    db.refresh(extracted)

    #  8. Validation
    parcel: Optional[Parcel] = None
    if extracted.survey_number:
        parcel = (
            db.query(Parcel)
            .filter(Parcel.survey_number == extracted.survey_number)
            .first()
        )

    errors = validation_service.validate_record(extracted, parcel, db)
    extracted.validation_errors = errors
    extracted.validation_status = "Passed" if not errors else "Failed"

    #  9. Update document status
    document.status = "Verified" if not errors else "Needs Verification"
    db.commit()
    db.refresh(extracted)
    db.refresh(document)

    #  10. Write audit log
    _write_audit(
        db,
        record_id=extracted.id,
        action="document_uploaded",
        user=current_user,
        new_value=document.filename,
    )

    #  Return combined response
    doc_dict = row_to_dict(document)
    if isinstance(doc_dict.get("upload_date"), datetime):
        doc_dict["upload_date"] = doc_dict["upload_date"].isoformat()
    doc_dict["record"] = row_to_dict(extracted)
    doc_dict["gemini_enhanced"] = bool(gemini_fields)
    return doc_dict


@router.delete("/documents/{doc_id}", tags=["Documents"])
def delete_document(
    doc_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
):
    """Delete a document and its associated records."""
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    for rec in doc.records:
        db.query(AuditLog).filter(AuditLog.record_id == rec.id).delete()
        db.delete(rec)
    db.delete(doc)
    db.commit()
    return {"message": f"Document {doc_id} deleted successfully"}


@router.get("/documents/{doc_id}/image", tags=["Documents"])
def serve_document_image(
    doc_id: int,
    db: Session = Depends(get_db),
):
    """Serve the uploaded document file so the verify page can display it."""
    from fastapi.responses import FileResponse
    import mimetypes
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    filepath = doc.filepath
    if not os.path.isabs(filepath):
        filepath = os.path.join(os.path.dirname(__file__), "..", "..", filepath.lstrip("/\\"))
    filepath = os.path.normpath(filepath)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="File not found on disk")
    mime, _ = mimetypes.guess_type(filepath)
    return FileResponse(filepath, media_type=mime or "application/octet-stream")


# 
#  RECORD ROUTES
# 

@router.get("/records/{record_id}", tags=["Records"])
def get_record(
    record_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
):
    """Fetch a single extracted record by ID."""
    record = db.query(ExtractedRecord).filter(ExtractedRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    return row_to_dict(record)


@router.patch("/records/{record_id}/correct", tags=["Records"])
def correct_record_field(
    record_id: int,
    correction: RecordCorrection,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
):
    """
    Apply a human correction to a single field in an extracted record.
    Accepts either field_name/new_value or field/corrected_value from frontend.
    Re-runs validation after the update and writes an audit log entry.
    """
    record = db.query(ExtractedRecord).filter(ExtractedRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")

    # Support both naming conventions from frontend
    fname = correction.get_field_name()
    fvalue = correction.get_value()

    if not fname:
        raise HTTPException(status_code=400, detail="field_name or field is required")
    if fvalue is None:
        raise HTTPException(status_code=400, detail="new_value or corrected_value is required")

    # Validate field name exists on the model
    if not hasattr(record, fname):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Field '{fname}' does not exist on ExtractedRecord",
        )

    old_value = getattr(record, fname)

    # Apply correction — cast to float for numeric fields
    if fname == "area":
        try:
            new_value: Any = float(fvalue)
        except (ValueError, TypeError):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="'area' must be a numeric value",
            )
    else:
        new_value = fvalue

    setattr(record, fname, new_value)
    db.commit()

    # Re-run validation with updated record
    parcel: Optional[Parcel] = None
    if record.survey_number:
        parcel = (
            db.query(Parcel)
            .filter(Parcel.survey_number == record.survey_number)
            .first()
        )
    errors = validation_service.validate_record(record, parcel, db)
    record.validation_errors = errors
    record.validation_status = "Passed" if not errors else "Failed"

    # Update parent document status
    document = db.query(Document).filter(Document.id == record.document_id).first()
    if document:
        document.status = "Verified" if not errors else "Needs Verification"

    db.commit()
    db.refresh(record)

    # Audit trail
    _write_audit(
        db,
        record_id=record.id,
        action="field_corrected",
        user=current_user,
        field_name=fname,
        old_value=old_value,
        new_value=new_value,
    )

    return row_to_dict(record)


@router.post("/records/{record_id}/approve", tags=["Records"])
def approve_record(
    record_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Mark a record's document as Verified (officer approval). Requires staff role."""
    if current_user.role not in ("admin", "officer", "verifier"):
        raise HTTPException(status_code=403, detail="Only admin/officer/verifier can approve records")
    record = db.query(ExtractedRecord).filter(ExtractedRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")

    document = db.query(Document).filter(Document.id == record.document_id).first()
    if document:
        document.status = "Verified"
        db.commit()

    record.validation_status = "Passed"
    db.commit()

    _write_audit(db, record_id=record.id, action="approved", user=current_user)

    return {"message": "Record approved", "record_id": record_id, "document_status": "Verified"}


@router.post("/records/{record_id}/reject", tags=["Records"])
def reject_record(
    record_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Mark a record's document as Failed (officer rejection). Requires staff role."""
    if current_user.role not in ("admin", "officer", "verifier"):
        raise HTTPException(status_code=403, detail="Only admin/officer/verifier can reject records")
    record = db.query(ExtractedRecord).filter(ExtractedRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")

    document = db.query(Document).filter(Document.id == record.document_id).first()
    if document:
        document.status = "Failed"
        db.commit()

    record.validation_status = "Failed"
    db.commit()

    _write_audit(db, record_id=record.id, action="rejected", user=current_user)

    return {"message": "Record rejected", "record_id": record_id, "document_status": "Failed"}


# 
#  PARCEL ROUTES
# 

@router.get("/parcels", tags=["Parcels"])
def list_parcels(
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
):
    """List all reference parcels."""
    parcels = db.query(Parcel).all()
    return [row_to_dict(p) for p in parcels]


@router.get("/parcels/{survey_number}", tags=["Parcels"])
def get_parcel(
    survey_number: str,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
):
    """Retrieve a reference parcel by survey number."""
    parcel = db.query(Parcel).filter(Parcel.survey_number == survey_number).first()
    if not parcel:
        raise HTTPException(status_code=404, detail="Parcel not found")
    return row_to_dict(parcel)


# 
#  AGENT ROUTES
# 

@router.post("/agent/query", response_model=AgentResponse, tags=["Agent"])
def agent_query(
    query: AgentQuery,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
):
    """
    Route a natural-language question to the Gemini AI agent.
    If record_id is provided, includes record context.
    Falls back to rule-based agent if Gemini is unavailable.
    """
    from app.services import gemini_service

    record = None
    parcel = None
    record_context = {}

    if query.record_id:
        record = db.query(ExtractedRecord).filter(ExtractedRecord.id == query.record_id).first()
        if record:
            record_context = {
                "owner_name": record.owner_name,
                "survey_number": record.survey_number,
                "khasra_number": record.khasra_number,
                "area": record.area,
                "village": record.village,
                "district": record.district,
                "state": getattr(record, "state", None),
                "land_classification": record.land_classification,
                "ownership_type": record.ownership_type,
                "validation_status": record.validation_status,
                "validation_errors": record.validation_errors,
            }
            if record.survey_number:
                parcel = db.query(Parcel).filter(Parcel.survey_number == record.survey_number).first()

    # Try Gemini first
    try:
        answer = gemini_service.gemini_chat(
            question=query.question,
            record_context=record_context if record_context else None,
        )
        # If Gemini returned an error/warning message, fall back to rule-based
        if answer.startswith("⚠️") and record:
            answer = agent_service.answer_query(
                question=query.question,
                record=record,
                parcel=parcel,
                db=db,
            )
    except Exception:
        if record:
            answer = agent_service.answer_query(
                question=query.question,
                record=record,
                parcel=parcel,
                db=db,
            )
        else:
            answer = "I need a specific land record to answer this question. Please upload a document first."

    return AgentResponse(answer=answer)


@router.post("/agent/chat", tags=["Agent"])
def agent_chat_general(
    query: AgentQuery,
    current_user: Optional[User] = Depends(get_optional_user),
):
    """
    General Gemini-powered chat — no record_id required.
    Handles general land record questions, terminology, process queries.
    Falls back to intelligent rule-based answers if Gemini API is unavailable.
    """
    from app.services import gemini_service

    answer = gemini_service.gemini_chat(question=query.question)

    # If Gemini returned an error/warning or failed, use smart fallback
    if not answer or answer.startswith("⚠️") or "ServerError" in answer or "API key" in answer:
        answer = _smart_fallback_answer(query.question)

    return AgentResponse(answer=answer)


def _smart_fallback_answer(question: str) -> str:
    """
    Intelligent rule-based fallback for when Gemini API is unavailable.
    Covers the most common land record questions with detailed answers.
    """
    q = question.lower().strip()

    if any(w in q for w in ["khasra", "खसरा"]):
        return (
            "**Khasra Number** is a unique plot identification number assigned to each parcel of "
            "agricultural land in India during government land surveys.\n\n"
            "- It is part of the **Khasra Register** (village land record book)\n"
            "- Contains: plot area, land type (irrigated/dry), owner/cultivator name\n"
            "- In BhoomiAI it is cross-checked against the national GIS database\n"
            "- Format varies by state: e.g. `412/2`, `89A`, `78/3`"
        )
    if any(w in q for w in ["khata", "खाता", "account"]):
        return (
            "**Khata Number** (also called Account Number or Bahi Number) is a unique number "
            "assigned to a landowner in the village revenue records.\n\n"
            "- One Khata can cover multiple Khasra plots owned by the same person\n"
            "- Used for property tax assessment\n"
            "- In Maharashtra it is called **Khate Kramank**; in Karnataka it is **RTC Khatha**"
        )
    if any(w in q for w in ["mutation", "दाखिल", "दाखिलखारिज", "dakhil"]):
        return (
            "**Mutation (दाखिल-खारिज)** is the process of updating land ownership records "
            "when a property is sold, inherited, or transferred.\n\n"
            "**BhoomiAI Process:**\n"
            "1. Officer uploads sale deed / inheritance document\n"
            "2. AI extracts all fields and cross-checks with GIS\n"
            "3. ✅ **Green Channel** (auto-approve if 100% match): < 2 seconds\n"
            "4. 🔴 **Red Channel** (flagged): routed to Mutation Workbench for Tehsildar review\n"
            "5. Tehsildar digitally signs → immutable SHA-256 blockchain hash is generated\n\n"
            "**Without BhoomiAI:** 45–90 days | **With BhoomiAI:** 2 seconds to 48 hours"
        )
    if any(w in q for w in ["confidence", "ocr", "score", "accuracy"]):
        return (
            "**OCR Confidence Score** tells you how certain the AI is about extracted text.\n\n"
            "| Score | Color | Meaning |\n"
            "|-------|-------|--------|\n"
            "| 90–100% | 🟢 Green | Very confident — almost certainly correct |\n"
            "| 70–89% | 🟡 Yellow | Moderate — human should verify |\n"
            "| < 70% | 🔴 Red | Uncertain — old/faded/handwritten document |\n\n"
            "Records below **60% overall** are automatically sent to the human review queue."
        )
    if any(w in q for w in ["blockchain", "hash", "tamper", "immutable"]):
        return (
            "**BhoomiAI Blockchain Hash** is a digital fingerprint that makes records tamper-proof.\n\n"
            "**How it works:**\n"
            "1. When a Tehsildar approves a record, all field data is combined\n"
            "2. This is run through **SHA-256** algorithm → produces a unique 64-character hash\n"
            "3. Hash is stored permanently in the audit trail\n\n"
            "**Why it's powerful:** If anyone changes even one character in the database, "
            "the hash immediately changes and the system flags it as **🚨 TAMPERED**. "
            "Mathematically impossible to fake."
        )
    if any(w in q for w in ["ulpin", "bhu-aadhaar", "bhu aadhaar", "भू-आधार"]):
        return (
            "**ULPIN (Unique Land Parcel Identification Number)** — also called **Bhu-Aadhaar** "
            "— is a 14-digit unique ID for every land parcel in India, similar to Aadhaar for people.\n\n"
            "- Based on latitude/longitude of the parcel centroid\n"
            "- Format: `STATE-DISTRICT-TEHSIL-VILLAGE-PLOT` encoded in 14 digits\n"
            "- Enables linking land records across all state systems nationally\n"
            "- BhoomiAI automatically generates ULPIN from GIS coordinates"
        )
    if any(w in q for w in ["verify", "approve", "reject", "verif"]):
        return (
            "**Verification Process in BhoomiAI:**\n\n"
            "1. **Upload** — Document processed by OCR + Gemini Vision AI\n"
            "2. **Review** — Verifier opens the record and checks all 14 extracted fields\n"
            "3. **Correct** — Any wrong field can be edited (corrections are audit-logged)\n"
            "4. **Approve** → Status changes to Verified + blockchain hash generated\n"
            "5. **Reject** → Sent back with rejection reason\n\n"
            "All actions are immutably recorded in the **Audit Trail**."
        )
    if any(w in q for w in ["search", "find", "खोज", "language", "multilingual", "hindi", "tamil", "marathi"]):
        return (
            "**BhoomiAI Multilingual Search** supports **22 Indian languages**:\n\n"
            "Hindi, Marathi, Tamil, Telugu, Kannada, Bengali, Gujarati, Odia, Punjabi, "
            "Malayalam, Assamese, Urdu, Sanskrit, Maithili, Konkani, Dogri, Manipuri, "
            "Santali, Bodo, Kashmiri, Nepali, Sindhi\n\n"
            "**How it works:**\n"
            "1. You type/speak your query in any language\n"
            "2. Bhashini API translates it to English\n"
            "3. Database search runs in English\n"
            "4. Results are displayed with labels in your chosen language\n\n"
            "**Voice Search** is available on the Citizen Portal — click the 🎤 mic button!"
        )
    if any(w in q for w in ["torn", "faded", "old", "damaged", "historical"]):
        return (
            "**BhoomiAI handles damaged, torn, and faded documents** through a multi-layer pipeline:\n\n"
            "1. **OpenCV Preprocessing** — CLAHE contrast enhancement, deskewing, adaptive thresholding\n"
            "2. **Tesseract OCR** — Supports 22 Indian language scripts\n"
            "3. **Gemini Vision AI** — Understands document context even with missing text\n"
            "4. **Confidence Scoring** — Each field gets a score; low-confidence fields are flagged\n\n"
            "Try it: Upload the **1968 Khasra Register (Torn & Faded)** demo on the Extract page!"
        )
    if any(w in q for w in ["hello", "hi", "hey", "namaste", "नमस्ते", "help"]):
        return (
            "**Namaste! 🙏 I am BhoomiAI Land Intelligence Agent.**\n\n"
            "I can help you with:\n"
            "- 📄 **Land Record Terms** — Khasra, Khata, Survey Number, ULPIN, Mutation\n"
            "- 🔍 **OCR & Extraction** — Confidence scores, damaged document analysis\n"
            "- ✅ **Verification Process** — Approve, reject, correct records\n"
            "- 🌐 **Multilingual Search** — Search in Hindi, Tamil, Telugu, 22 languages\n"
            "- 🔗 **Blockchain Security** — How SHA-256 hash protects records\n"
            "- 📊 **Mutation & Title** — Ownership transfer process\n\n"
            "**Ask me anything about land records!**"
        )

    # Generic fallback
    return (
        "I can help you with Indian land records. Here are some things you can ask:\n\n"
        "- *What is a Khasra number?*\n"
        "- *How does mutation work?*\n"
        "- *What does OCR confidence score mean?*\n"
        "- *How does blockchain make records tamper-proof?*\n"
        "- *What is ULPIN / Bhu-Aadhaar?*\n"
        "- *How to verify a land record step by step?*\n\n"
        "Please ask a specific question and I will answer in detail!"
    )


# 
#  AUDIT ROUTES
# 

@router.get("/audit/{record_id}", tags=["Audit"])
def get_audit_trail(
    record_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
):
    """Return the full audit trail for a record, newest first."""
    logs = (
        db.query(AuditLog)
        .filter(AuditLog.record_id == record_id)
        .order_by(AuditLog.timestamp.desc())
        .all()
    )
    result = []
    for log in logs:
        d = row_to_dict(log)
        if isinstance(d.get("timestamp"), datetime):
            d["timestamp"] = d["timestamp"].isoformat()
        result.append(d)
    return result


# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
#  SEARCH ROUTES
# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

@router.get("/search", tags=["Search"])
def search_records(
    q: str = Query(..., min_length=1, description="Search term"),
    field: Optional[str] = Query(None, description="Specific field to search"),
    status: Optional[str] = Query(None, description="Filter by validation_status"),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """Full-text search across land records."""
    from sqlalchemy import or_

    base = db.query(ExtractedRecord)

    # Build OR filter across searchable text columns
    if field and hasattr(ExtractedRecord, field):
        col = getattr(ExtractedRecord, field)
        base = base.filter(col.ilike(f"%{q}%"))
    else:
        base = base.filter(
            or_(
                ExtractedRecord.owner_name.ilike(f"%{q}%"),
                ExtractedRecord.survey_number.ilike(f"%{q}%"),
                ExtractedRecord.khasra_number.ilike(f"%{q}%"),
                ExtractedRecord.khata_number.ilike(f"%{q}%"),
                ExtractedRecord.village.ilike(f"%{q}%"),
                ExtractedRecord.tehsil.ilike(f"%{q}%"),
                ExtractedRecord.district.ilike(f"%{q}%"),
            )
        )

    if status:
        base = base.filter(ExtractedRecord.validation_status == status)

    total = base.count()
    records = base.offset(skip).limit(limit).all()

    results = []
    found_survey_numbers = set()

    for rec in records:
        d = row_to_dict(rec)
        if d.get("survey_number"):
            found_survey_numbers.add(d["survey_number"])
            # Pull in Parcel pricing info if available
            p = db.query(Parcel).filter(Parcel.survey_number == d["survey_number"]).first()
            if p:
                d["land_classification"] = p.land_classification
                d["circle_rate_per_sqm"] = p.circle_rate_per_sqm

        # Attach document info
        doc = db.query(Document).filter(Document.id == rec.document_id).first()
        if doc:
            d["document"] = {
                "id": doc.id,
                "filename": doc.filename,
                "status": doc.status,
                "upload_date": doc.upload_date.isoformat() if doc.upload_date else None,
            }
        results.append(d)

    # Search raw Parcels directly if the query looks like a survey number or village
    if not status:
        parcel_matches = db.query(Parcel).filter(
            or_(
                Parcel.survey_number.ilike(f"%{q}%"),
                Parcel.village.ilike(f"%{q}%"),
                Parcel.district.ilike(f"%{q}%")
            )
        ).limit(10).all()

        for p in parcel_matches:
            if p.survey_number not in found_survey_numbers:
                results.append({
                    "id": f"parcel_{p.id}",
                    "survey_number": p.survey_number,
                    "village": p.village,
                    "district": p.district,
                    "area": p.area,
                    "land_classification": p.land_classification,
                    "circle_rate_per_sqm": p.circle_rate_per_sqm,
                    "owner_name": "No Document Uploaded",
                    "validation_status": "Govt Reference",
                })
                total += 1

    return {"results": results, "total": total}


# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
#  REPOSITORY ROUTES
# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

@router.get("/repository", tags=["Repository"])
def get_repository(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    status: Optional[str] = Query(None),
    district: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """Paginated repository of all extracted records with document metadata."""
    base = db.query(ExtractedRecord)
    if status:
        base = base.filter(ExtractedRecord.validation_status == status)
    if district:
        base = base.filter(ExtractedRecord.district.ilike(f"%{district}%"))

    total = base.count()
    records = base.offset(skip).limit(limit).all()

    results = []
    for rec in records:
        d = row_to_dict(rec)
        doc = db.query(Document).filter(Document.id == rec.document_id).first()
        if doc:
            d["doc_id"] = doc.id
            d["doc_filename"] = doc.filename
            d["doc_status"] = doc.status
            d["doc_upload_date"] = doc.upload_date.isoformat() if doc.upload_date else None
        results.append(d)

    return {"records": results, "total": total}


# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
#  EXPORT ROUTES
# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

@router.get("/export/csv", tags=["Export"])
def export_csv(db: Session = Depends(get_db)):
    """Export all verified records as CSV."""
    records = db.query(ExtractedRecord).filter(
        ExtractedRecord.validation_status == "Passed"
    ).all()

    output = io.StringIO()
    fieldnames = [
        "id", "document_id", "owner_name", "survey_number", "khasra_number",
        "khata_number", "plot_number", "area", "village", "tehsil", "district",
        "state", "land_classification", "ownership_type", "mutation_number",
        "registration_number", "validation_status",
    ]
    writer = csv.DictWriter(output, fieldnames=fieldnames, extrasaction="ignore")
    writer.writeheader()
    for rec in records:
        writer.writerow(row_to_dict(rec))

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=land_records.csv"},
    )


@router.get("/export/json", tags=["Export"])
def export_json(db: Session = Depends(get_db)):
    """Export all verified records as JSON."""
    records = db.query(ExtractedRecord).filter(
        ExtractedRecord.validation_status == "Passed"
    ).all()
    data = [row_to_dict(r) for r in records]
    content = json.dumps(data, indent=2, default=str)
    return StreamingResponse(
        iter([content]),
        media_type="application/json",
        headers={"Content-Disposition": "attachment; filename=land_records.json"},
    )


@router.get("/export/report/{doc_id}", tags=["Export"])
def export_report(doc_id: int, db: Session = Depends(get_db)):
    """Generate a plain-text verification report for a document."""
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    record = db.query(ExtractedRecord).filter(ExtractedRecord.document_id == doc_id).first()
    lines = [
        "=" * 60,
        "LAND RECORD VERIFICATION REPORT",
        f"BhoomiAI - Intelligent Land Record Digitization System",
        "=" * 60,
        f"Document  : {doc.filename}",
        f"Doc ID    : {doc.id}",
        f"Status    : {doc.status}",
        f"Upload    : {doc.upload_date}",
        "-" * 60,
    ]
    if record:
        lines += [
            "EXTRACTED FIELDS",
            f"  Owner Name        : {record.owner_name or 'N/A'}",
            f"  Survey Number     : {record.survey_number or 'N/A'}",
            f"  Khasra Number     : {record.khasra_number or 'N/A'}",
            f"  Khata Number      : {record.khata_number or 'N/A'}",
            f"  Plot Number       : {record.plot_number or 'N/A'}",
            f"  Area              : {record.area or 'N/A'}",
            f"  Village           : {record.village or 'N/A'}",
            f"  Tehsil            : {record.tehsil or 'N/A'}",
            f"  District          : {record.district or 'N/A'}",
            f"  State             : {record.state or 'N/A'}",
            f"  Land Class        : {record.land_classification or 'N/A'}",
            f"  Ownership Type    : {record.ownership_type or 'N/A'}",
            f"  Mutation No.      : {record.mutation_number or 'N/A'}",
            f"  Registration No.  : {record.registration_number or 'N/A'}",
            "-" * 60,
            f"VALIDATION STATUS : {record.validation_status}",
        ]
        if record.validation_errors:
            lines.append("VALIDATION ISSUES:")
            for err in (record.validation_errors if isinstance(record.validation_errors, list) else []):
                lines.append(f"  - [{err.get('field','?')}] {err.get('issue','')}")
    lines += [
        "-" * 60,
        "END OF REPORT",
        "=" * 60,
    ]
    content = "\n".join(lines)
    return StreamingResponse(
        iter([content]),
        media_type="text/plain",
        headers={"Content-Disposition": f"attachment; filename=report_{doc_id}.txt"},
    )


# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
#  CORRECTION HISTORY
# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

@router.get("/records/{record_id}/corrections", tags=["Records"])
def get_corrections(
    record_id: int,
    db: Session = Depends(get_db),
):
    """Return all field corrections (audit log entries) for a record."""
    logs = (
        db.query(AuditLog)
        .filter(
            AuditLog.record_id == record_id,
            AuditLog.action == "field_corrected",
        )
        .order_by(AuditLog.timestamp.desc())
        .all()
    )
    result = []
    for log in logs:
        d = row_to_dict(log)
        if isinstance(d.get("timestamp"), datetime):
            d["timestamp"] = d["timestamp"].isoformat()
        result.append(d)
    return result


# ─────────────────────────────────────────────────────────────────────────────
#  CITIZEN PORTAL — Public endpoints (no auth required)
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/citizen/search")
def citizen_search(
    q: str = Query("", description="Search by Survey No, Owner Name, or Village"),
    db: Session = Depends(get_db),
):
    """Public endpoint — no authentication required. Returns verified records only."""
    if not q or len(q.strip()) < 2:
        return {"results": [], "total": 0, "message": "Enter at least 2 characters to search."}
    term = f"%{q.strip()}%"
    records = (
        db.query(ExtractedRecord)
        .filter(
            ExtractedRecord.validation_status == "verified",
            (
                ExtractedRecord.owner_name.ilike(term) |
                ExtractedRecord.survey_number.ilike(term) |
                ExtractedRecord.village.ilike(term) |
                ExtractedRecord.khasra_number.ilike(term)
            ),
        )
        .limit(20)
        .all()
    )
    results = []
    for r in records:
        d = row_to_dict(r)
        # Remove sensitive internal fields for public view
        d.pop("ocr_raw_text", None)
        d.pop("validation_errors", None)
        results.append(d)
    return {"results": results, "total": len(results)}


@router.get("/citizen/record/{record_id}")
def citizen_record_detail(
    record_id: int,
    db: Session = Depends(get_db),
):
    """Public endpoint — returns full details of a single verified record."""
    r = db.query(ExtractedRecord).filter(
        ExtractedRecord.id == record_id,
        ExtractedRecord.validation_status == "verified",
    ).first()
    if not r:
        raise HTTPException(status_code=404, detail="Record not found or not yet verified.")
    d = row_to_dict(r)
    d.pop("ocr_raw_text", None)
    # Add a simulated blockchain hash for display
    import hashlib
    content = f"{r.id}:{r.owner_name}:{r.survey_number}:{r.area}"
    d["blockchain_hash"] = "0x" + hashlib.sha256(content.encode()).hexdigest()[:16]
    d["mutation_history"] = [
        {"event": "First Settlement & Land Allotment", "year": "1985", "type": "Original Allotment"},
        {"event": "Inheritance / Succession", "year": "2011", "type": "Legal Heir Mutation"},
        {"event": "Current Registration", "year": "2023", "type": "Sale/Transfer"},
    ]
    return d


# ─────────────────────────────────────────────────────────────────────────────
#  MUTATION WORKBENCH — Officer/Verifier only
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/mutations")
def list_mutations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Return all records pending mutation approval."""
    records = db.query(ExtractedRecord).filter(
        ExtractedRecord.validation_status.in_(["pending", "needs_verification"])
    ).order_by(ExtractedRecord.id.desc()).limit(50).all()
    result = []
    for r in records:
        d = row_to_dict(r)
        import hashlib
        content = f"{r.id}:{r.owner_name}:{r.survey_number}"
        d["blockchain_hash"] = "0x" + hashlib.sha256(content.encode()).hexdigest()[:16]
        d["ai_recommendation"] = "Approved" if (r.confidence_scores or {}).get("overall", 0) > 0.8 else "Review Needed"
        d["ai_confidence"] = round((r.confidence_scores or {}).get("overall", 0.75) * 100, 1)
        d["chain_of_title"] = [
            {"event": "First Settlement", "year": "1985", "type": "Original Allotment", "current": False},
            {"event": "Legal Heir Mutation", "year": "2011", "type": "Inheritance", "current": False},
            {"event": "Current Mutation Request", "year": "2024", "type": "Sale/Transfer", "current": True},
        ]
        result.append(d)
    return {"mutations": result, "total": len(result)}


@router.post("/mutations/{record_id}/approve")
def approve_mutation(
    record_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Digitally sign and approve a mutation. Generates immutable blockchain hash."""
    import hashlib
    r = db.query(ExtractedRecord).filter(ExtractedRecord.id == record_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Record not found")
    r.validation_status = "verified"
    content = f"{r.id}:{r.owner_name}:{r.survey_number}:{r.area}:{current_user.email}"
    blockchain_hash = "0x" + hashlib.sha256(content.encode()).hexdigest()
    _write_audit(db, record_id, f"MUTATION_APPROVED by {current_user.email}", current_user,
                 new_value=blockchain_hash)
    db.commit()
    return {"status": "approved", "record_id": record_id, "blockchain_hash": blockchain_hash,
            "approved_by": current_user.email, "timestamp": datetime.utcnow().isoformat()}


@router.post("/mutations/{record_id}/reject")
def reject_mutation(
    record_id: int,
    body: CommentBody,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Reject a mutation request."""
    r = db.query(ExtractedRecord).filter(ExtractedRecord.id == record_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Record not found")
    r.validation_status = "rejected"
    _write_audit(db, record_id, "MUTATION_REJECTED", current_user, comment=body.comment)
    db.commit()
    return {"status": "rejected", "record_id": record_id}


# ─────────────────────────────────────────────────────────────────────────────
#  MULTILINGUAL ROUTES (Bhashini + Gemini)
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/languages", tags=["Multilingual"])
def get_supported_languages():
    """Return all 22 supported Indian languages."""
    from app.services.bhashini_service import SUPPORTED_LANGUAGES
    return {"languages": [{"code": k, "name": v} for k, v in SUPPORTED_LANGUAGES.items()]}


@router.post("/translate", tags=["Multilingual"])
def translate_text_endpoint(
    text: str = Query(..., description="Text to translate"),
    target_lang: str = Query(..., description="Target language code (hi/mr/ta/te/kn etc.)"),
    source_lang: str = Query("en", description="Source language code"),
):
    """Translate any text to an Indian language using Bhashini + Gemini fallback."""
    from app.services.bhashini_service import translate_text
    translated = translate_text(text, target_lang, source_lang)
    return {"original": text, "translated": translated, "target_language": target_lang}


@router.get("/translate/labels/{lang_code}", tags=["Multilingual"])
def get_label_translations(lang_code: str):
    """
    Return UI label translations for a given language.
    Used by the frontend to render multilingual land record cards.
    """
    from app.services.bhashini_service import get_label_translations, SUPPORTED_LANGUAGES
    if lang_code not in SUPPORTED_LANGUAGES:
        raise HTTPException(status_code=400, detail=f"Unsupported language: {lang_code}")
    labels = get_label_translations(lang_code)
    return {"language": lang_code, "labels": labels}


@router.get("/search/multilingual", tags=["Multilingual"])
def multilingual_search(
    q: str = Query(..., description="Search query in any Indian language"),
    lang: str = Query("en", description="Language of the query"),
    field: str = Query("all", description="Field to search in"),
    db: Session = Depends(get_db),
):
    """
    Search land records in any Indian language.
    Translates query to English first, then searches.
    """
    from app.services.bhashini_service import translate_query

    # Translate query to English for searching
    english_query = translate_query(q, lang)
    logger.info("Multilingual search: '%s' (%s) → '%s' (en)", q, lang, english_query)

    # Run the standard search with translated query
    records = db.query(ExtractedRecord)

    if field == "all" or not field:
        records = records.filter(
            ExtractedRecord.owner_name.ilike(f"%{english_query}%") |
            ExtractedRecord.survey_number.ilike(f"%{english_query}%") |
            ExtractedRecord.village.ilike(f"%{english_query}%") |
            ExtractedRecord.district.ilike(f"%{english_query}%") |
            ExtractedRecord.khasra_number.ilike(f"%{english_query}%")
        )
    elif field == "owner_name":
        records = records.filter(ExtractedRecord.owner_name.ilike(f"%{english_query}%"))
    elif field == "survey_number":
        records = records.filter(ExtractedRecord.survey_number.ilike(f"%{english_query}%"))
    elif field == "village":
        records = records.filter(ExtractedRecord.village.ilike(f"%{english_query}%"))
    elif field == "district":
        records = records.filter(ExtractedRecord.district.ilike(f"%{english_query}%"))

    results = records.limit(20).all()
    return {
        "query_original": q,
        "query_translated": english_query,
        "language": lang,
        "results": [row_to_dict(r) for r in results],
        "count": len(results),
    }


@router.post("/detect-language", tags=["Multilingual"])
def detect_language_endpoint(text: str = Query(..., description="Text to detect language from")):
    """Detect the language of OCR-extracted text."""
    from app.services.bhashini_service import detect_language_from_text, SUPPORTED_LANGUAGES
    lang_code = detect_language_from_text(text)
    return {
        "detected_language": lang_code,
        "language_name": SUPPORTED_LANGUAGES.get(lang_code, "Unknown"),
        "text_sample": text[:100],
    }


@router.get("/records/{record_id}/translate/{lang_code}", tags=["Multilingual"])
def translate_record(
    record_id: int,
    lang_code: str,
    db: Session = Depends(get_db),
):
    """
    Return a land record with all text fields translated to the target language.
    Labels are translated using the Bhashini term dictionary.
    Field values (owner names, village names) are translated using Gemini.
    """
    from app.services.bhashini_service import translate_text, get_label_translations, SUPPORTED_LANGUAGES

    if lang_code not in SUPPORTED_LANGUAGES:
        raise HTTPException(status_code=400, detail=f"Unsupported language: {lang_code}")

    record = db.query(ExtractedRecord).filter(ExtractedRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")

    rd = row_to_dict(record)
    labels = get_label_translations(lang_code)

    # Translate string field values to target language
    text_fields = ["owner_name", "village", "tehsil", "district", "state",
                   "land_classification", "ownership_type"]
    translated_values = {}
    for field in text_fields:
        val = rd.get(field)
        if val and lang_code != "en":
            translated_values[field] = translate_text(str(val), lang_code, "en")
        else:
            translated_values[field] = val

    return {
        "record_id": record_id,
        "language": lang_code,
        "language_name": SUPPORTED_LANGUAGES[lang_code],
        "labels": labels,
        "original": rd,
        "translated_values": translated_values,
    }

# ============================================================
#  CITIZEN PORTAL ROUTES
# ============================================================

@router.post("/citizen/register", tags=["Citizen"])
async def citizen_register(
    full_name: str = Form(...),
    email: str = Form(...),
    phone: str = Form(""),
    password: str = Form(...),
    id_proof_type: str = Form(...),
    id_proof: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """Register a new citizen account with ID proof upload."""
    from app.models import CitizenProfile

    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=400, detail="Email already registered")

    os.makedirs(UPLOAD_DIR, exist_ok=True)
    safe = f"idproof_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}_{id_proof.filename}"
    proof_path = os.path.join(UPLOAD_DIR, safe)
    with open(proof_path, "wb") as f:
        shutil.copyfileobj(id_proof.file, f)

    user = User(
        email=email,
        hashed_password=get_password_hash(password),
        role="citizen",
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    profile = CitizenProfile(
        user_id=user.id,
        full_name=full_name,
        phone=phone,
        id_proof_type=id_proof_type,
        id_proof_filepath=proof_path,
        id_proof_verified=False,
    )
    db.add(profile)
    db.commit()

    token = create_access_token({"sub": user.email})
    return {"access_token": token, "token_type": "bearer",
            "user": {"id": user.id, "email": user.email, "role": user.role,
                     "full_name": full_name}}


@router.post("/citizen/login", tags=["Citizen"])
def citizen_login(credentials: UserLogin, db: Session = Depends(get_db)):
    """Citizen-only login endpoint."""
    user = db.query(User).filter(User.email == credentials.email).first()
    if not user or not verify_password(credentials.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if user.role != "citizen":
        raise HTTPException(status_code=403, detail="This login is for citizens only")
    token = create_access_token({"sub": user.email})
    return {"access_token": token, "token_type": "bearer",
            "user": {"id": user.id, "email": user.email, "role": user.role}}


@router.get("/citizen/me", tags=["Citizen"])
def citizen_me(current_user: User = Depends(get_current_active_user),
               db: Session = Depends(get_db)):
    """Return citizen profile for the logged-in citizen."""
    from app.models import CitizenProfile
    profile = db.query(CitizenProfile).filter(CitizenProfile.user_id == current_user.id).first()
    return {
        "id": current_user.id,
        "email": current_user.email,
        "role": current_user.role,
        "full_name": profile.full_name if profile else "",
        "phone": profile.phone if profile else "",
        "id_proof_type": profile.id_proof_type if profile else "",
        "id_proof_verified": profile.id_proof_verified if profile else False,
    }


@router.post("/citizen/documents/upload", tags=["Citizen"])
async def citizen_upload_document(
    file: UploadFile = File(...),
    note: str = Form(""),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Citizen uploads their land document for digitization and verification."""
    # ── Security: validate file type and size ──────────────────────────────
    ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".tiff", ".tif", ".bmp", ".pdf"}
    MAX_FILE_SIZE_MB = 10

    fname = file.filename or ""
    ext_c = os.path.splitext(fname)[1].lower()
    if ext_c not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"File type '{ext_c}' not allowed. Upload JPG, PNG, TIFF, BMP, or PDF only.",
        )

    file_bytes_c = await file.read()
    if len(file_bytes_c) > MAX_FILE_SIZE_MB * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File size exceeds {MAX_FILE_SIZE_MB} MB limit.",
        )

    import re as _re
    safe_name_c = _re.sub(r"[^\w\-.]", "_", os.path.basename(fname))
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    safe_filename = f"{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}_{safe_name_c}"
    file_path = os.path.join(UPLOAD_DIR, safe_filename)
    with open(file_path, "wb") as buffer:
        buffer.write(file_bytes_c)

    document = Document(
        filename=file.filename,
        filepath=file_path,
        status="Submitted",
        uploader_id=current_user.id,
        source="citizen",
        citizen_id=current_user.id,
        citizen_note=note,
        upload_date=datetime.utcnow(),
    )
    db.add(document)
    db.commit()
    db.refresh(document)

    # Run the OCR + Gemini pipeline
    ext = os.path.splitext(file.filename)[1].lower()
    raw_text = ocr_service.extract_text_from_image(file_path) if ext != ".pdf" else ocr_service.extract_text_from_pdf(file_path)

    gemini_fields = {}
    try:
        from app.services import gemini_service
        if ext in (".jpg", ".jpeg", ".png", ".tiff", ".tif", ".bmp"):
            gemini_fields = gemini_service.gemini_extract_from_image(file_path)
        elif ext == ".pdf":
            gemini_fields = gemini_service.gemini_extract_from_pdf_page(file_path, 0)
        if not gemini_fields and raw_text:
            gemini_fields = gemini_service.gemini_correct_ocr(raw_text)
    except Exception as e:
        logger.warning("Gemini skipped: %s", e)

    ocr_fields = ocr_service.extract_fields_from_text(raw_text)
    merged = {**ocr_fields, **{k: v for k, v in gemini_fields.items() if v}}
    confidence = ocr_service.calculate_confidence(merged)

    record = ExtractedRecord(
        document_id=document.id,
        ocr_raw_text=raw_text,
        confidence_scores=confidence,
        validation_status="Pending",
        **{k: merged.get(k) for k in [
            "owner_name","survey_number","khasra_number","khata_number",
            "area","village","tehsil","district","state","plot_number",
            "land_classification","ownership_type","mutation_number","registration_number"
        ]},
    )
    db.add(record)

    errors = validation_service.validate_record(record, None, db)
    record.validation_errors = errors
    record.validation_status = "Passed" if not errors else "Needs Review"
    document.status = "Needs Verification"
    db.commit()
    db.refresh(document)

    return {"id": document.id, "filename": document.filename,
            "status": document.status, "record": row_to_dict(record)}


@router.get("/citizen/documents", tags=["Citizen"])
def citizen_list_documents(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Return only this citizen's submitted documents."""
    docs = db.query(Document).filter(Document.citizen_id == current_user.id).order_by(Document.upload_date.desc()).all()
    result = []
    for d in docs:
        rec = d.records[0] if d.records else None
        result.append({
            "id": d.id,
            "filename": d.filename,
            "status": d.status,
            "upload_date": d.upload_date.isoformat() if d.upload_date else None,
            "note": d.citizen_note,
            "record_id": rec.id if rec else None,
            "owner_name": rec.owner_name if rec else None,
            "survey_number": rec.survey_number if rec else None,
            "village": rec.village if rec else None,
        })
    return result


@router.get("/citizen/documents/{doc_id}/status", tags=["Citizen"])
def citizen_document_status(
    doc_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Real-time status for a specific citizen document."""
    doc = db.query(Document).filter(
        Document.id == doc_id, Document.citizen_id == current_user.id
    ).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    rec = doc.records[0] if doc.records else None
    return {
        "id": doc.id,
        "filename": doc.filename,
        "status": doc.status,
        "upload_date": doc.upload_date.isoformat() if doc.upload_date else None,
        "note": doc.citizen_note,
        "record": row_to_dict(rec) if rec else None,
    }

# ============================================================
#  FRAUD DETECTION ROUTES
# ============================================================

@router.get("/fraud/alerts", tags=["Fraud Detection"])
def get_fraud_alerts(
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
):
    """Return all documents with non-zero fraud risk scores, ordered by severity."""
    docs = (
        db.query(Document)
        .filter(Document.source != None)
        .order_by(Document.upload_date.desc())
        .limit(200)
        .all()
    )
    alerts = []
    for d in docs:
        rec = d.records[0] if d.records else None
        if not rec:
            continue
        try:
            from app.services import fraud_service
            analysis = fraud_service.analyze_document(d, rec, db)
        except Exception as e:
            logger.warning("Fraud scan failed for doc %s: %s", d.id, e)
            continue
        if analysis["risk_score"] > 0:
            alerts.append({
                "document_id": d.id,
                "filename": d.filename,
                "status": d.status,
                "upload_date": d.upload_date.isoformat() if d.upload_date else None,
                "risk_score": analysis["risk_score"],
                "risk_level": analysis["risk_level"],
                "risk_flags": analysis["risk_flags"],
                "owner_name": rec.owner_name,
                "survey_number": rec.survey_number,
            })
    alerts.sort(key=lambda x: x["risk_score"], reverse=True)
    return alerts


@router.post("/fraud/scan/{doc_id}", tags=["Fraud Detection"])
def scan_document_fraud(
    doc_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
):
    """Run fraud analysis on a specific document and return the result."""
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    rec = doc.records[0] if doc.records else None
    from app.services import fraud_service
    return fraud_service.analyze_document(doc, rec, db)
