"""
Bhashini Multilingual Service for BhoomiAI.

Provides translation for land records across 22 Indian languages using:
  1. Bhashini API (official Govt of India NLP pipeline) — primary
  2. Gemini AI — intelligent fallback with land-record domain knowledge

Supported languages:
  Hindi (hi), Marathi (mr), Tamil (ta), Telugu (te), Kannada (kn),
  Bengali (bn), Gujarati (gu), Odia (or), Punjabi (pa), Malayalam (ml),
  Assamese (as), Urdu (ur), Sanskrit (sa), Nepali (ne), Sindhi (sd),
  Maithili (mai), Kashmiri (ks), Dogri (doi), Bodo (brx),
  Manipuri (mni), Santali (sat), Konkani (kok)

Usage:
  from app.services.bhashini_service import translate_to_language, detect_language
"""

import os
import json
import logging
import requests
from typing import Optional

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────────────────
#  Language Registry
# ─────────────────────────────────────────────────────────────────────────────

SUPPORTED_LANGUAGES = {
    "hi": "Hindi",
    "mr": "Marathi",
    "ta": "Tamil",
    "te": "Telugu",
    "kn": "Kannada",
    "bn": "Bengali",
    "gu": "Gujarati",
    "or": "Odia",
    "pa": "Punjabi",
    "ml": "Malayalam",
    "as": "Assamese",
    "ur": "Urdu",
    "en": "English",
    "mai": "Maithili",
    "kok": "Konkani",
    "doi": "Dogri",
    "mni": "Manipuri",
    "sat": "Santali",
    "sa": "Sanskrit",
    "brx": "Bodo",
    "ks": "Kashmiri",
    "ne": "Nepali",
    "sd": "Sindhi",
}

