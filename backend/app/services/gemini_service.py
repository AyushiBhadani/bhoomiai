"""
Gemini AI Service for BhoomiAI — using the NEW google-genai SDK (v2+).

Provides:
  1. gemini_chat()              - Land record Q&A (text only)
  2. gemini_extract_from_image() - Vision-based 14-field extraction from scans
  3. gemini_extract_from_pdf_page() - PDF page extraction via vision
  4. gemini_correct_ocr()       - Fix garbled OCR text
  5. gemini_translate()         - Translate land record text to English
"""

import os
import json
import logging
from typing import Optional
from pathlib import Path

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────────────────
#  Load API Key
# ─────────────────────────────────────────────────────────────────────────────

def _get_api_key() -> Optional[str]:
    """Load Gemini API key from environment or .env file."""
    key = os.environ.get("GEMINI_API_KEY", "")
    if not key:
        try:
            from dotenv import load_dotenv
            env_path = Path(__file__).parent.parent.parent / ".env"
            load_dotenv(env_path)
            key = os.environ.get("GEMINI_API_KEY", "")
        except Exception:
            pass
    return key.strip() if key and key.strip() not in ("", "AIzaSyD-your-key-here") else None


def _get_client():
    """Return a configured google.genai Client."""
    from google import genai
    key = _get_api_key()
    if not key:
        raise ValueError(
            "GEMINI_API_KEY not configured. "
            "Please open d:\\sih\\backend\\.env and set GEMINI_API_KEY=your_real_key"
        )
    return genai.Client(api_key=key)


# ─────────────────────────────────────────────────────────────────────────────
#  System prompt for land record domain
# ─────────────────────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """You are BhoomiAI, an expert AI assistant for Indian land records and land administration.

You assist government officers (Patwari, Tehsildar, Revenue Inspector) and citizens with:
- Understanding extracted land record fields (Survey No, Khasra, Khata, ULPIN, etc.)
- OCR confidence scores and what they mean for document quality
- Validation errors and how to resolve them  
- Mutation process (Dakhil-Kharij), chain-of-title, legal heir transfers
- GIS boundary mismatches and area discrepancies
- Blockchain hashing for tamper-proof records
- Indian land terminology in Hindi, Marathi, Tamil, Telugu and English
- Historical and faded document analysis
- Bhulekh, Dharani, DigiLocker integration

System context:
- App: BhoomiAI (Smart India Hackathon 2026 — Ministry of Rural Development)
- OCR Pipeline: OpenCV preprocessing + Tesseract (22 Indian languages) + Gemini Vision
- AI: Google Gemini for intelligent extraction and Q&A
- Database: PostgreSQL + PostGIS for spatial records
- Security: SHA-256 blockchain-anchored immutable audit trail
- Languages: Hindi, Marathi, Tamil, Telugu, Bengali, Gujarati, Kannada, Odia, Punjabi, etc.

Be concise, clear, and use simple language an officer can understand.
Use bullet points for lists. Use bold for key terms.
"""


# ─────────────────────────────────────────────────────────────────────────────
#  1. Gemini Chat — Land Record Q&A
# ─────────────────────────────────────────────────────────────────────────────

def gemini_chat(
    question: str,
    record_context: Optional[dict] = None,
) -> str:
    """
    Answer a question about land records using Gemini 2.0 Flash.
    Includes optional record context for specific questions.
    """
    try:
        client = _get_client()

        parts = [SYSTEM_PROMPT]
        if record_context:
            parts.append("\n\nCurrent land record under review:")
            for k, v in record_context.items():
                if v is not None and k not in ("ocr_raw_text",):
                    parts.append(f"  - {k}: {v}")
        parts.append(f"\n\nQuestion: {question}")

        response = client.models.generate_content(
            model="gemini-1.5-flash",
            contents="\n".join(parts),
        )
        return response.text.strip()

    except ValueError as e:
        return (
            f"⚠️ Gemini API key not configured.\n\n"
            f"**To fix:** Open `d:\\sih\\backend\\.env` and set your real API key:\n"
            f"`GEMINI_API_KEY=AIzaSy...your_key...`\n\n"
            f"Get your free key at: https://aistudio.google.com/apikey"
        )
    except Exception as e:
        logger.error("Gemini chat error: %s", e)
        return f"⚠️ AI service error: {type(e).__name__}. Check that your API key is valid."


# ─────────────────────────────────────────────────────────────────────────────
#  2. Gemini Vision — Extract Fields from Scanned Document Image
# ─────────────────────────────────────────────────────────────────────────────

EXTRACTION_PROMPT = """You are an expert at reading Indian land record documents.
Analyze this scanned document image carefully. It may be:
- A 7/12 Utara (Maharashtra), Jamabandi (Punjab/Haryana), Patta/Chitta (Tamil Nadu/AP)
- A Khasra register page (UP/MP/Rajasthan), RoR, or historical deed
- Handwritten, faded, torn, or photographed at an angle
- In Hindi, Marathi, Tamil, Telugu, Kannada, Odia, Bengali, Gujarati, or English

