# Dataset Analysis

## Current Status
**No real dataset is available in the workspace.** An inspection of the workspace (`d:\sih`) revealed only the `SIH2026_Software_Problem_Statements.pdf`, which is a list of problem statements, and no data files (images, PDFs, CSVs, or databases).

## Strategy: Synthetic Demo Dataset
To ensure the prototype is technically credible and judge-ready, we will NOT fabricate claims about possessing an official government dataset. Instead, we will build a **Synthetic/Demo Dataset Generator**.

### Synthetic Dataset Characteristics
The generator will create mock land records that simulate the complexities of real historical documents:
1.  **Clean Records:** High-quality, perfectly extractable digital or printed records.
2.  **Low-Quality Documents:** Simulated scans with noise, blur, and low contrast.
3.  **Validation Failures:** Records deliberately generated with area mismatches, missing fields, or duplicate survey numbers to test the validation engine.
4.  **Low-Confidence Examples:** Simulated handwritten or degraded text to trigger low-confidence OCR scores and force human verification.
5.  **Multilingual Examples:** Simulated records in regional Indian languages (e.g., Hindi, Marathi) depending on the chosen OCR engine's capabilities.

### Data Structure
The generated dataset will include:
*   **Images/PDFs:** The visual documents.
*   **Ground Truth JSON:** The expected extraction results.
*   **Reference Database:** A mock backend database of existing land records and GIS parcels to allow cross-reference validation and duplicate detection.

### Disclaimer
All data within the application will be clearly labeled as **DEMO/SYNTHETIC DATA** to maintain transparency during the hackathon.
