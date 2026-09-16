"""
Land Record Intelligence Agent Service.

A rule-based question-answering system that answers natural-language questions
about a specific ExtractedRecord.  No external AI API is required.

Supported topics detected via keyword matching:
  - area / size           → area information vs parcel reference
  - owner / name          → owner name and ownership type
  - valid / error         → validation summary
  - survey / parcel       → survey/parcel details
  - confidence / sure     → confidence scores summary
  - correction / history  → correction history summary (DB lookup)
  - duplicate / same      → duplicate record check by survey_number (DB lookup)
  - missing               → list all None/null fields
  - summarize / summary   → comprehensive record summary
  - map / location        → parcel location info
  - compare               → compare extracted values to parcel reference
  - (default)             → full record summary
"""

import logging
from typing import Optional, Any

from sqlalchemy.orm import Session

from app.models import ExtractedRecord, Parcel, AuditLog

logger = logging.getLogger(__name__)



# ?????????????????????????????????????????????
#  Main Entry Point
# ?????????????????????????????????????????????

def answer_query(
    question: str,
    record: ExtractedRecord,
    parcel: Optional[Parcel],
    db: Optional[Session] = None,
) -> str:
    """
    Analyse the question and return a relevant plain-text answer about the record.

    Args:
        question: Natural-language question string from the user.
        record:   ExtractedRecord being queried.
        parcel:   Matching Parcel from reference DB (may be None).
        db:       SQLAlchemy session for DB lookups (duplicate check, history).

    Returns:
        A human-readable answer string.
    """
    q = question.lower().strip()

    # ── Topic: Correction history ──────────────────────────────────────────
    if any(kw in q for kw in ["correction", "history", "changed", "edit log"]):
        return _answer_correction_history(record, db)

    # ── Topic: Duplicate / same survey number ──────────────────────────────
    if any(kw in q for kw in ["duplicate", "same survey", "already exists", "other record"]):
        return _answer_duplicate_check(record, db)

    # ── Topic: Missing fields ──────────────────────────────────────────────
    if any(kw in q for kw in ["missing", "null", "empty", "not extracted", "blank"]):
        return _answer_missing_fields(record)

    # ── Topic: Summarize ──────────────────────────────────────────────────
    if any(kw in q for kw in ["summarize", "summary", "overview", "brief"]):
        return _answer_summary(record, parcel)

    # ── Topic: Map / Location ─────────────────────────────────────────────
    if any(kw in q for kw in ["map", "location", "where", "coordinates", "polygon", "geo"]):
        return _answer_location(record, parcel)

    # ── Topic: Compare to parcel ──────────────────────────────────────────
    if any(kw in q for kw in ["compare", "match", "reference", "difference", "discrepancy"]):
        return _answer_compare(record, parcel)

    # ── Topic: Area / Size ────────────────────────────────────────────────
    if any(kw in q for kw in ["area", "size", "land size", "how big", "hectare", "acre", "bigha"]):
        return _answer_area(record, parcel)

    # ── Topic: Owner / Name ───────────────────────────────────────────────
    if any(kw in q for kw in ["owner", "name", "who owns", "ownership"]):
        return _answer_owner(record)

    # ── Topic: Validation / Errors / Issues ──────────────────────────────
    if any(kw in q for kw in ["valid", "error", "issue", "problem", "correct", "flag", "warning"]):
        return _answer_validation(record)

    # ── Topic: Survey / Parcel details ───────────────────────────────────
    if any(kw in q for kw in ["survey", "parcel", "khasra", "khata", "number"]):
        return _answer_survey(record, parcel)

    # ── Topic: Confidence / Certainty ────────────────────────────────────
    if any(kw in q for kw in ["confidence", "sure", "certain", "accurate", "reliable", "trust"]):
        return _answer_confidence(record)

    # ── Default: Full summary ─────────────────────────────────────────────
    return _answer_summary(record, parcel)


# ?????????????????????????????????????????????
#  Topic Handlers
# ?????????????????????????????????????????????

