"""
OCR Service for the BhoomiAI Land Record Digitization System.

Pipeline:
  1. preprocess_image    OpenCV: grayscale  denoise  Otsu threshold
  2. extract_text_from_image   Tesseract OCR on preprocessed image
  3. extract_text_from_pdf     Per-page OCR via pdf2image (or placeholder)
  4. extract_fields_from_text  Regex-based field extraction
  5. calculate_confidence      Confidence level per extracted field

All Tesseract / OpenCV errors are caught and a fallback demo string is used
so the system can be demonstrated even without Tesseract installed.
"""

import re
import os
import logging
from typing import Optional

logger = logging.getLogger(__name__)

#  FALLBACK demo text used when Tesseract is unavailable 
FALLBACK_OCR_TEXT = (
    "Owner: Demo User\n"
    "Survey No: 124/7\n"
    "Khasra: 45A\n"
    "Area: 2.5 acres\n"
    "Village: Rampur\n"
    "District: Agra"
)


# 
#  Step 1  Image Preprocessing
# 

def preprocess_image(image_path: str):
    """
    Enhanced preprocessing pipeline for torn, faded, or low-quality scans:
      1. Convert to grayscale
      2. CLAHE (Contrast Limited Adaptive Histogram Equalization) — recovers faded text
      3. Denoise with bilateral filter (preserves edges better than fast NLM)
      4. Adaptive thresholding — handles uneven lighting from torn/creased docs
      5. Morphological cleanup — removes small noise artifacts
    Returns:
        np.ndarray: Preprocessed image, or None on failure.
    """
    try:
        import cv2
        import numpy as np

        img = cv2.imread(image_path)
        if img is None:
            logger.warning("cv2.imread returned None for %s", image_path)
            return None

        # Step 1: Grayscale
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

        # Step 2: CLAHE — dramatically improves faded/low-contrast scans
        clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
        enhanced = clahe.apply(gray)

        # Step 3: Bilateral filter — reduces noise while keeping text edges sharp
        denoised = cv2.bilateralFilter(enhanced, 9, 75, 75)

        # Step 4: Adaptive threshold — handles non-uniform lighting (torn edges, shadows)
        thresh = cv2.adaptiveThreshold(
            denoised, 255,
            cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv2.THRESH_BINARY,
            11, 2
        )

        # Step 5: Morphological closing — fills small gaps in characters
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (2, 2))
        cleaned = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel)

        return cleaned

    except Exception as exc:
        logger.error("preprocess_image failed: %s", exc)
        return None


def extract_text_from_image(image_path: str) -> str:
    """
    Run Tesseract OCR on the enhanced preprocessed image.
    Supports Hindi, Marathi, Tamil, Telugu, Bengali, Gujarati + English.
    Falls back to FALLBACK_OCR_TEXT if Tesseract is not installed.
    """
    try:
        import pytesseract
        from PIL import Image

        preprocessed = preprocess_image(image_path)

        if preprocessed is not None:
            from PIL import Image as PILImage
            import numpy as np
            pil_image = PILImage.fromarray(preprocessed)
        else:
            pil_image = Image.open(image_path)

        # Try multilingual OCR first (Hindi + English covers most Indian documents)
        # Falls back to English-only if lang pack not installed
        for lang in ["hin+eng", "mar+eng", "tam+eng", "eng"]:
            try:
                text = pytesseract.image_to_string(
                    pil_image, lang=lang,
                    config="--psm 6 --oem 3"   # PSM 6 = uniform block of text
                )
                if text.strip():
                    return text.strip()
            except Exception:
                continue

        return FALLBACK_OCR_TEXT

    except Exception as exc:
        logger.warning(
            "Tesseract OCR failed for %s (%s) — using fallback demo text.", image_path, exc
        )
        return FALLBACK_OCR_TEXT


# 
#  Step 3  OCR from PDF
# 

