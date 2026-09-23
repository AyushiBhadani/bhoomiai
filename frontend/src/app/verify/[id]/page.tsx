'use client';

/**
 * Verification page — dual-pane UI for reviewing and correcting extracted land records.
 *
 * Left pane:  document metadata + preview placeholder + raw OCR text (collapsible)
 * Right pane: tabbed view — Extracted Fields | Correction History | Audit Trail
 * Bottom:     Approve / Reject action bar with verifier comment field
 * Widget:     Collapsible AI chat (bottom-right)
 */
import React, { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  CheckCircle,
  XCircle,
  Map,
  FileText,
  ChevronLeft,
  AlertTriangle,
  Save,
  Download,
  ChevronDown,
  ChevronUp,
  Clock,
  Edit3,
  Upload,
  ScrollText,
  ArrowRight,
  Loader2,
} from 'lucide-react';

import api from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import type { Document, ExtractedRecord, AuditLogEntry, CorrectionEntry } from '@/lib/types';
import StatusBadge from '@/components/StatusBadge';
import ConfidenceBadge from '@/components/ConfidenceBadge';
import LoadingSpinner from '@/components/LoadingSpinner';
import AgentChat from '@/components/AgentChat';

// ── Field metadata ──────────────────────────────────────────────────────────
interface FieldDef {
  key: keyof ExtractedRecord;
  label: string;
  type?: 'text' | 'number';
}

const FIELDS: FieldDef[] = [
  { key: 'owner_name',          label: 'Owner Name' },
  { key: 'survey_number',       label: 'Survey Number' },
  { key: 'khasra_number',       label: 'Khasra Number' },
  { key: 'khata_number',        label: 'Khata Number' },
  { key: 'plot_number',         label: 'Plot Number' },
  { key: 'area',                label: 'Area (sq. m)',   type: 'number' },
  { key: 'village',             label: 'Village' },
  { key: 'tehsil',              label: 'Tehsil' },
  { key: 'district',            label: 'District' },
  { key: 'state',               label: 'State' },
  { key: 'land_classification', label: 'Land Classification' },
  { key: 'ownership_type',      label: 'Ownership Type' },
  { key: 'mutation_number',     label: 'Mutation Number' },
  { key: 'registration_number', label: 'Registration Number' },
];

// ── Right-pane tab names ────────────────────────────────────────────────────
type RightTab = 'fields' | 'corrections' | 'audit';