def _answer_area(record: ExtractedRecord, parcel: Optional[Parcel]) -> str:
    """Return area info and compare with parcel reference if available."""
    if record.area is None:
        return (
            "The area could not be extracted from the document. "
            "Please manually enter the land area in the correction panel."
        )

    answer = f"The extracted land area is **{record.area} acres**."

    if parcel and parcel.area is not None:
        diff_pct = abs(record.area - parcel.area) / parcel.area * 100
        answer += (
            f"\n\nThe government parcel reference for survey number "
            f"'{parcel.survey_number}' records an area of **{parcel.area} acres**."
        )
        if diff_pct <= 5:
            answer += " ? The values are in close agreement (within 5%)."
        elif diff_pct <= 20:
            answer += (
                f" ?? There is a {diff_pct:.1f}% difference ? within the acceptable 20% threshold."
            )
        else:
            answer += (
                f" ? There is a significant {diff_pct:.1f}% discrepancy, which exceeds "
                "the 20% validation threshold. This requires manual review."
            )
    else:
        answer += "\n\nNo parcel reference record found for comparison."

    return answer


def _answer_owner(record: ExtractedRecord) -> str:
    """Return owner details."""
    if record.owner_name is None:
        return (
            "Owner name could not be extracted from the document. "
            "Please verify the original document and enter it manually."
        )

    answer = f"The extracted owner name is **{record.owner_name}**."
    if record.ownership_type:
        answer += f" Ownership type is recorded as **{record.ownership_type}**."
    else:
        answer += " No ownership type was extracted."
    return answer


def _answer_validation(record: ExtractedRecord) -> str:
    """Summarise validation errors."""
    errors = record.validation_errors or []

    if not errors:
        return (
            f"? This record has passed all validation checks. "
            f"Validation status: **{record.validation_status}**."
        )

    lines = [
        f"?? This record has **{len(errors)} validation issue(s)**:",
        f"Overall status: **{record.validation_status}**.",
        "",
    ]
    for i, err in enumerate(errors, 1):
        field = err.get("field", "unknown")
        issue = err.get("issue", "No details.")
        lines.append(f"{i}. **{field}**: {issue}")

    return "\n".join(lines)


def _answer_survey(record: ExtractedRecord, parcel: Optional[Parcel]) -> str:
    """Return survey/parcel details."""
    parts: list[str] = []

    survey = record.survey_number or "Not extracted"
    khasra = record.khasra_number or "Not extracted"
    khata = record.khata_number or "Not extracted"

    parts.append(f"**Survey Number:** {survey}")
    parts.append(f"**Khasra Number:** {khasra}")
    parts.append(f"**Khata Number:** {khata}")

    if parcel:
        parts.append("")
        parts.append("**Parcel Reference Data:**")
        parts.append(f"  - Village: {parcel.village or 'Unknown'}")
        parts.append(f"  - Parcel Area: {parcel.area or 'Unknown'} acres")
        if parcel.geometry_geojson:
            parts.append("  - ? Geo-spatial polygon available")
        else:
            parts.append("  - ?? No geo-spatial polygon on file")
    else:
        parts.append("\nNo matching parcel found in the reference database.")

    return "\n".join(parts)


def _answer_confidence(record: ExtractedRecord) -> str:
    """Summarise confidence scores for each extracted field."""
    scores = record.confidence_scores or {}

    if not scores:
        return "Confidence scores are not available for this record."

    high = [f for f, v in scores.items() if v == "high"]
    medium = [f for f, v in scores.items() if v == "medium"]
    low = [f for f, v in scores.items() if v == "low"]

    lines = ["**OCR Confidence Summary:**", ""]
    if high:
        lines.append(f"? High confidence: {', '.join(high)}")
    if medium:
        lines.append(f"?? Medium confidence: {', '.join(medium)}")
    if low:
        lines.append(f"? Low confidence (needs review): {', '.join(low)}")

    overall = (
        "Overall quality: **Good**"
        if len(low) == 0
        else f"Overall quality: **Needs Review** ({len(low)} field(s) undetected)"
    )
    lines.append("")
    lines.append(overall)
    return "\n".join(lines)


