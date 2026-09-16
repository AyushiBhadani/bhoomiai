# Technical Decisions

1.  **Deterministic Validation over LLM Validation:**
    *   *Decision:* The validation engine will use hardcoded business rules (regex, mathematical comparisons, database lookups) rather than asking an LLM if a record is valid.
    *   *Rationale:* Reliability, speed, and prevention of AI hallucinations. Land records require absolute precision.

2.  **Synthetic Dataset Generation:**
    *   *Decision:* We will create a script to generate mock documents and a mock PostGIS database of existing parcels.
    *   *Rationale:* No real government dataset is provided. We must have a reliable, offline, and predictable dataset to ensure the demo works flawlessly during the hackathon.

3.  **Heuristic Confidence Scoring:**
    *   *Decision:* Confidence scores will be calculated using a mix of OCR confidence outputs, regex match exactness, and validation rule pass/fail states.
    *   *Rationale:* Pure AI confidence scores are often opaque or unavailable in lightweight open-source models. A composite heuristic score is more explainable and actionable for the human verifier.

4.  **Decoupled Architecture (FastAPI + Next.js):**
    *   *Decision:* Strict separation of backend APIs and frontend UI.
    *   *Rationale:* Allows parallel development, easier testing of the extraction pipeline via Swagger UI, and a cleaner codebase for judges to review.

5.  **Mock Government API Adapters:**
    *   *Decision:* Any integration with DILRMP or external LRMS will be implemented as a mock adapter class.
    *   *Rationale:* We do not have actual API keys or access to government systems. Mock adapters show architectural readiness for integration without faking a live connection.