# Land record terminology translations (key terms kept consistent)
LAND_TERMS = {
    "hi": {
        "Survey Number": "सर्वेक्षण संख्या",
        "Khasra Number": "खसरा संख्या",
        "Owner Name": "स्वामी का नाम",
        "Village": "ग्राम",
        "Tehsil": "तहसील",
        "District": "जिला",
        "Area": "क्षेत्रफल",
        "Land Classification": "भूमि वर्गीकरण",
        "Ownership Type": "स्वामित्व प्रकार",
        "Mutation Number": "दाखिल-खारिज संख्या",
        "Record of Rights": "अधिकार अभिलेख",
        "Verified": "सत्यापित",
        "Pending": "लंबित",
    },
    "mr": {
        "Survey Number": "सर्व्हे क्रमांक",
        "Khasra Number": "खसरा क्रमांक",
        "Owner Name": "मालकाचे नाव",
        "Village": "गाव",
        "Tehsil": "तालुका",
        "District": "जिल्हा",
        "Area": "क्षेत्रफळ",
        "Land Classification": "जमीन वर्गीकरण",
        "Ownership Type": "मालकी प्रकार",
        "Mutation Number": "फेरफार क्रमांक",
        "Record of Rights": "हक्क नोंद",
        "Verified": "सत्यापित",
        "Pending": "प्रलंबित",
    },
    "ta": {
        "Survey Number": "சர்வே எண்",
        "Khasra Number": "கசரா எண்",
        "Owner Name": "உரிமையாளர் பெயர்",
        "Village": "கிராமம்",
        "Tehsil": "தாலுக்கா",
        "District": "மாவட்டம்",
        "Area": "பரப்பளவு",
        "Land Classification": "நில வகைப்பாடு",
        "Ownership Type": "உரிமை வகை",
        "Mutation Number": "மாற்றம் எண்",
        "Record of Rights": "உரிமை பதிவு",
        "Verified": "சரிபார்க்கப்பட்டது",
        "Pending": "நிலுவையில்",
    },
    "te": {
        "Survey Number": "సర్వే నంబర్",
        "Khasra Number": "ఖాసరా నంబర్",
        "Owner Name": "యజమాని పేరు",
        "Village": "గ్రామం",
        "Tehsil": "మండలం",
        "District": "జిల్లా",
        "Area": "విస్తీర్ణం",
        "Land Classification": "భూమి వర్గీకరణ",
        "Ownership Type": "యాజమాన్య రకం",
        "Mutation Number": "మ్యుటేషన్ నంబర్",
        "Record of Rights": "హక్కుల రికార్డు",
        "Verified": "ధృవీకరించబడింది",
        "Pending": "పెండింగ్",
    },
    "kn": {
        "Survey Number": "ಸರ್ವೆ ಸಂಖ್ಯೆ",
        "Khasra Number": "ಖಾಸರ ಸಂಖ್ಯೆ",
        "Owner Name": "ಮಾಲೀಕರ ಹೆಸರು",
        "Village": "ಗ್ರಾಮ",
        "Tehsil": "ತಾಲ್ಲೂಕು",
        "District": "ಜಿಲ್ಲೆ",
        "Area": "ವಿಸ್ತೀರ್ಣ",
        "Land Classification": "ಭೂಮಿ ವರ್ಗೀಕರಣ",
        "Ownership Type": "ಒಡೆತನದ ವಿಧ",
        "Mutation Number": "ಮ್ಯೂಟೇಶನ್ ಸಂಖ್ಯೆ",
        "Record of Rights": "ಹಕ್ಕು ದಾಖಲೆ",
        "Verified": "ಪರಿಶೀಲಿಸಲಾಗಿದೆ",
        "Pending": "ಬಾಕಿ ಇದೆ",
    },
    "bn": {
        "Survey Number": "সার্ভে নম্বর",
        "Khasra Number": "খাসরা নম্বর",
        "Owner Name": "মালিকের নাম",
        "Village": "গ্রাম",
        "Tehsil": "তহশিল",
        "District": "জেলা",
        "Area": "এলাকা",
        "Land Classification": "জমির শ্রেণীবিভাগ",
        "Ownership Type": "মালিকানার ধরন",
        "Mutation Number": "মিউটেশন নম্বর",
        "Record of Rights": "অধিকারের রেকর্ড",
        "Verified": "যাচাইকৃত",
        "Pending": "মুলতুবি",
    },
    "gu": {
        "Survey Number": "સર્વે નંબર",
        "Khasra Number": "ખસરા નંબર",
        "Owner Name": "માલિકનું નામ",
        "Village": "ગામ",
        "Tehsil": "તાલુકો",
        "District": "જિલ્લો",
        "Area": "ક્ષેત્ર",
        "Land Classification": "જમીન વર્ગીકરણ",
        "Ownership Type": "માલિકીનો પ્રકાર",
        "Mutation Number": "મ્યુટેશન નંબર",
        "Record of Rights": "અધિકારનો રેકોર્ડ",
        "Verified": "ચકાસાયેલ",
        "Pending": "બાકી",
    },
}


# ─────────────────────────────────────────────────────────────────────────────
#  Bhashini API Integration
# ─────────────────────────────────────────────────────────────────────────────

BHASHINI_API_KEY = os.environ.get("BHASHINI_API_KEY", "")
BHASHINI_USER_ID = os.environ.get("BHASHINI_USER_ID", "")
BHASHINI_ENDPOINT = "https://dhruva-api.bhashini.gov.in/services/inference/pipeline"


def _bhashini_translate(text: str, source_lang: str, target_lang: str) -> Optional[str]:
    """Call the Bhashini Dhruva API for translation."""
    if not BHASHINI_API_KEY:
        return None
    try:
        payload = {
            "pipelineTasks": [{
                "taskType": "translation",
                "config": {
                    "language": {
                        "sourceLanguage": source_lang,
                        "targetLanguage": target_lang,
                    },
                    "serviceId": "ai4bharat/indictrans-v2-all-gpu--t4"
                }
            }],
            "inputData": {
                "input": [{"source": text}]
            }
        }
        headers = {
            "Authorization": BHASHINI_API_KEY,
            "userID": BHASHINI_USER_ID,
            "ulcaApiKey": BHASHINI_API_KEY,
            "Content-Type": "application/json",
        }
        r = requests.post(BHASHINI_ENDPOINT, json=payload, headers=headers, timeout=10)
        if r.status_code == 200:
            result = r.json()
            translated = result["pipelineResponse"][0]["output"][0]["target"]
            return translated
    except Exception as e:
        logger.warning("Bhashini API failed: %s", e)
    return None