def _answer_summary(record: ExtractedRecord, parcel: Optional[Parcel]) -> str:
    """Return a full summary of key record fields."""
    lines = [
        "**Land Record Summary:**",
        "",
        f"- **Owner:** {record.owner_name or 'Not extracted'}",
        f"- **Survey No:** {record.survey_number or 'Not extracted'}",
        f"- **Khasra No:** {record.khasra_number or 'Not extracted'}",
        f"- **Plot No:** {getattr(record, 'plot_number', None) or 'Not extracted'}",
        f"- **Area:** {record.area or 'Not extracted'} acres",
        f"- **Village:** {record.village or 'Not extracted'}",
        f"- **Tehsil:** {record.tehsil or 'Not extracted'}",
        f"- **District:** {record.district or 'Not extracted'}",
        f"- **State:** {getattr(record, 'state', None) or 'Not extracted'}",
        f"- **Land Classification:** {record.land_classification or 'Not extracted'}",
        f"- **Ownership Type:** {record.ownership_type or 'Not extracted'}",
        f"- **Validation Status:** {record.validation_status or 'Pending'}",
    ]

    errors = record.validation_errors or []
    if errors:
        lines.append(f"- ⚠️ **{len(errors)} validation issue(s)** detected")

    if parcel:
        lines.append(f"- ✅ Parcel reference found (Area: {parcel.area} acres)")
    else:
        lines.append("- ⚠️ No parcel reference on file")

    return "\n".join(lines)


# ─────────────────────────────────────────────
#  New Topic Handlers
# ─────────────────────────────────────────────

# All string-typed fields we can check for None
_FIELD_NAMES = [
    "owner_name", "survey_number", "khasra_number", "khata_number",
    "area", "village", "tehsil", "district", "state", "plot_number",
    "land_classification", "ownership_type", "mutation_number", "registration_number",
]


def _answer_correction_history(
    record: ExtractedRecord,
    db: Optional[Session],
) -> str:
    """Return a summary of all field corrections made to this record."""
    if db is None:
        return "Database session is not available to retrieve correction history."

    logs = (
        db.query(AuditLog)
        .filter(
            AuditLog.record_id == record.id,
            AuditLog.action == "field_corrected",
        )
        .order_by(AuditLog.timestamp.desc())
        .all()
    )

    if not logs:
        return (
            f"No corrections have been made to record #{record.id} yet. "
            "All values are as originally extracted by OCR."
        )

    lines = [f"**Correction History for Record #{record.id}:**", ""]
    for i, log in enumerate(logs, 1):
        ts = log.timestamp.strftime("%Y-%m-%d %H:%M") if log.timestamp else "Unknown time"
        user_info = f"User #{log.user_id}" if log.user_id else "Anonymous"
        comment = f" — *{log.comment}*" if getattr(log, "comment", None) else ""
        lines.append(
            f"{i}. [{ts}] **{log.field_name}**: "
            f"`{log.old_value}` → `{log.new_value}` "
            f"(by {user_info}){comment}"
        )

    return "\n".join(lines)


def _answer_duplicate_check(
    record: ExtractedRecord,
    db: Optional[Session],
) -> str:
    """Check whether other records share the same survey number."""
    if not record.survey_number:
        return (
            "This record has no survey number extracted, "
            "so a duplicate check cannot be performed."
        )

    if db is None:
        return "Database session is not available to perform duplicate check."

    from app.models import ExtractedRecord as ER  # local to avoid circular

    duplicates = (
        db.query(ER)
        .filter(
            ER.survey_number == record.survey_number,
            ER.id != record.id,
        )
        .all()
    )

    if not duplicates:
        return (
            f"✅ No duplicate records found for survey number **{record.survey_number}**. "
            "This appears to be unique in the database."
        )

    lines = [
        f"⚠️ Found **{len(duplicates)} duplicate record(s)** with survey number "
        f"**{record.survey_number}**:",
        "",
    ]
    for dup in duplicates:
        lines.append(
            f"- Record #{dup.id} (Document #{dup.document_id}) — "
            f"Owner: {dup.owner_name or 'Unknown'}, "
            f"Status: {dup.validation_status or 'Unknown'}"
        )

    return "\n".join(lines)


