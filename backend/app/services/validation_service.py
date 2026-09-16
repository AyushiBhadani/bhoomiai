"""
Validation Service for the BhoomiAI Land Record System.

Applies a rule-based engine to an ExtractedRecord and returns a list of
validation error dicts.  Each error looks like:
    {"field": "<field_name>", "issue": "<human-readable description>"}

Rules enforced:
  1. Required fields  owner_name, survey_number, area must be present
  2. Area range       must be between 0.01 and 10,000
  3. Area mismatch    difference with parcel reference > 20% is flagged
  4. Survey format    must match patterns like "123/7", "99A", "45-B"
  5. Duplicate check  another record with same survey_number but different
                       owner is flagged as a potential duplicate
"""

import re
import logging
from typing import Optional

from sqlalchemy.orm import Session

from app.models import ExtractedRecord, Parcel

logger = logging.getLogger(__name__)


# 
#  Main Validation Entry Point
# 

def validate_record(
    record: ExtractedRecord,
    parcel: Optional[Parcel],
    db: Session,
) -> list[dict]:
    """
    Run all validation rules against a record.

    Args:
        record: The ExtractedRecord to validate.
        parcel: A matching Parcel from the reference database (may be None).
        db:     Active SQLAlchemy session (needed for duplicate check).

    Returns:
        List of dicts, each with keys 'field' and 'issue'.
        Empty list means validation passed.
    """
    errors: list[dict] = []

    errors.extend(_check_required_fields(record))
    errors.extend(_check_area_range(record))
    errors.extend(_check_area_mismatch(record, parcel))
    errors.extend(_check_survey_number_format(record))
    errors.extend(_check_duplicates(record, db))

    return errors


# 
#  Rule 1  Required fields
# 

def _check_required_fields(record: ExtractedRecord) -> list[dict]:
    """owner_name, survey_number, and area are mandatory."""
    errors = []
    required = {
        "owner_name": "Owner name is required but was not extracted from the document.",
        "survey_number": "Survey number is required but was not found in the document.",
        "area": "Land area is required but could not be parsed from the document.",
    }
    for field, message in required.items():
        if getattr(record, field) is None or str(getattr(record, field)).strip() == "":
            errors.append({"field": field, "issue": message})
    return errors


# 
#  Rule 2  Area plausibility
# 

def _check_area_range(record: ExtractedRecord) -> list[dict]:
    """Area must fall in the realistic range [0.01, 10000]."""
    if record.area is None:
        return []  # Already caught by required-fields rule
    if not (0.01 <= record.area <= 10_000):
        return [
            {
                "field": "area",
                "issue": (
                    f"Area value {record.area} is outside the valid range "
                    "(0.01  10,000). Please verify the document."
                ),
            }
        ]
    return []


# 
#  Rule 3  Area mismatch with parcel reference
# 

def _check_area_mismatch(
    record: ExtractedRecord,
    parcel: Optional[Parcel],
) -> list[dict]:
    """Flag if extracted area differs from the parcel reference by more than 20%."""
    if parcel is None or record.area is None or parcel.area is None:
        return []

    reference = parcel.area
    difference_pct = abs(record.area - reference) / reference * 100

    if difference_pct > 20:
        return [
            {
                "field": "area",
                "issue": (
                    f"Extracted area ({record.area}) differs by "
                    f"{difference_pct:.1f}% from the parcel reference "
                    f"({reference}). Threshold is 20%."
                ),
            }
        ]
    return []


# 
#  Rule 4  Survey number format
# 

# Valid formats: "123", "123/7", "99A", "45-B", "123/7A", etc.
_SURVEY_PATTERN = re.compile(r"^\d+(?:[\/\-]\d*[A-Za-z]?)?[A-Za-z]?$")


def _check_survey_number_format(record: ExtractedRecord) -> list[dict]:
    """Survey number must conform to standard sub-division notation."""
    if record.survey_number is None:
        return []  # Caught by required-fields rule
    if not _SURVEY_PATTERN.match(record.survey_number.strip()):
        return [
            {
                "field": "survey_number",
                "issue": (
                    f"Survey number '{record.survey_number}' does not match "
                    "the expected format (e.g. '123/7', '99A', '45-B')."
                ),
            }
        ]
    return []


# 
#  Rule 5  Duplicate survey number with different owner
# 

def _check_duplicates(record: ExtractedRecord, db: Session) -> list[dict]:
    """Detect another verified record with the same survey number but different owner."""
    if record.survey_number is None or record.owner_name is None:
        return []

    duplicate = (
        db.query(ExtractedRecord)
        .filter(
            ExtractedRecord.survey_number == record.survey_number,
            ExtractedRecord.id != record.id,  # exclude self
        )
        .first()
    )

    if duplicate and duplicate.owner_name:
        # Normalize for comparison (lower-case, strip whitespace)
        if duplicate.owner_name.strip().lower() != record.owner_name.strip().lower():
            return [
                {
                    "field": "survey_number",
                    "issue": (
                        f"Survey number '{record.survey_number}' already exists "
                        f"for owner '{duplicate.owner_name}' (Record ID {duplicate.id}). "
                        "Possible duplicate or ownership dispute."
                    ),
                }
            ]
    return []