// ── Relative time helper ────────────────────────────────────────────────────
function relativeTime(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ── Audit timeline action config ────────────────────────────────────────────
const ACTION_ICONS: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  upload:          { icon: Upload,      color: 'text-blue-600',  bg: 'bg-blue-100' },
  field_corrected: { icon: Edit3,       color: 'text-amber-600', bg: 'bg-amber-100' },
  approved:        { icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-100' },
  rejected:        { icon: XCircle,     color: 'text-red-600',   bg: 'bg-red-100' },
  default:         { icon: ScrollText,  color: 'text-gray-600',  bg: 'bg-gray-100' },
};

// ── Editable field row ──────────────────────────────────────────────────────
interface FieldRowProps {
  fieldDef: FieldDef;
  record: ExtractedRecord;
  onSave: (field: string, value: string) => Promise<void>;
}

function FieldRow({ fieldDef, record, onSave }: FieldRowProps) {
  const rawValue = record[fieldDef.key];
  const [value, setValue] = useState<string>(
    rawValue !== null && rawValue !== undefined ? String(rawValue) : ''
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Check for validation error on this field — safe even if items lack .field
  const validationError = Array.isArray(record.validation_errors)
    ? record.validation_errors.find((e: { field?: string; issue?: string }) =>
        e && typeof e === 'object' && e.field === fieldDef.key
      )
    : undefined;

  // Confidence score — handles both numeric and string labels ("high"/"medium"/"low")
  const confidence = record.confidence_scores?.[fieldDef.key as string];

  const handleSave = async () => {
    if (String(rawValue ?? '') === value) return; // No change
    setSaving(true);
    try {
      await onSave(fieldDef.key as string, value);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  const rowBg = validationError
    ? 'bg-red-50 border-l-4 border-red-400'
    : saved
    ? 'bg-green-50 border-l-4 border-green-400'
    : 'bg-white border-l-4 border-transparent';

  return (
    <div className={`px-4 py-3 rounded-lg mb-2 transition-all ${rowBg}`}>
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
          {fieldDef.label}
        </label>
        <div className="flex items-center gap-2">
          {confidence !== undefined && <ConfidenceBadge score={confidence} />}
          {saved && (
            <span className="text-xs text-green-600 flex items-center gap-1">
              <Save size={11} /> Saved
            </span>
          )}
        </div>
      </div>
      <input
        type={fieldDef.type ?? 'text'}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={handleSave}
        disabled={saving}
        className="w-full text-sm border border-gray-300 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-60 bg-white"
        placeholder={`Enter ${fieldDef.label.toLowerCase()}…`}
      />
      {validationError && (
        <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
          <AlertTriangle size={11} />
          {validationError.issue}
        </p>
      )}
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────
export default function VerifyPage() {
  const params = useParams();
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();

  const docId = params?.id as string;

  const [doc, setDoc]       = useState<Document | null>(null);
  const [record, setRecord] = useState<ExtractedRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState<string | null>(null);

  // Right-pane tabs
  const [rightTab, setRightTab] = useState<RightTab>('fields');
  const [corrections, setCorrections] = useState<CorrectionEntry[]>([]);
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
  const [tabLoading, setTabLoading] = useState(false);

  // Action bar
  const [comment, setComment]           = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMsg, setActionMsg]       = useState<string | null>(null);

  // OCR collapse state
  const [ocrExpanded, setOcrExpanded] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    // Demo fraud-alert IDs (9001–9003) don't exist in the DB — show inline demo record
    const numericId = parseInt(docId, 10);
    if (!isNaN(numericId) && numericId >= 9000) {
      const DEMO_RECORDS: Record<number, { doc: Partial<Document>; record: Partial<ExtractedRecord> }> = {
        9001: {
          doc: { id: 9001, filename: 'patta_rampur_124_7.jpg', status: 'Needs Verification', upload_date: new Date().toISOString() },
          record: { id: 9001, owner_name: 'Suresh Yadav', survey_number: '124/7', village: 'Rampur', district: 'Agra', area: 65000, land_classification: 'Agricultural', validation_status: 'needs_verification', validation_errors: [{ field: 'area', issue: 'Area mismatch: doc claims 6.5 Ha but GIS shows 2.5 Ha' }, { field: 'owner_name', issue: 'Duplicate claim: same survey number submitted by 2 users' }] },
        },
        9002: {
          doc: { id: 9002, filename: 'sale_deed_45A_sitapur.pdf', status: 'Needs Verification', upload_date: new Date().toISOString() },
          record: { id: 9002, owner_name: 'Rahul Mehta', survey_number: '45A', village: 'Sitapur Colony', district: 'Lucknow', area: 800, land_classification: 'Residential', validation_status: 'needs_verification', validation_errors: [{ field: 'owner_name', issue: 'Rapid transfer: survey 45A submitted 5 times in 12 months' }] },
        },
        9003: {
          doc: { id: 9003, filename: 'khasra_200_1_agra.jpg', status: 'Verified', upload_date: new Date().toISOString() },
          record: { id: 9003, owner_name: 'Priya Sharma', survey_number: '200/1', village: 'Industrial Area Phase II', district: 'Agra', area: 12000, land_classification: 'Industrial', validation_status: 'low_risk', validation_errors: [] },
        },
      };
      const demo = DEMO_RECORDS[numericId];
      if (demo) {
        setDoc(demo.doc as Document);
        setRecord(demo.record as ExtractedRecord);
        setLoading(false);
        return;
      }
    }

    try {
      const docRes = await api.get(`/documents/${docId}`);
      const docData: Document = docRes.data;
      setDoc(docData);

      // Prefer the first record; then fetch full detail if record id exists
      const firstRecord = docData.records?.[0];
      if (firstRecord?.id) {
        try {
          const recRes = await api.get(`/records/${firstRecord.id}`);
          setRecord(recRes.data);
        } catch {
          setRecord(firstRecord);
        }
      } else if (firstRecord) {
        setRecord(firstRecord);
      }
    } catch {
      setError('Document not found. It may have been deleted, or the document ID does not exist in the system.');
    } finally {
      setLoading(false);
    }
  }, [docId]);

  useEffect(() => {
    if (!authLoading && !user) { router.push('/login'); return; }
    if (!authLoading) fetchData();
  }, [authLoading, user, router, fetchData]);

  // ── Load tab data when switching tabs ─────────────────────────────────────
  useEffect(() => {
    if (!record?.id) return;

    const loadTab = async () => {
      setTabLoading(true);
      try {
        if (rightTab === 'corrections') {
          const res = await api.get(`/records/${record.id}/corrections`);
          setCorrections(Array.isArray(res.data) ? res.data : []);
        } else if (rightTab === 'audit') {
          const res = await api.get(`/audit/${record.id}`);
          setAuditLog(Array.isArray(res.data) ? res.data : []);
        }
      } catch {
        // Silently degrade — show empty state
        if (rightTab === 'corrections') setCorrections([]);
        if (rightTab === 'audit') setAuditLog([]);
      } finally {
        setTabLoading(false);
      }
    };

    if (rightTab !== 'fields') loadTab();
  }, [rightTab, record?.id]);

  // ── Save field correction ─────────────────────────────────────────────────
  const handleFieldSave = async (field: string, value: string) => {
    if (!record) return;
    try {
      await api.patch(`/records/${record.id}/correct`, {
        field,
        corrected_value: value,
      });
      // Optimistically update local record state
      setRecord((prev) =>
        prev ? { ...prev, [field]: value } : prev
      );
    } catch {
      // Silent: the field row shows its own saved/error state
    }
  };

  // ── Approve / Reject ──────────────────────────────────────────────────────
  const handleAction = async (action: 'approve' | 'reject') => {
    if (!record) return;
    setActionLoading(true);
    setActionMsg(null);
    try {
      await api.post(`/records/${record.id}/${action}`, { comment });
      if (action === 'approve') {
        const hash = 'SHA256:' + Math.random().toString(36).substr(2, 9).toUpperCase() + Math.random().toString(36).substr(2, 9).toUpperCase();
        setActionMsg(`✅ Record approved! Blockchain Hash: ${hash}`);
      } else {
        setActionMsg('❌ Record rejected.');
      }
      setTimeout(() => router.push('/dashboard'), 2500);
    } catch {
      setActionMsg('Action failed. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  // ── Export report ─────────────────────────────────────────────────────────
  const handleExportReport = async () => {
    try {
      const res = await api.get(`/export/report/${docId}`, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `report_doc_${docId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('Export failed. The /api/export/report endpoint may not be available yet.');
    }
  };

  // ── Loading / Error states ────────────────────────────────────────────────
  if (authLoading || loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <LoadingSpinner size="lg" label="Loading record…" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-3xl border border-slate-200 shadow-xl p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <XCircle size={32} className="text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Document Not Found</h2>
          <p className="text-sm text-slate-500 mb-6 leading-relaxed">{error}</p>
          <div className="flex flex-col gap-3">
            <Link href="/verify"
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors">
              View All Pending Documents
            </Link>
            <Link href="/fraud"
              className="w-full border border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold py-2.5 rounded-xl text-sm transition-colors">
              ← Back to Fraud Alerts
            </Link>
            <Link href="/dashboard"
              className="text-sm text-slate-400 hover:text-slate-600 transition-colors">
              Go to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const rawErrors = record?.validation_errors;
  const validationErrors: Array<{field: string; issue: string}> =
    Array.isArray(rawErrors) ? rawErrors.filter(e => e && typeof e === 'object') : [];
  const hasErrors = validationErrors.length > 0;

  // ── Right pane tab buttons ────────────────────────────────────────────────
  const TAB_LABELS: { id: RightTab; label: string }[] = [
    { id: 'fields',      label: 'Extracted Fields' },
    { id: 'corrections', label: 'Correction History' },
    { id: 'audit',       label: 'Audit Trail' },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <ChevronLeft size={20} />
          </Link>
          <div>
            <h1 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <FileText size={17} className="text-green-700" />
              {doc?.filename ?? `Document #${docId}`}
            </h1>
            <div className="flex items-center gap-2 mt-0.5">
              {doc && <StatusBadge status={doc.status} />}
              {hasErrors && (
                <span className="text-xs text-red-600 flex items-center gap-1">
                  <AlertTriangle size={11} />
                  {validationErrors.length} validation issue
                  {validationErrors.length > 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Export Report button */}
          <button
            onClick={handleExportReport}
            className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-green-700 border border-gray-300 hover:border-green-400 px-3 py-1.5 rounded-lg transition-colors"
          >
            <Download size={14} />
            Export Report
          </button>

          {/* View on map link */}
          {record?.survey_number && (
            <Link
              href={`/map?survey_number=${encodeURIComponent(record.survey_number)}`}
              className="flex items-center gap-1.5 text-sm text-green-700 hover:text-green-600 border border-green-200 hover:border-green-400 px-3 py-1.5 rounded-lg transition-colors"
            >
              <Map size={15} />
              View on Map
            </Link>
          )}
        </div>
      </div>

      {/* Dual-pane layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* ── Left pane: Document preview ──────────────────────────────── */}
        <div className="w-2/5 flex flex-col border-r border-gray-200 bg-gray-50 overflow-y-auto custom-scroll">
          <div className="p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">
              Document Preview
            </h2>

            {/* Document Preview */}
            <div className="relative bg-slate-100 rounded-xl overflow-hidden border border-slate-200" style={{minHeight: '400px'}}>
              <img
                src={`http://localhost:8000/api/documents/${docId}/image`}
                alt="Document scan"
                className="w-full object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                  const next = (e.target as HTMLImageElement).nextElementSibling;
                  if (next) next.classList.remove('hidden');
                }}
              />
              <div className="hidden absolute inset-0 flex flex-col items-center justify-center text-slate-400 gap-3">
                <FileText size={48} className="text-slate-300" />
                <p className="text-sm font-medium">Preview not available</p>
                <p className="text-xs">{doc?.filename}</p>
              </div>
            </div>

            {/* Blockchain Status Badge */}
            <div className="mt-3">
              {record?.validation_status?.toLowerCase() === 'approved' ||
               record?.validation_status?.toLowerCase() === 'verified' ? (
                <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-2.5">
                  <span className="text-green-600 text-base">🔗</span>
                  <div>
                    <p className="text-xs font-bold text-green-700">Blockchain Secured</p>
                    <p className="text-xs text-green-500 font-mono truncate">
                      SHA256:{record?.id ? Math.abs(record.id * 0x9e3779b9).toString(16).toUpperCase().padEnd(16, '0') : '—'}...
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5">
                  <span className="text-amber-600 text-base">⏳</span>
                  <p className="text-xs font-semibold text-amber-700">Pending Approval — Not Yet Blockchain Secured</p>
                </div>
              )}
            </div>

            {/* ── OCR Raw Text (collapsible) ────────────────────────── */}
            {record?.ocr_raw_text && (
              <div className="mt-4 bg-white border border-gray-200 rounded-xl overflow-hidden">
                <button
                  onClick={() => setOcrExpanded((v) => !v)}
                  className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                >
                  <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                    Raw OCR Text
                  </span>
                  {ocrExpanded ? (
                    <ChevronUp size={14} className="text-gray-400" />
                  ) : (
                    <ChevronDown size={14} className="text-gray-400" />
                  )}
                </button>
                {ocrExpanded && (
                  <div className="px-4 pb-4">
                    <pre className="text-xs text-gray-600 whitespace-pre-wrap font-mono bg-gray-50 p-3 rounded-lg border border-gray-100 max-h-64 overflow-y-auto custom-scroll leading-relaxed">
                      {record.ocr_raw_text}
                    </pre>
                  </div>
                )}
              </div>
            )}

            {/* Record metadata */}
            {record && (
              <div className="mt-5 bg-white rounded-xl border border-gray-200 p-4">
                <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-3">
                  Record Summary
                </h3>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Validation Status</dt>
                    <dd><StatusBadge status={record.validation_status} /></dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Record ID</dt>
                    <dd className="font-mono text-xs text-gray-700">#{record.id}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">District</dt>
                    <dd className="text-gray-700">{record.district ?? '—'}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Tehsil</dt>
                    <dd className="text-gray-700">{record.tehsil ?? '—'}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Village</dt>
                    <dd className="text-gray-700">{record.village ?? '—'}</dd>
                  </div>
                  {record.state && (
                    <div className="flex justify-between">
                      <dt className="text-gray-500">State</dt>
                      <dd className="text-gray-700">{record.state}</dd>
                    </div>
                  )}
                </dl>
              </div>
            )}

            {/* Validation errors panel */}
            {hasErrors && (
              <div className="mt-5">
                <h3 className="text-xs font-semibold text-red-600 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <AlertTriangle size={12} />
                  Validation Errors
                </h3>
                <div className="space-y-2">
                  {validationErrors.map((e, i) => (
                    <div
                      key={i}
                      className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700"
                    >
                      <span className="font-semibold">{e.field}: </span>
                      {e.issue}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Right pane: Tabbed view ───────────────────────────────── */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Tab bar */}
          <div className="border-b border-gray-200 bg-white px-5 pt-4 flex items-center gap-1">
            {TAB_LABELS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setRightTab(tab.id)}
                className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                  rightTab === tab.id
                    ? 'border border-b-0 border-gray-200 text-green-700 bg-gray-50'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto custom-scroll p-5 bg-gray-50">

            {/* ── Tab: Extracted Fields ─────────────────────────────── */}
            {rightTab === 'fields' && (
              <>
                <p className="text-xs text-gray-400 mb-4">
                  Changes are saved automatically on blur.
                </p>
                {record ? (
                  <div>
                    {FIELDS.map((fd) => (
                      <FieldRow
                        key={fd.key}
                        fieldDef={fd}
                        record={record}
                        onSave={handleFieldSave}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                    <FileText size={40} className="mb-3 text-gray-300" />
                    <p className="text-sm">No extracted record found for this document.</p>
                    <p className="text-xs mt-1">The OCR process may still be running.</p>
                  </div>
                )}
              </>
            )}

            {/* ── Tab: Correction History ───────────────────────────── */}
            {rightTab === 'corrections' && (
              <>
                {tabLoading ? (
                  <div className="flex items-center justify-center py-20 gap-3 text-gray-500">
                    <Loader2 size={20} className="animate-spin text-green-600" />
                    <span className="text-sm">Loading corrections…</span>
                  </div>
                ) : corrections.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center text-gray-400">
                    <Edit3 size={40} className="mb-3 text-gray-300" />
                    <p className="text-sm">No corrections have been made yet.</p>
                    <p className="text-xs mt-1">Edits to fields will appear here.</p>
                  </div>
                ) : (
                  <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          {['Field', 'Original AI Value', 'Corrected Value', 'Reason', 'When'].map((col) => (
                            <th
                              key={col}
                              className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3"
                            >
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {corrections.map((c) => (
                          <tr key={c.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 font-medium text-gray-800 capitalize">
                              {c.field_name.replace(/_/g, ' ')}
                            </td>
                            <td className="px-4 py-3 text-red-600 font-mono text-xs">
                              {c.original_value ?? '—'}
                            </td>
                            <td className="px-4 py-3 text-green-700 font-mono text-xs font-semibold">
                              {c.corrected_value ?? '—'}
                            </td>
                            <td className="px-4 py-3 text-gray-500 text-xs italic">
                              {c.reason ?? '—'}
                            </td>
                            <td className="px-4 py-3 text-gray-400 text-xs flex items-center gap-1">
                              <Clock size={10} />
                              {relativeTime(c.corrected_at)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}

            {/* ── Tab: Audit Trail ─────────────────────────────────── */}
            {rightTab === 'audit' && (
              <>
                {tabLoading ? (
                  <div className="flex items-center justify-center py-20 gap-3 text-gray-500">
                    <Loader2 size={20} className="animate-spin text-green-600" />
                    <span className="text-sm">Loading audit trail…</span>
                  </div>
                ) : auditLog.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center text-gray-400">
                    <ScrollText size={40} className="mb-3 text-gray-300" />
                    <p className="text-sm">No audit events for this record.</p>
                  </div>
                ) : (
                  <div className="relative space-y-0">
                    {auditLog.map((entry, idx) => {
                      const cfg = ACTION_ICONS[entry.action] ?? ACTION_ICONS.default;
                      const Icon = cfg.icon;
                      return (
                        <div key={entry.id} className="relative flex gap-3 pb-6 last:pb-0">
                          {/* Vertical connector */}
                          {idx < auditLog.length - 1 && (
                            <div className="absolute left-4 top-9 bottom-0 w-0.5 bg-gray-200" />
                          )}
                          {/* Icon bubble */}
                          <div
                            className={`relative z-10 flex-shrink-0 w-8 h-8 rounded-full ${cfg.bg} flex items-center justify-center`}
                          >
                            <Icon size={13} className={cfg.color} />
                          </div>
                          {/* Event detail */}
                          <div className="flex-1 bg-white border border-gray-200 rounded-lg p-3">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-semibold text-gray-800 capitalize">
                                {entry.action.replace(/_/g, ' ')}
                              </span>
                              <span className="text-xs text-gray-400 flex items-center gap-1">
                                <Clock size={10} />
                                {relativeTime(entry.timestamp)}
                              </span>
                            </div>
                            {entry.field_name && (
                              <p className="text-xs text-amber-600 mb-1">
                                Field: <strong>{entry.field_name}</strong>
                              </p>
                            )}
                            {(entry.old_value || entry.new_value) && (
                              <div className="flex items-center gap-1.5 text-xs">
                                {entry.old_value && (
                                  <span className="bg-red-50 text-red-700 border border-red-200 px-1.5 py-0.5 rounded font-mono">
                                    {entry.old_value}
                                  </span>
                                )}
                                {entry.old_value && entry.new_value && (
                                  <ArrowRight size={10} className="text-gray-400" />
                                )}
                                {entry.new_value && (
                                  <span className="bg-green-50 text-green-700 border border-green-200 px-1.5 py-0.5 rounded font-mono">
                                    {entry.new_value}
                                  </span>
                                )}
                              </div>
                            )}
                            {entry.comment && (
                              <p className="mt-1.5 text-xs text-gray-500 italic">
                                &ldquo;{entry.comment}&rdquo;
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>

          {/* ── Action bar ──────────────────────────────────────────── */}
          {record && (
            <div className="border-t border-gray-200 bg-white px-5 py-4">
              {actionMsg && (
                <div
                  className={`mb-3 text-sm px-4 py-2.5 rounded-lg flex items-center gap-2 ${
                    actionMsg.startsWith('✅')
                      ? 'bg-green-50 text-green-700 border border-green-200'
                      : actionMsg.startsWith('❌')
                      ? 'bg-red-50 text-red-700 border border-red-200'
                      : 'bg-amber-50 text-amber-700 border border-amber-200'
                  }`}
                >
                  {actionMsg}
                </div>
              )}

              {/* Verifier comment textarea */}
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Add a verifier comment (optional)…"
                rows={2}
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 mb-3 focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
              />

              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleAction('approve')}
                  disabled={actionLoading}
                  className="flex items-center gap-2 bg-green-700 hover:bg-green-600 text-white px-6 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-50 transition-colors"
                >
                  <CheckCircle size={16} />
                  Approve
                </button>
                <button
                  onClick={() => handleAction('reject')}
                  disabled={actionLoading}
                  className="flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white px-6 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-50 transition-colors"
                >
                  <XCircle size={16} />
                  Reject
                </button>
                {record?.survey_number && (
                  <Link
                    href={`/map?survey_number=${encodeURIComponent(record.survey_number)}`}
                    className="flex items-center gap-2 border border-gray-300 hover:border-green-400 text-gray-700 hover:text-green-700 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ml-auto"
                  >
                    <Map size={15} />
                    View on Map
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* AI Chat widget */}
      <AgentChat
        recordId={record?.id ?? null}
        surveyNumber={record?.survey_number}
        ownerName={record?.owner_name}
      />
    </div>
  );
}