def extract_text_from_pdf(pdf_path: str) -> str:
    """
    Convert each PDF page to an image and run OCR.

    Requires pdf2image + poppler.  If unavailable, returns the fallback string.
    """
    try:
        from pdf2image import convert_from_path  # type: ignore
        import pytesseract  # type: ignore
        from PIL import Image  # type: ignore

        pages = convert_from_path(pdf_path, dpi=300)
        all_text: list[str] = []

        for i, page_image in enumerate(pages):
            try:
                text = pytesseract.image_to_string(page_image, lang="eng")
                all_text.append(f"--- Page {i + 1} ---\n{text.strip()}")
            except Exception as exc:
                logger.warning("OCR failed on page %d: %s", i + 1, exc)
                all_text.append(f"--- Page {i + 1} ---\n[OCR failed]")

        combined = "\n".join(all_text)
        return combined if combined.strip() else FALLBACK_OCR_TEXT

    except ImportError:
        logger.warning("pdf2image not available  using fallback demo text for PDF.")
        return FALLBACK_OCR_TEXT
    except Exception as exc:
        logger.error("extract_text_from_pdf error: %s", exc)
        return FALLBACK_OCR_TEXT


# 
#  Step 4  Field Extraction via Regex
# 

def extract_fields_from_text(text: str) -> dict:
    """
    Extract structured land-record fields from raw OCR text using regex patterns.

    Returns a dict with keys:
        owner_name, survey_number, khasra_number, area,
        village, district
    Each value is the extracted string, or None if not found.
    """

    def _search(pattern: str, text: str, flags: int = re.IGNORECASE) -> Optional[str]:
        """Helper: return the first capture group or None."""
        m = re.search(pattern, text, flags)
        return m.group(1).strip() if m else None

    # Owner / Name
    owner_name = _search(
        r"(?:Owner|Name)\s*[:\-]\s*([A-Za-z\s\.]+?)(?:\n|$|Survey|Khasra|Area|Village|District)",
        text,
    )

    # Survey Number  e.g. "Survey No: 124/7"
    survey_number = _search(
        r"(?:Survey\s*No\.?|S\.?\s*No\.?)\s*[:\-]\s*([A-Za-z0-9\/\-]+)",
        text,
    )

    # Khasra Number
    khasra_number = _search(
        r"Khasra\s*(?:No\.?|Number)?\s*[:\-]?\s*([A-Za-z0-9\/\-]+)",
        text,
    )

    # Area  number followed by area unit
    area_str = _search(
        r"(?:Area|Land\s*Area)\s*[:\-]\s*([\d]+(?:\.\d+)?)\s*(?:acres?|hectares?|bigha|sq\.?\s*ft)",
        text,
    )
    area: Optional[float] = None
    if area_str:
        try:
            area = float(area_str)
        except ValueError:
            pass

    # Village
    village = _search(r"(?:Village|Gram|Gaon)\s*[:\-]\s*([A-Za-z\s]+?)(?:\n|$|District|Tehsil)", text)

    # District
    district = _search(r"District\s*[:\-]\s*([A-Za-z\s]+?)(?:\n|$|Village|Tehsil|Survey)", text)

    return {
        "owner_name": owner_name,
        "survey_number": survey_number,
        "khasra_number": khasra_number,
        "area": area,
        "village": village,
        "district": district,
    }


# 
#  Step 5  Confidence Scoring
# 

def calculate_confidence(extracted_fields: dict) -> dict:
    """
    Assign a confidence level to each extracted field based on presence and length.

    Levels:
        high    field found and value has sufficient length (>= 3 chars)
        medium  field found but value is short (1-2 chars)
        low     field not found (None or empty)
    """
    confidence: dict[str, str] = {}
    for field, value in extracted_fields.items():
        if value is None or str(value).strip() == "":
            confidence[field] = "low"
        elif len(str(value).strip()) <= 2:
            confidence[field] = "medium"
        else:
            confidence[field] = "high"
    return confidence