def _answer_missing_fields(record: ExtractedRecord) -> str:
    """List all fields that are None or empty on this record."""
    missing = []
    for field in _FIELD_NAMES:
        val = getattr(record, field, None)
        if val is None or val == "":
            missing.append(field)

    if not missing:
        return "✅ All key fields have been extracted successfully. No missing values."

    lines = [
        f"⚠️ **{len(missing)} field(s) are missing** from this record:",
        "",
    ]
    for f in missing:
        lines.append(f"- `{f}`")

    lines.append("")
    lines.append(
        "Please use the correction panel to manually enter any missing values "
        "that can be found in the original document."
    )
    return "\n".join(lines)


def _answer_location(record: ExtractedRecord, parcel: Optional[Parcel]) -> str:
    """Return the geographic/administrative location details of the parcel."""
    # Administrative location from extracted record
    parts = ["**Parcel Location Information:**", ""]

    parts.append(f"- **Village:** {record.village or 'Not extracted'}")
    parts.append(f"- **Tehsil:** {record.tehsil or 'Not extracted'}")
    parts.append(f"- **District:** {record.district or 'Not extracted'}")
    state_val = getattr(record, "state", None)
    parts.append(f"- **State:** {state_val or 'Not extracted'}")
    parts.append(f"- **Survey No:** {record.survey_number or 'Not extracted'}")
    plot_val = getattr(record, "plot_number", None)
    parts.append(f"- **Plot Number:** {plot_val or 'Not extracted'}")

    if parcel:
        parts.append("")
        parts.append("**Reference Parcel:**")
        parts.append(f"- Parcel village: {parcel.village or 'Unknown'}")
        if parcel.geometry_geojson:
            parts.append("- ✅ GeoJSON polygon is available for this parcel")
        else:
            parts.append("- ⚠️ No geo-spatial polygon stored for this parcel")
    else:
        parts.append("")
        parts.append(
            "⚠️ No reference parcel found in the spatial database for "
            f"survey number '{record.survey_number or 'N/A'}'."
        )

    return "\n".join(parts)


def _answer_compare(record: ExtractedRecord, parcel: Optional[Parcel]) -> str:
    """Compare the extracted record values against the parcel reference data."""
    if not parcel:
        return (
            f"⚠️ No reference parcel found for survey number "
            f"**{record.survey_number or 'N/A'}**. "
            "Comparison is not possible."
        )

    lines = [
        f"**Comparison: Extracted Record vs. Parcel Reference (Survey: {parcel.survey_number})**",
        "",
        "| Field | Extracted Value | Reference Value | Match |",
        "|-------|----------------|-----------------|-------|",
    ]

    # Area comparison
    if record.area is not None and parcel.area is not None:
        diff_pct = abs(record.area - parcel.area) / parcel.area * 100 if parcel.area else 0
        match_icon = "✅" if diff_pct <= 5 else ("⚠️" if diff_pct <= 20 else "❌")
        lines.append(
            f"| Area | {record.area} acres | {parcel.area} acres | "
            f"{match_icon} {diff_pct:.1f}% diff |"
        )
    else:
        area_ext = str(record.area) if record.area is not None else "Missing"
        area_ref = str(parcel.area) if parcel.area is not None else "Missing"
        lines.append(f"| Area | {area_ext} | {area_ref} | ⚠️ Cannot compare |")

    # Village comparison
    village_match = (
        "✅" if record.village and parcel.village and
        record.village.lower().strip() == parcel.village.lower().strip()
        else "❌"
    )
    lines.append(
        f"| Village | {record.village or 'Missing'} | {parcel.village or 'N/A'} | "
        f"{village_match} |"
    )

    # Survey number (should always match since parcel was looked up by it)
    lines.append(
        f"| Survey No | {record.survey_number or 'Missing'} | {parcel.survey_number} | ✅ |"
    )

    lines.append("")
    lines.append(
        "Legend: ✅ = match / within 5%  ⚠️ = minor discrepancy  ❌ = significant mismatch"
    )

    return "\n".join(lines)
