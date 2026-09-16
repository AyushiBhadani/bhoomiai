/**
 * Shared TypeScript types for the BhoomiAI Land Record Digitization System.
 * Mirror the Pydantic schemas from the FastAPI backend.
 */

export interface User {
  id: number;
  email: string;
  role: string;
}

export interface ValidationError {
  field: string;
  issue: string;
}

export interface ExtractedRecord {
  id: number;
  document_id: number;
  owner_name: string | null;
  survey_number: string | null;
  khasra_number: string | null;
  khata_number: string | null;
  area: number | null;
  village: string | null;
  tehsil: string | null;
  district: string | null;
  land_classification: string | null;
  ownership_type: string | null;
  mutation_number: string | null;
  registration_number: string | null;
  confidence_scores: Record<string, string | number> | null;
  validation_status: string;
  validation_errors: ValidationError[] | null;
  /** Extended fields */
  state?: string | null;
  plot_number?: string | null;
  ocr_raw_text?: string | null;
}

export interface Document {
  id: number;
  filename: string;
  status: string;
  upload_date: string;
  file_path?: string;
  records: ExtractedRecord[];
}

export interface Parcel {
  id: number;
  survey_number: string;
  village: string;
  area: number;
  geometry_geojson: { type: string; coordinates: unknown } | null;
}

/** Single audit log entry from GET /api/audit/{record_id} */
export interface AuditLogEntry {
  id: number;
  record_id: number;
  user_id: number | null;
  action: string;
  field_name: string | null;
  old_value: string | null;
  new_value: string | null;
  comment: string | null;
  timestamp: string;
}

export interface DashboardStats {
  total_documents: number;
  verified_documents: number;
  pending_verification: number;
  failed_documents: number;
  processing_documents: number;
  total_records: number;
  records_with_errors: number;
  avg_confidence: number;
  recent_activity: AuditLogEntry[];
}

export interface AgentResponse {
  answer: string;
  sources?: string[];
}

/** Correction payload sent to PATCH /api/records/{id}/correct */
export interface RecordCorrection {
  field: string;
  corrected_value: string;
}

/** Record returned from GET /api/search */
export interface SearchRecord extends ExtractedRecord {
  document?: {
    id: number;
    filename: string;
    status: string;
    upload_date: string;
  };
}

/** Record returned from GET /api/repository */
export interface RepositoryRecord extends ExtractedRecord {
  doc_id?: number;
  doc_filename?: string;
  doc_status?: string;
  doc_upload_date?: string;
}

/** Single correction history entry from GET /api/records/{id}/corrections */
export interface CorrectionEntry {
  id: number;
  record_id: number;
  field_name: string;
  original_value: string | null;
  corrected_value: string | null;
  reason: string | null;
  corrected_by: string | null;
  corrected_at: string;
}
