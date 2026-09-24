'use client';

/**
 * Smart Document Extraction Page
 * ─────────────────────────────────────────────────────────────────────────────
 * Demonstrates the full AI extraction pipeline:
 *   Upload → OCR → Gemini Vision → Structured Fields → Validation
 *
 * This is the killer feature for the SIH demo.
 */
import React, { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Upload, FileText, Sparkles, CheckCircle, AlertTriangle,
  Loader2, Eye, Download, ArrowRight, Zap, Brain,
  Camera, FileSearch, ShieldCheck, ChevronRight, X,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import api from '@/lib/api';
import { useEffect } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface ExtractionField {
  key: string;
  label: string;
  value: string | number | null;
  confidence: 'high' | 'medium' | 'low' | string;
}

interface ExtractionResult {
  document_id: number;
  record_id: number;
  filename: string;
  gemini_enhanced: boolean;
  ocr_raw_text: string;
  fields: ExtractionField[];
  validation_status: string;
  validation_errors: { field: string; issue: string }[];
  confidence_scores: Record<string, string | number>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Pipeline stages shown during processing
// ─────────────────────────────────────────────────────────────────────────────
const PIPELINE_STAGES = [
  { id: 'upload',     label: 'File Upload',           icon: Upload,      color: 'text-blue-400',   duration: 200  },
  { id: 'preprocess', label: 'Image Enhancement',     icon: Camera,      color: 'text-purple-400', duration: 300  },
  { id: 'ocr',        label: 'Tesseract OCR',         icon: FileSearch,  color: 'text-amber-400',  duration: 200  },
  { id: 'gemini',     label: 'Gemini Vision AI',      icon: Brain,       color: 'text-emerald-400',duration: 300  },
  { id: 'structure',  label: 'Field Structuring',     icon: Sparkles,    color: 'text-pink-400',   duration: 200  },
  { id: 'validate',   label: 'Cross-Validation',      icon: ShieldCheck, color: 'text-teal-400',   duration: 200  },
];

const FIELD_LABELS: Record<string, string> = {
  owner_name:          'Primary Owner',
  survey_number:       'Survey / Gat Number',
  khasra_number:       'Khasra Number',
  khata_number:        'Khata / Account No',
  plot_number:         'Plot Number',
  area:                'Land Area',
  village:             'Village',
  tehsil:              'Tehsil / Taluka',
  district:            'District',
  state:               'State',
  land_classification: 'Land Classification',
  ownership_type:      'Ownership Type',
  mutation_number:     'Mutation Number',
  registration_number: 'Registration Number',
};

function confidenceColor(c: string | number) {
  if (c === 'high' || Number(c) >= 0.85)   return 'text-emerald-600 bg-emerald-50 border-emerald-200';
  if (c === 'medium' || Number(c) >= 0.60) return 'text-amber-600 bg-amber-50 border-amber-200';
  return 'text-red-600 bg-red-50 border-red-200';
}

function confidenceLabel(c: string | number) {
  if (c === 'high' || Number(c) >= 0.85)   return 'High';
  if (c === 'medium' || Number(c) >= 0.60) return 'Medium';
  return 'Low';
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────
export default function ExtractPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  const [dragging, setDragging]   = useState(false);
  const [file, setFile]           = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [stage, setStage]         = useState<string | null>(null);
  const [stageIndex, setStageIndex] = useState(0);
  const [result, setResult]       = useState<ExtractionResult | null>(null);
  const [error, setError]         = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [authLoading, user, router]);

  // ── Drag & Drop handlers ──────────────────────────────────────────────────
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) selectFile(dropped);
  }, []);

  const selectFile = (f: File) => {
    setFile(f);
    setResult(null);
    setError(null);
    setStage(null);
    setStageIndex(0);
    if (f.type.startsWith('image/')) {
      const url = URL.createObjectURL(f);
      setPreviewUrl(url);
    } else {
      setPreviewUrl(null);
    }
  };

  // ── Run pipeline ──────────────────────────────────────────────────────────
  const runExtraction = async () => {
    if (!file) return;
    setResult(null);
    setError(null);

    // Animate through stages
    for (let i = 0; i < PIPELINE_STAGES.length; i++) {
      setStageIndex(i);
      setStage(PIPELINE_STAGES[i].id);
      await new Promise(r => setTimeout(r, PIPELINE_STAGES[i].duration));
    }

    try {
      const form = new FormData();
      form.append('file', file);
      const res = await api.post('/documents/upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60000,
      });

      const data = res.data;
      const record = data.record ?? {};
      const conf = record.confidence_scores ?? {};

      // Build field list
      const fields: ExtractionField[] = Object.entries(FIELD_LABELS)
        .map(([key, label]) => ({
          key,
          label,
          value: record[key] ?? null,
          confidence: conf[key] ?? (record[key] ? 'medium' : 'low'),
        }));

      setResult({
        document_id: data.id,
        record_id: record.id,
        filename: data.filename,
        gemini_enhanced: data.gemini_enhanced ?? false,
        ocr_raw_text: record.ocr_raw_text ?? '',
        fields,
        validation_status: record.validation_status ?? 'Pending',
        validation_errors: record.validation_errors ?? [],
        confidence_scores: conf,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Upload failed';
      setError(`Extraction failed: ${msg}. Make sure the backend is running.`);
    } finally {
      setStage(null);
    }
  };

  const reset = () => {
    setFile(null);
    setPreviewUrl(null);
    setResult(null);
    setError(null);
    setStage(null);
    setStageIndex(0);
  };

  const isProcessing = stage !== null;

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Page Header */}
      <div className="bg-white border-b border-slate-100 px-6 py-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Brain size={18} className="text-purple-500" />
              <h1 className="text-xl font-bold text-slate-900">Smart Document Extraction</h1>
              <span className="text-xs font-bold text-purple-600 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-full">
                Gemini AI + OCR
              </span>
            </div>
            <p className="text-sm text-slate-500">
              Upload any scanned land document — Patta, 7/12, Chitta, Jamabandi, or historical deed.
              AI extracts all 14 structured fields automatically.
            </p>
          </div>
          {result && (
            <button onClick={reset} className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 border border-slate-200 px-3 py-2 rounded-lg">
              <X size={14} /> New Document
            </button>
          )}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* ── LEFT: Upload + Pipeline ── */}
          <div className="space-y-5">
            {/* Drop zone OR file-selected view */}
            {!file ? (
              <>
                <div
                  ref={dropRef}
                  onDragOver={e => { e.preventDefault(); setDragging(true); }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => fileRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all ${
                    dragging
                      ? 'border-purple-400 bg-purple-50'
                      : 'border-slate-200 hover:border-purple-300 hover:bg-purple-50/30 bg-white'
                  }`}
                >
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-100 to-blue-100 flex items-center justify-center mx-auto mb-4">
                    <Upload size={28} className="text-purple-500" />
                  </div>
                  <h3 className="text-slate-800 font-bold text-base mb-1">Drop your land document here</h3>
                  <p className="text-slate-400 text-sm mb-4">Supports JPG, PNG, PDF, TIFF — scanned or photographed</p>
                  <div className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-all">
                    <FileText size={15} /> Browse Files
                  </div>
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".jpg,.jpeg,.png,.pdf,.tiff,.tif,.bmp"
                    className="hidden"
                    onChange={e => { if (e.target.files?.[0]) selectFile(e.target.files[0]); }}
                  />
                  <p className="text-xs text-slate-400 mt-4">
                    Supports: Patta · 7/12 Extract · Chitta · Jamabandi · Historical Deed · RoR
                  </p>
                </div>

                {/* Demo document cards */}
                <div className="space-y-3">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">✨ Try with demo documents</p>
                  {[
                    {
                      img: '/demo_land_record.jpg',
                      title: 'Maharashtra 7/12 Utara (Clear)',
                      desc: 'Rajesh Kumar Sharma · Survey 412/2 · Pune · 1.45 Ha',
                      tag: 'Clean scan',
                      tagColor: 'text-emerald-600 bg-emerald-50 border-emerald-200',
                      file: 'demo_land_record_7_12.jpg',
                    },
                    {
                      img: '/demo_torn_faded.jpg',
                      title: '1968 Khasra Register — UP (Torn & Faded)',
                      desc: 'Ram Prasad Tiwari · Khasra 78/3 · Sultanpur, Lucknow · 3 Bigha',
                      tag: '🔬 Damaged doc test',
                      tagColor: 'text-amber-600 bg-amber-50 border-amber-200',
                      file: 'demo_torn_faded.jpg',
                    },
                  ].map((doc) => (
                    <div key={doc.file} className="bg-white border border-slate-200 rounded-xl p-3 flex items-start gap-3">
                      <div className="w-12 h-16 rounded-lg border border-slate-200 flex-shrink-0 overflow-hidden shadow-sm">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={doc.img} alt={doc.title} className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-xs font-bold text-slate-800 leading-tight">{doc.title}</p>
                        </div>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${doc.tagColor}`}>
                          {doc.tag}
                        </span>
                        <p className="text-xs text-slate-500 mt-1">{doc.desc}</p>
                        <div className="flex gap-2 mt-2">
                          <a
                            href={doc.img}
                            download={doc.file}
                            onClick={e => e.stopPropagation()}
                            className="flex items-center gap-1 text-xs font-semibold text-slate-600 bg-slate-50 border border-slate-200 hover:bg-slate-100 px-2.5 py-1 rounded-lg transition-all"
                          >
                            <Download size={11} /> Save
                          </a>
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              const res = await fetch(doc.img);
                              const blob = await res.blob();
                              const f = new File([blob], doc.file, { type: 'image/jpeg' });
                              selectFile(f);
                            }}
                            className="flex items-center gap-1 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-500 px-2.5 py-1 rounded-lg transition-all"
                          >
                            <Zap size={11} /> Use This
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="bg-white border border-slate-200 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center">
                      <FileText size={18} className="text-purple-500" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800 text-sm">{file.name}</p>
                      <p className="text-slate-400 text-xs">{(file.size / 1024).toFixed(1)} KB · {file.type || 'Unknown type'}</p>
                    </div>
                  </div>
                  {!isProcessing && (
                    <button onClick={reset} className="text-slate-400 hover:text-slate-600 p-1.5">
                      <X size={16} />
                    </button>
                  )}
                </div>
                {previewUrl && (
                  <div className="rounded-xl overflow-hidden border border-slate-100 mb-3 max-h-48 flex items-center justify-center bg-slate-50">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={previewUrl} alt="Document preview" className="max-h-48 object-contain" />
                  </div>
                )}
                {!isProcessing && !result && (
                  <button
                    onClick={runExtraction}
                    className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-bold py-3 rounded-xl transition-all shadow-md shadow-purple-500/20"
                  >
                    <Zap size={16} /> Run AI Extraction Pipeline
                  </button>
                )}
              </div>
            )}

            {/* Pipeline stages */}
            {(isProcessing || result) && (
              <div className="bg-white border border-slate-200 rounded-2xl p-5">
                <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
                  <Sparkles size={14} className="text-purple-500" />
                  AI Extraction Pipeline
                </h3>
                <div className="space-y-2">
                  {PIPELINE_STAGES.map((s, i) => {
                    const Icon = s.icon;
                    const isDone = result ? true : i < stageIndex;
                    const isActive = !result && i === stageIndex;
                    return (
                      <div key={s.id} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
                        isActive ? 'bg-purple-50 border border-purple-200' :
                        isDone  ? 'bg-emerald-50/60' : 'opacity-40'
                      }`}>
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          isDone  ? 'bg-emerald-500' :
                          isActive ? 'bg-purple-500 animate-pulse' : 'bg-slate-200'
                        }`}>
                          {isDone
                            ? <CheckCircle size={13} className="text-white" />
                            : isActive
                              ? <Loader2 size={13} className="text-white animate-spin" />
                              : <Icon size={13} className="text-slate-400" />
                          }
                        </div>
                        <span className={`text-sm font-medium ${
                          isDone ? 'text-emerald-700' :
                          isActive ? 'text-purple-700' : 'text-slate-400'
                        }`}>{s.label}</span>
                        {isActive && (
                          <span className="ml-auto text-xs text-purple-500 animate-pulse">Running…</span>
                        )}
                        {isDone && (
                          <span className="ml-auto text-xs text-emerald-500">✓ Done</span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {result && (
                  <div className="mt-4 p-3 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl flex items-center gap-3">
                    <CheckCircle size={18} className="text-emerald-500 flex-shrink-0" />
                    <div>
                      <p className="text-emerald-800 font-bold text-sm">Extraction Complete!</p>
                      <p className="text-emerald-600 text-xs mt-0.5">
                        {result.gemini_enhanced ? '✨ Enhanced by Gemini Vision AI' : 'Processed by Tesseract OCR'}
                        {' · '}
                        {result.fields.filter(f => f.value !== null).length} of {result.fields.length} fields extracted
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
                <AlertTriangle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            )}

            {/* How it works */}
            {!file && !result && (
              <div className="bg-white border border-slate-200 rounded-2xl p-5">
                <h3 className="text-sm font-bold text-slate-700 mb-4">How AI Extraction Works</h3>
                <div className="space-y-3">
                  {[
                    { step: '1', title: 'OpenCV Enhancement', desc: 'Grayscale → Denoise → Otsu Threshold for clarity' },
                    { step: '2', title: 'Tesseract OCR', desc: 'Multi-language text extraction (Hindi, Marathi, English)' },
                    { step: '3', title: 'Gemini Vision AI', desc: 'Google Gemini reads the image directly for 14-field extraction' },
                    { step: '4', title: 'Smart Merge', desc: 'Gemini fields take priority; OCR fills gaps' },
                    { step: '5', title: 'GIS Cross-Validation', desc: 'Area and boundary verified against PostGIS database' },
                  ].map(s => (
                    <div key={s.step} className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-purple-100 border border-purple-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-purple-700 font-bold text-xs">{s.step}</span>
                      </div>
                      <div>
                        <p className="text-slate-800 font-semibold text-sm">{s.title}</p>
                        <p className="text-slate-500 text-xs">{s.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── RIGHT: Extracted Fields ── */}
          <div>
            {!result && !isProcessing && (
              <div className="bg-white border border-slate-200 rounded-2xl p-8 h-full flex flex-col items-center justify-center text-center">
                <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-purple-50 to-blue-50 border border-purple-100 flex items-center justify-center mb-5">
                  <Eye size={32} className="text-purple-300" />
                </div>
                <h3 className="text-slate-700 font-bold text-base mb-2">Extracted fields appear here</h3>
                <p className="text-slate-400 text-sm max-w-xs">
                  Upload a land document on the left to see all 14 structured fields extracted instantly by Gemini AI.
                </p>
                <div className="grid grid-cols-2 gap-2 mt-6 text-xs w-full max-w-xs">
                  {Object.values(FIELD_LABELS).slice(0, 8).map(l => (
                    <div key={l} className="bg-slate-50 border border-slate-100 rounded-lg px-2.5 py-1.5 text-slate-400 text-left">
                      {l}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {isProcessing && !result && (
              <div className="bg-white border border-slate-200 rounded-2xl p-8 h-full flex flex-col items-center justify-center">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center mb-5 shadow-lg shadow-purple-500/30">
                  <Brain size={28} className="text-white animate-pulse" />
                </div>
                <h3 className="text-slate-800 font-bold text-base mb-2">AI is reading your document…</h3>
                <p className="text-slate-400 text-sm mb-6">
                  Gemini Vision is analyzing every pixel of the scanned document
                </p>
                <div className="w-full max-w-xs space-y-2">
                  {Object.values(FIELD_LABELS).slice(0, 6).map((l, i) => (
                    <div key={l} className="flex items-center gap-2 text-xs" style={{ animationDelay: `${i * 100}ms` }}>
                      <div className="w-3 h-3 rounded-full bg-purple-200 animate-pulse flex-shrink-0" />
                      <div className="flex-1 h-3 bg-slate-100 rounded animate-pulse" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {result && (
              <div className="space-y-4">
                {/* Status header */}
                <div className={`flex items-center justify-between p-4 rounded-xl border ${
                  result.validation_status === 'Passed'
                    ? 'bg-emerald-50 border-emerald-200'
                    : 'bg-amber-50 border-amber-200'
                }`}>
                  <div className="flex items-center gap-2">
                    {result.validation_status === 'Passed'
                      ? <CheckCircle size={16} className="text-emerald-600" />
                      : <AlertTriangle size={16} className="text-amber-600" />
                    }
                    <span className={`font-bold text-sm ${
                      result.validation_status === 'Passed' ? 'text-emerald-800' : 'text-amber-800'
                    }`}>
                      Validation: {result.validation_status}
                    </span>
                    {result.gemini_enhanced && (
                      <span className="text-xs font-bold text-purple-600 bg-purple-100 border border-purple-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Sparkles size={10} /> Gemini Enhanced
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => router.push(`/verify/${result.document_id}`)}
                    className="flex items-center gap-1.5 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg transition-all"
                  >
                    Full Review <ChevronRight size={12} />
                  </button>
                </div>

                {/* Extracted fields grid */}
                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                  <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                      <FileText size={14} /> Extracted Fields
                    </h3>
                    <span className="text-xs text-slate-400">
                      {result.fields.filter(f => f.value !== null).length}/{result.fields.length} extracted
                    </span>
                  </div>
                  <div className="divide-y divide-slate-50">
                    {result.fields.map(f => (
                      <div key={f.key} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50/50 transition-colors">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-slate-400 font-medium">{f.label}</p>
                          <p className={`text-sm font-semibold mt-0.5 truncate ${
                            f.value ? 'text-slate-900' : 'text-slate-300 italic'
                          }`}>
                            {f.value !== null ? String(f.value) : 'Not found'}
                          </p>
                        </div>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ml-3 flex-shrink-0 ${confidenceColor(f.confidence)}`}>
                          {confidenceLabel(f.confidence)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Validation errors */}
                {result.validation_errors.length > 0 && (
                  <div className="bg-white border border-amber-200 rounded-2xl overflow-hidden">
                    <div className="px-4 py-3 bg-amber-50 border-b border-amber-100">
                      <h3 className="text-sm font-bold text-amber-800 flex items-center gap-2">
                        <AlertTriangle size={13} /> {result.validation_errors.length} Validation Issue(s)
                      </h3>
                    </div>
                    <div className="divide-y divide-amber-50">
                      {result.validation_errors.map((err, i) => (
                        <div key={i} className="px-4 py-3">
                          <p className="text-xs font-semibold text-amber-700">{err.field}</p>
                          <p className="text-xs text-amber-600 mt-0.5">{err.issue}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Raw OCR text */}
                {result.ocr_raw_text && result.ocr_raw_text.length > 10 && (
                  <details className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                    <summary className="px-4 py-3 text-xs font-semibold text-slate-500 cursor-pointer hover:bg-slate-50 flex items-center gap-2">
                      <FileSearch size={13} /> Raw OCR Text (click to expand)
                    </summary>
                    <pre className="px-4 py-3 text-xs text-slate-600 font-mono whitespace-pre-wrap max-h-40 overflow-y-auto bg-slate-50 border-t border-slate-100">
                      {result.ocr_raw_text}
                    </pre>
                  </details>
                )}

                {/* Action buttons */}
                <div className="flex gap-3">
                  <button
                    onClick={() => router.push(`/verify/${result.document_id}`)}
                    className="flex-1 flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-700 text-white font-semibold text-sm py-3 rounded-xl transition-all"
                  >
                    <Eye size={15} /> Open Verification Workbench
                  </button>
                  <button
                    onClick={reset}
                    className="flex items-center justify-center gap-2 border border-slate-200 hover:border-slate-300 text-slate-600 font-semibold text-sm py-3 px-4 rounded-xl transition-all"
                  >
                    <Upload size={15} /> New
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
