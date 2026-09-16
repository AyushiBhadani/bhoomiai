# Demo Flow

This is the primary end-to-end demonstration script for the judges. It is designed to be fully functional without dead buttons.

## Step-by-Step Execution

1.  **Login:** Officer logs in to the system.
2.  **Upload:** Officer uploads a simulated historical land-record document.
3.  **Processing Visualization:** System displays "Document uploaded successfully" and shows realistic processing stages (Image enhancement → Language detection → OCR → Field extraction → Validation → Confidence scoring).
4.  **Inspection View:** The UI splits into two panes: the original document and the extracted fields.
5.  **Structured Data Display:** Extracted fields (Owner, Survey Number, Area, etc.) are shown with their corresponding Values, Confidence Scores, and Status.
6.  **Highlighting Issues:** The system highlights low-confidence fields (e.g., "Area: 71% - Needs Review").
7.  **Validation Results:** Meaningful validation results are displayed (e.g., "⚠ Area mismatch detected").
8.  **AI Verification Agent:** The officer interacts with the "Land Record Intelligence Agent", asking "Why was this record flagged?". The agent answers based purely on the deterministic validation results and application data.
9.  **Human Correction:** The officer edits the incorrect field manually.
10. **Feedback Loop:** The correction is recorded in the database as human feedback.
11. **Approval:** The officer clicks "APPROVE RECORD".
12. **Audit Trailing:** The system records the complete audit trail (Uploaded by, processed at, corrected fields, approved by, timestamp).
13. **GIS Integration:** The officer clicks "VIEW ON MAP". A Leaflet map opens, highlighting the corresponding demo parcel.
14. **Dashboard Update:** The officer navigates to the dashboard, demonstrating that the statistics (Total documents, Processed, Validation failures) have updated in real-time.
