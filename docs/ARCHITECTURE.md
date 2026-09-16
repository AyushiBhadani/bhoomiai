# System Architecture

## Technology Stack
The stack is chosen for speed, reliability, and ease of local development, utilizing free/open-source tools as required.

### Frontend
*   **Framework:** Next.js (React)
*   **Language:** TypeScript
*   **Styling:** Tailwind CSS
*   **Mapping:** React-Leaflet (OpenStreetMap)
*   **Charts:** Recharts

### Backend
*   **Framework:** FastAPI (Python)
*   **Database:** PostgreSQL
*   **Spatial Extension:** PostGIS (for GIS parcel data)
*   **ORM:** SQLAlchemy or SQLModel

### AI & OCR Pipeline
*   **Image Preprocessing:** OpenCV (grayscale, thresholding, deskewing)
*   **OCR Engine:** Tesseract OCR (with multi-language packs) / PaddleOCR (for better layout preservation)
*   **Text Extraction:** NLP heuristics (spaCy) or a lightweight local transformer model for structured JSON generation.
*   **AI Agent:** Lightweight open-source LLM or structured prompt chain for the "Land Record Intelligence Agent".

## System Pipeline
1.  **Document Upload:** User uploads PDF/Image.
2.  **Preprocessing:** OpenCV enhances the image.
3.  **OCR:** Text and layout are extracted.
4.  **AI Field Extraction:** Unstructured text is parsed into a strict JSON schema.
5.  **Confidence Scoring:** Heuristics calculate confidence per field.
6.  **Validation Engine:** Deterministic rules run against the extracted JSON and the PostGIS reference database.
7.  **Human Verification:** UI highlights low-confidence/failed validation fields for manual review.
8.  **Approval & Storage:** Approved records are committed to the PostgreSQL database with a full audit trail.