# ─────────────────────────────────────────────────────────────────────────────
#  Gemini Fallback Translation
# ─────────────────────────────────────────────────────────────────────────────

def _gemini_translate(text: str, target_lang: str, target_lang_name: str) -> str:
    """Use Gemini as fallback for translation."""
    try:
        from app.services.gemini_service import gemini_translate
        return gemini_translate(text, source_language="auto")
    except Exception:
        return text


# ─────────────────────────────────────────────────────────────────────────────
#  Public API
# ─────────────────────────────────────────────────────────────────────────────

def translate_text(text: str, target_lang: str, source_lang: str = "en") -> str:
    """
    Translate text to the target Indian language.
    Tries Bhashini first, falls back to Gemini.

    Args:
        text: Text to translate
        target_lang: ISO 639-1 language code (e.g. 'hi', 'mr', 'ta')
        source_lang: Source language code (default 'en')

    Returns:
        Translated text string
    """
    # Skip only when source and target are the same language
    if target_lang == source_lang:
        return text

    # Try Bhashini first
    result = _bhashini_translate(text, source_lang, target_lang)
    if result:
        return result

    # Fallback: Gemini translation
    lang_name = SUPPORTED_LANGUAGES.get(target_lang, target_lang)
    try:
        from app.services.gemini_service import _get_client
        client = _get_client()
        prompt = f"""Translate this Indian land record text to {lang_name}.
Keep technical codes and numbers as-is (Survey No, Khasra No, area values).
TEXT: {text}
Provide ONLY the translation, nothing else."""
        response = client.models.generate_content(
            model="gemini-1.5-flash",
            contents=prompt,
        )
        return response.text.strip()
    except Exception as e:
        logger.error("Translation failed: %s", e)
        return text


def translate_record_fields(record: dict, target_lang: str) -> dict:
    """
    Translate the field LABELS of a land record to the target language.
    Field VALUES (names, numbers) are kept as-is.
    Only labels/UI text are translated.
    """
    terms = LAND_TERMS.get(target_lang, {})
    translated = {}
    for key, value in record.items():
        # Translate the display label
        label = key.replace("_", " ").title()
        translated_label = terms.get(label, label)
        translated[translated_label] = value
    return translated


def get_label_translations(target_lang: str) -> dict:
    """
    Return field label translations for a given language.
    Used by the frontend to render multilingual UI.
    """
    return LAND_TERMS.get(target_lang, {})


def detect_language_from_text(text: str) -> str:
    """
    Detect the language of OCR-extracted text.
    Returns ISO 639-1 code.
    """
    # Simple heuristic based on Unicode ranges
    devanagari = sum(1 for c in text if '\u0900' <= c <= '\u097F')
    tamil = sum(1 for c in text if '\u0B80' <= c <= '\u0BFF')
    telugu = sum(1 for c in text if '\u0C00' <= c <= '\u0C7F')
    kannada = sum(1 for c in text if '\u0C80' <= c <= '\u0CFF')
    bengali = sum(1 for c in text if '\u0980' <= c <= '\u09FF')
    gujarati = sum(1 for c in text if '\u0A80' <= c <= '\u0AFF')
    odia = sum(1 for c in text if '\u0B00' <= c <= '\u0B7F')
    malayalam = sum(1 for c in text if '\u0D00' <= c <= '\u0D7F')

    scores = {
        "hi": devanagari,  # Hindi/Marathi/Sanskrit all use Devanagari
        "ta": tamil,
        "te": telugu,
        "kn": kannada,
        "bn": bengali,
        "gu": gujarati,
        "or": odia,
        "ml": malayalam,
    }
    max_lang = max(scores, key=scores.get)
    if scores[max_lang] > 5:
        return max_lang
    return "en"  # Default to English


def translate_query(query: str, source_lang: str) -> str:
    """
    Translate a user search query from any Indian language to English
    so it can be used to search the database.
    """
    if source_lang == "en" or not source_lang:
        return query
    # translate_text(text, target_lang, source_lang)
    # We want: source=source_lang → target=en
    return translate_text(query, "en", source_lang)
