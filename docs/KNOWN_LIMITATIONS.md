# Known Limitations

To maintain transparency and technical credibility, the following limitations of the prototype are explicitly acknowledged:

1.  **Handwriting Recognition Accuracy:**
    *   While the system utilizes advanced open-source OCR (e.g., Tesseract/PaddleOCR), recognizing highly cursive or degraded historical Indian handwriting without a fine-tuned, proprietary model is inherently limited. The system is designed to flag these low-confidence areas for human review rather than guessing blindly.

2.  **Synthetic Data Usage:**
    *   The land records, GIS parcels, and validation reference databases are entirely synthetic and generated for demonstration purposes. They do not represent real-world entities.

3.  **GIS Data Scope:**
    *   The GIS implementation uses standard OpenStreetMap layers with synthetic GeoJSON parcel overlays. It does not connect to a live national cadastral mapping server.

4.  **Local Execution Constraint:**
    *   The prototype is designed to run locally or on a standard hackathon cloud tier. Extremely large batch processing of high-resolution PDFs may face memory or timeout constraints not present in a true enterprise deployment.
