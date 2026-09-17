import re

with open(r'backend/app/services/ocr_service.py', 'r', encoding='utf-8') as f:
    content = f.read()

pattern = r'def extract_text_from_image\(image_path: str\) -> str:.*?return FALLBACK_OCR_TEXT\s+except Exception as exc:.*?return FALLBACK_OCR_TEXT'

replacement = '''def extract_text_from_image(image_path: str) -> str:
    """
    Tesseract takes several minutes on Render free tier, causing timeouts.
    Bypassing and deferring completely to Gemini Vision AI.
    """
    logger.info("Bypassing Tesseract (Render Free Tier).")
    return FALLBACK_OCR_TEXT'''

new_content = re.sub(pattern, replacement, content, flags=re.DOTALL)

with open(r'backend/app/services/ocr_service.py', 'w', encoding='utf-8') as f:
    f.write(new_content)