Extract ALL visible information and return ONLY a valid JSON object with these exact keys:
{
  "owner_name": "Full name of primary land owner (translate to English if in regional language)",
  "survey_number": "Survey/Gat/Khasra number (e.g. 412/2, 89A)",
  "khasra_number": "Khasra number if separately listed",
  "khata_number": "Khata or account number",
  "plot_number": "Plot number",
  "area": "Numeric area value only (e.g. 1.45)",
  "area_unit": "Unit as written (hectares/acres/bigha/guntha/sq.ft/biswa)",
  "village": "Village/Gram/Gaon name",
  "tehsil": "Tehsil/Taluka/Mandal name",
  "district": "District name",
  "state": "State name",
  "land_classification": "Type (agricultural/residential/forest/waste/Jirayat/Bagayat etc.)",
  "ownership_type": "Sole/Joint/Ancestral/Government/Pattadar etc.",
  "mutation_number": "Mutation/Dakhil-Kharij number",
  "registration_number": "Registration/Document number",
  "document_year": "Year of the document if visible",
  "original_language": "Primary language of the document",
  "ocr_confidence": "Your overall confidence: high/medium/low",
  "damage_assessment": "none/minor/moderate/severe — document damage level",
  "extraction_notes": "Any important notes about document quality, partial text, ambiguous fields"
}

Critical rules:
- If a field is not visible or not applicable, use null (not empty string, not "N/A")
- For area, extract ONLY the numeric value
- Translate regional language field values to English
- For damaged/faded documents, extract whatever is readable and note it in extraction_notes
- For handwritten text, do your best and note confidence level
- Return ONLY the JSON object — no markdown, no explanation, no preamble
"""

def gemini_extract_from_image(image_path: str) -> dict:
    """
    Use Gemini Vision to extract structured fields from a scanned land document.
    Handles faded, torn, handwritten, and multi-language documents.
    """
    try:
        from google import genai
        from google.genai import types
        from PIL import Image as PILImage

        client = _get_client()

        # Load and optionally resize image
        img = PILImage.open(image_path)
        # Convert TIFF or other formats to RGB
        if img.mode not in ("RGB", "L"):
            img = img.convert("RGB")

        response = client.models.generate_content(
            model="gemini-1.5-flash",
            contents=[EXTRACTION_PROMPT, img],
        )

        raw = response.text.strip()
        # Strip markdown code fences if present
        if "```" in raw:
            parts = raw.split("```")
            for p in parts:
                p = p.strip()
                if p.startswith("json"):
                    p = p[4:].strip()
                try:
                    return json.loads(p)
                except Exception:
                    continue

        return json.loads(raw)

    except ValueError as e:
        logger.warning("Gemini Vision not configured: %s", e)
        return {}
    except json.JSONDecodeError as e:
        logger.error("Gemini Vision returned invalid JSON: %s", e)
        return {}
    except Exception as e:
        logger.error("Gemini Vision extraction failed: %s", e)
        return {}


def gemini_extract_from_pdf_page(pdf_path: str, page_num: int = 0) -> dict:
    """Extract fields from a specific PDF page using Gemini Vision."""
    try:
        from pdf2image import convert_from_path
        import tempfile

        pages = convert_from_path(pdf_path, dpi=200, first_page=page_num+1, last_page=page_num+1)
        if not pages:
            return {}

        with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tmp:
            tmp_path = tmp.name
            pages[0].save(tmp_path, "JPEG")

        result = gemini_extract_from_image(tmp_path)
        try:
            os.unlink(tmp_path)
        except Exception:
            pass
        return result

    except Exception as e:
        logger.error("Gemini PDF extraction failed: %s", e)
        return {}


# ─────────────────────────────────────────────────────────────────────────────
#  3. Gemini OCR Correction — Fix garbled text from Tesseract
# ─────────────────────────────────────────────────────────────────────────────

def gemini_correct_ocr(raw_text: str) -> dict:
    """
    Given raw OCR text (possibly garbled), use Gemini to extract and correct
    land record fields. Text-only — no image required.
    """
    try:
        client = _get_client()

        prompt = f"""You are an expert at reading Indian land records extracted by OCR.
The following text was extracted by Tesseract OCR from a scanned document.
It may contain garbled characters, missing spaces, or OCR errors.

RAW OCR TEXT:
---
{raw_text[:3000]}
---

Extract and correct the land record information. Return ONLY valid JSON:
{{
  "owner_name": "corrected owner name",
  "survey_number": "corrected survey number",
  "khasra_number": "khasra number",
  "khata_number": "khata number",
  "area": "numeric area value only",
  "area_unit": "unit (hectares/acres/bigha)",
  "village": "village name",
  "tehsil": "tehsil name",
  "district": "district name",
  "state": "state name",
  "land_classification": "land type",
  "ownership_type": "ownership type",
  "mutation_number": "mutation number",
  "registration_number": "registration number",
  "correction_notes": "what was corrected and why"
}}

Use null for fields not found. Return ONLY JSON."""

        response = client.models.generate_content(
            model="gemini-1.5-flash",
            contents=prompt,
        )
        raw = response.text.strip()
        if "```" in raw:
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]

        return json.loads(raw.strip())

    except Exception as e:
        logger.error("Gemini OCR correction failed: %s", e)
        return {}


# ─────────────────────────────────────────────────────────────────────────────
#  4. Gemini Translation — Translate land record text to English
# ─────────────────────────────────────────────────────────────────────────────

def gemini_translate(text: str, source_language: str = "auto") -> str:
    """
    Translate land record text from any Indian language to English.
    Used when OCR extracts Hindi/Marathi/Tamil text.
    """
    try:
        client = _get_client()

        prompt = f"""Translate the following Indian land record text to English.
Keep technical terms like Khasra, Khata, Survey Number, Tehsil as-is.
Source language: {source_language}

TEXT:
{text}

Provide only the English translation, no explanation."""

        response = client.models.generate_content(
            model="gemini-1.5-flash",
            contents=prompt,
        )
        return response.text.strip()

    except Exception as e:
        logger.error("Gemini translation failed: %s", e)
        return text
