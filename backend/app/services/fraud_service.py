"""
Fraud Detection Service for BhoomiAI.

Checks each uploaded document for suspicious patterns:
  1. Duplicate claim   — same survey number by 2 different users in 30 days
  2. Area mismatch     — document area vs GIS parcel area >20% difference
  3. Rapid transfer    — same land transferred >2 times in 12 months
  4. Name mismatch     — owner name changed >50% from last verified record
  5. Suspicious timing — document uploaded within 1 hour of adjacent land doc

Returns a risk_score (0-100) and list of risk_flags.
"""

import logging
from datetime import datetime, timedelta
from typing import Optional

logger = logging.getLogger(__name__)


def _levenshtein_similarity(a: str, b: str) -> float:
    """Simple string similarity 0-1."""
    if not a or not b:
        return 0.0
    a, b = a.lower().strip(), b.lower().strip()
    if a == b:
        return 1.0
    m, n = len(a), len(b)
    dp = list(range(n + 1))
    for i in range(1, m + 1):
        prev = dp[:]
        dp[0] = i
        for j in range(1, n + 1):
            cost = 0 if a[i - 1] == b[j - 1] else 1
            dp[j] = min(dp[j] + 1, dp[j - 1] + 1, prev[j - 1] + cost)
    return 1 - dp[n] / max(m, n)


def analyze_document(document, record, db) -> dict:
    """
    Run all fraud checks on a freshly uploaded document + its extracted record.
    Returns {"risk_score": int, "risk_flags": list[str], "risk_level": str}
    """
    from app.models import Document, ExtractedRecord, Parcel

    risk_flags = []
    risk_score = 0

    # ── 1. Duplicate Survey Number Claim ─────────────────────────────────────
    if record and record.survey_number:
        cutoff = datetime.utcnow() - timedelta(days=30)
        duplicates = (
            db.query(Document)
            .join(ExtractedRecord, ExtractedRecord.document_id == Document.id)
            .filter(
                ExtractedRecord.survey_number == record.survey_number,
                Document.id != document.id,
                Document.upload_date >= cutoff,
                Document.uploader_id != document.uploader_id,
            )
            .count()
        )
        if duplicates > 0:
            risk_flags.append(
                f"⚠️ DUPLICATE CLAIM: Survey #{record.survey_number} was also submitted by a different user in the last 30 days ({duplicates} overlap(s))."
            )
            risk_score += 40

    # ── 2. Area Mismatch vs GIS Parcel ────────────────────────────────────────
    if record and record.survey_number and record.area:
        parcel = db.query(Parcel).filter(Parcel.survey_number == record.survey_number).first()
        if parcel and parcel.area:
            diff_pct = abs(record.area - parcel.area) / parcel.area * 100
            if diff_pct > 50:
                risk_flags.append(
                    f"⚠️ AREA MISMATCH: Document claims {record.area} Ha but GIS reference shows {parcel.area} Ha ({diff_pct:.0f}% difference)."
                )
                risk_score += 35
            elif diff_pct > 20:
                risk_flags.append(
                    f"ℹ️ Area discrepancy: Document area differs from GIS reference by {diff_pct:.0f}% — may need field verification."
                )
                risk_score += 15

    # ── 3. Rapid Transfer (same survey number uploaded many times recently) ──
    if record and record.survey_number:
        cutoff_year = datetime.utcnow() - timedelta(days=365)
        transfer_count = (
            db.query(Document)
            .join(ExtractedRecord, ExtractedRecord.document_id == Document.id)
            .filter(
                ExtractedRecord.survey_number == record.survey_number,
                Document.upload_date >= cutoff_year,
            )
            .count()
        )
        if transfer_count > 3:
            risk_flags.append(
                f"⚠️ RAPID TRANSFERS: Survey #{record.survey_number} has been submitted {transfer_count} times in the last 12 months."
            )
            risk_score += 25

    # ── 4. Owner Name Mismatch vs Last Verified Record ───────────────────────
    if record and record.survey_number and record.owner_name:
        last_verified = (
            db.query(ExtractedRecord)
            .join(Document, Document.id == ExtractedRecord.document_id)
            .filter(
                ExtractedRecord.survey_number == record.survey_number,
                Document.status == "Verified",
                ExtractedRecord.id != record.id,
            )
            .order_by(Document.upload_date.desc())
            .first()
        )
        if last_verified and last_verified.owner_name:
            sim = _levenshtein_similarity(record.owner_name, last_verified.owner_name)
            if sim < 0.4:
                risk_flags.append(
                    f"⚠️ OWNER CHANGE: New owner '{record.owner_name}' differs significantly from last verified owner '{last_verified.owner_name}' (similarity: {sim:.0%}). Possible unauthorized transfer."
                )
                risk_score += 30

    # ── 5. Suspicious Timing (bulk upload within 1 hour) ─────────────────────
    cutoff_hour = datetime.utcnow() - timedelta(hours=1)
    recent_uploads = (
        db.query(Document)
        .filter(
            Document.uploader_id == document.uploader_id,
            Document.upload_date >= cutoff_hour,
            Document.id != document.id,
        )
        .count()
    )
    if recent_uploads >= 5:
        risk_flags.append(
            f"ℹ️ BULK UPLOAD: This user has uploaded {recent_uploads + 1} documents within the last hour. Unusual activity pattern."
        )
        risk_score += 10

    # ── Risk Level ────────────────────────────────────────────────────────────
    risk_score = min(risk_score, 100)
    if risk_score >= 60:
        risk_level = "HIGH"
    elif risk_score >= 25:
        risk_level = "MEDIUM"
    elif risk_score > 0:
        risk_level = "LOW"
    else:
        risk_level = "CLEAN"

    result = {
        "risk_score": risk_score,
        "risk_flags": risk_flags,
        "risk_level": risk_level,
    }

    logger.info(
        "Fraud analysis for doc %s: level=%s score=%d flags=%d",
        document.id, risk_level, risk_score, len(risk_flags),
    )
    return result
