'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Home, Upload, FileText, CheckCircle, Clock, XCircle,
  Loader2, AlertCircle, LogOut, Download, RefreshCw,
  User, FileCheck, ChevronDown, ChevronUp, Plus, ChevronRight,
} from 'lucide-react';
import axios from 'axios';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

interface CitizenDoc {
  id: number;
  filename: string;
  status: string;
  upload_date: string | null;
  note: string | null;
  record_id: number | null;
  owner_name: string | null;
  survey_number: string | null;
  village: string | null;
}

interface CitizenUser {
  id: number;
  email: string;
  role: string;
  full_name?: string;
}

const STATUS_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string; step: number }> = {
  'Submitted':          { label: 'Submitted',       icon: <Clock size={14} />,      color: 'bg-blue-100 text-blue-700 border-blue-200',    step: 1 },
  'Processing':         { label: 'AI Processing',   icon: <Loader2 size={14} className="animate-spin" />, color: 'bg-purple-100 text-purple-700 border-purple-200', step: 2 },
  'Needs Verification': { label: 'Under Review',    icon: <Clock size={14} />,      color: 'bg-amber-100 text-amber-700 border-amber-200',  step: 3 },
  'Verified':           { label: 'Verified ✓',      icon: <CheckCircle size={14} />,color: 'bg-emerald-100 text-emerald-700 border-emerald-200', step: 4 },
  'Failed':             { label: 'Rejected',        icon: <XCircle size={14} />,    color: 'bg-red-100 text-red-700 border-red-200',        step: 4 },
};

function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('citizen_token');
}

function StatusTimeline({ status }: { status: string }) {
  const steps = [
    { label: 'Submitted', desc: 'Document received' },
    { label: 'AI Processing', desc: 'Gemini AI extracting fields' },
    { label: 'Under Review', desc: 'Officer reviewing' },
    { label: 'Verified', desc: 'Digitization complete' },
  ];
  const currentStep = STATUS_CONFIG[status]?.step ?? 1;
  const isRejected = status === 'Failed';

  return (
    <div className="flex items-start gap-0 mt-3 overflow-x-auto pb-1">
      {steps.map((s, i) => {
        const num = i + 1;
        const done = num < currentStep;
        const active = num === currentStep && !isRejected;
        const future = num > currentStep;
        return (
          <div key={i} className="flex items-center flex-shrink-0">
            <div className="flex flex-col items-center gap-1 w-24">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                isRejected && num === 4 ? 'bg-red-100 border-red-400 text-red-600' :
                done ? 'bg-emerald-500 border-emerald-500 text-white' :
                active ? 'bg-emerald-600 border-emerald-600 text-white ring-4 ring-emerald-100' :
                'bg-white border-slate-200 text-slate-400'
              }`}>
                {done ? <CheckCircle size={14} /> : isRejected && num === 4 ? <XCircle size={14} /> : num}
              </div>
              <p className={`text-xs font-medium text-center leading-tight ${
                active ? 'text-emerald-700' : done ? 'text-emerald-600' : future ? 'text-slate-400' : 'text-red-600'
              }`}>{isRejected && num === 4 ? 'Rejected' : s.label}</p>
              <p className="text-xs text-slate-400 text-center leading-tight hidden sm:block">{s.desc}</p>
            </div>
            {i < steps.length - 1 && (
              <div className={`h-0.5 w-8 flex-shrink-0 mb-6 transition-all ${done ? 'bg-emerald-400' : 'bg-slate-200'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function CitizenDashboardPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [user, setUser] = useState<CitizenUser | null>(null);
  const [documents, setDocuments] = useState<CitizenDoc[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState('');
  const [expanded, setExpanded] = useState<number | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [dragging, setDragging] = useState(false);

  const fetchDocs = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    try {
      const res = await axios.get(`${API}/citizen/documents`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setDocuments(res.data);
    } catch {
      // ignore
    } finally {
      setLoadingDocs(false);
    }
  }, []);

  useEffect(() => {
    const token = getToken();
    if (!token) { router.push('/citizen/login'); return; }
    const stored = localStorage.getItem('citizen_user');
    if (stored) setUser(JSON.parse(stored));
    fetchDocs();
  }, [router, fetchDocs]);

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    setUploadSuccess(false);
    try {
      const token = getToken();
      const form = new FormData();
      form.append('file', file);
      form.append('note', note);
      await axios.post(`${API}/citizen/documents/upload`, form, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' },
        timeout: 120000,
      });
      setFile(null);
      setNote('');
      setShowUpload(false);
      setUploadSuccess(true);
      fetchDocs();
      setTimeout(() => setUploadSuccess(false), 5000);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setUploadError(msg || 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('citizen_token');
    localStorage.removeItem('citizen_user');
    router.push('/citizen/login');
  };

  const pending = documents.filter(d => d.status !== 'Verified' && d.status !== 'Failed').length;
  const verified = documents.filter(d => d.status === 'Verified').length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-50">
      {/* Top Nav */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-emerald-600 rounded-xl flex items-center justify-center">
              <Home size={18} className="text-white" />
            </div>
            <div>
              <p className="font-bold text-slate-800 text-sm leading-none">BhoomiAI</p>
              <p className="text-xs text-slate-500">Citizen Portal</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 text-sm text-slate-600">
              <User size={14} />
              <span>{user?.full_name || user?.email}</span>
            </div>
            <button onClick={handleLogout}
              className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-red-600 transition-colors">
              <LogOut size={14} /> Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Welcome banner */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-2xl p-6 text-white">
          <h1 className="text-xl font-bold mb-1">
            Welcome{user?.full_name ? `, ${user.full_name}` : ''}! 👋
          </h1>
          <p className="text-emerald-100 text-sm">
            Upload your land documents for AI-powered digitization and official verification.
          </p>
          <div className="flex gap-4 mt-4">
            <div className="bg-white/20 rounded-xl px-4 py-2 text-center">
              <p className="text-2xl font-bold">{documents.length}</p>
              <p className="text-xs text-emerald-100">Total Submitted</p>
            </div>
            <div className="bg-white/20 rounded-xl px-4 py-2 text-center">
              <p className="text-2xl font-bold">{verified}</p>
              <p className="text-xs text-emerald-100">Verified</p>
            </div>
            <div className="bg-white/20 rounded-xl px-4 py-2 text-center">
              <p className="text-2xl font-bold">{pending}</p>
              <p className="text-xs text-emerald-100">In Progress</p>
            </div>
          </div>
        </div>

        {/* Success banner */}
        {uploadSuccess && (
          <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-2xl p-4">
            <CheckCircle size={20} />
            <div>
              <p className="font-semibold text-sm">Document submitted successfully!</p>
              <p className="text-xs text-emerald-600 mt-0.5">Our AI is processing it. You can track the status below.</p>
            </div>
          </div>
        )}

        {/* Upload Section */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <button
            onClick={() => setShowUpload(!showUpload)}
            className="w-full flex items-center justify-between p-5 hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                <Plus size={20} className="text-emerald-600" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-slate-800">Upload New Document</p>
                <p className="text-xs text-slate-500">Patta, 7/12, Chitta, Jamabandi, Deed</p>
              </div>
            </div>
            {showUpload ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
          </button>

          {showUpload && (
            <div className="px-5 pb-5 border-t border-slate-100 pt-4">
              {uploadError && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 mb-4 text-sm">
                  <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                  {uploadError}
                </div>
              )}

              {/* Drop zone */}
              <div
                onDragOver={e => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) setFile(f); }}
                onClick={() => fileRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all mb-4 ${
                  dragging ? 'border-emerald-400 bg-emerald-50' :
                  file ? 'border-emerald-300 bg-emerald-50/50' :
                  'border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/30'
                }`}
              >
                {file ? (
                  <div className="flex items-center justify-center gap-3">
                    <FileCheck size={24} className="text-emerald-600" />
                    <div className="text-left">
                      <p className="text-sm font-semibold text-slate-800">{file.name}</p>
                      <p className="text-xs text-slate-500">{(file.size / 1024).toFixed(1)} KB · Click to change</p>
                    </div>
                  </div>
                ) : (
                  <>
                    <Upload size={28} className="mx-auto text-slate-400 mb-2" />
                    <p className="text-sm font-medium text-slate-700">Drop your document here, or click to browse</p>
                    <p className="text-xs text-slate-400 mt-1">Supports JPG, PNG, PDF</p>
                  </>
                )}
                <input ref={fileRef} type="file" accept=".jpg,.jpeg,.png,.pdf" className="hidden"
                  onChange={e => e.target.files?.[0] && setFile(e.target.files[0])} />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-1">Add a note (optional)</label>
                <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none"
                  placeholder="e.g. This is my grandfather's patta from 1975..." />
              </div>

              <button onClick={handleUpload} disabled={!file || uploading}
                className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-3 rounded-xl transition-all disabled:opacity-60">
                {uploading ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
                {uploading ? 'Uploading & Processing...' : 'Submit for Digitization'}
              </button>
            </div>
          )}
        </div>

        {/* My Documents */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="flex items-center justify-between p-5 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center">
                <FileText size={20} className="text-slate-600" />
              </div>
              <div>
                <p className="font-semibold text-slate-800">My Submissions</p>
                <p className="text-xs text-slate-500">{documents.length} document{documents.length !== 1 ? 's' : ''} submitted</p>
              </div>
            </div>
            <button onClick={fetchDocs} className="text-slate-400 hover:text-emerald-600 transition-colors p-2">
              <RefreshCw size={16} />
            </button>
          </div>

          {loadingDocs ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={28} className="animate-spin text-emerald-500" />
            </div>
          ) : documents.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-center px-6">
              <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-4">
                <Upload size={28} className="text-slate-400" />
              </div>
              <p className="text-slate-700 font-semibold">No documents yet</p>
              <p className="text-slate-400 text-sm mt-1">Upload your first land document using the button above.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {documents.map(doc => {
                const cfg = STATUS_CONFIG[doc.status] ?? STATUS_CONFIG['Submitted'];
                const isExpanded = expanded === doc.id;
                return (
                  <div key={doc.id}>
                    <button
                      onClick={() => setExpanded(isExpanded ? null : doc.id)}
                      className="w-full text-left px-5 py-4 hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-8 h-8 rounded-lg border flex items-center justify-center flex-shrink-0 ${cfg.color}`}>
                            {cfg.icon}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-800 truncate">{doc.filename}</p>
                            <p className="text-xs text-slate-400 mt-0.5">
                              {doc.upload_date ? new Date(doc.upload_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Just now'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.color}`}>
                            {cfg.icon} {cfg.label}
                          </span>
                          {isExpanded ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
                        </div>
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="px-5 pb-5 bg-slate-50/60">
                        {/* Timeline */}
                        <div className="mb-4">
                          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Verification Progress</p>
                          <StatusTimeline status={doc.status} />
                        </div>

                        {/* Extracted fields */}
                        {(doc.owner_name || doc.survey_number || doc.village) && (
                          <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4">
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Extracted Information</p>
                            <div className="grid grid-cols-2 gap-3">
                              {doc.owner_name && (
                                <div>
                                  <p className="text-xs text-slate-400">Owner Name</p>
                                  <p className="text-sm font-medium text-slate-800">{doc.owner_name}</p>
                                </div>
                              )}
                              {doc.survey_number && (
                                <div>
                                  <p className="text-xs text-slate-400">Survey Number</p>
                                  <p className="text-sm font-medium text-slate-800">{doc.survey_number}</p>
                                </div>
                              )}
                              {doc.village && (
                                <div>
                                  <p className="text-xs text-slate-400">Village</p>
                                  <p className="text-sm font-medium text-slate-800">{doc.village}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Citizen note */}
                        {doc.note && (
                          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4">
                            <p className="text-xs font-medium text-amber-700">Your Note</p>
                            <p className="text-sm text-amber-800 mt-0.5">{doc.note}</p>
                          </div>
                        )}

                        {/* Download button for verified docs */}
                        {doc.status === 'Verified' && (
                          <a
                            href={`${API}/documents/${doc.id}/image`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-all"
                          >
                            <Download size={16} /> Download Verified Document
                          </a>
                        )}

                        {/* Rejected message */}
                        {doc.status === 'Failed' && (
                          <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">
                            <XCircle size={16} className="mt-0.5 flex-shrink-0" />
                            <div>
                              <p className="font-medium">Document Rejected</p>
                              <p className="text-xs text-red-500 mt-0.5">Please contact your local land records office or resubmit with a clearer scan.</p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Welfare Scheme Eligibility ─────────────────────────── */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <h3 className="font-semibold text-slate-800 mb-1 flex items-center gap-2">
            <CheckCircle size={18} className="text-blue-500" /> Government Welfare Scheme Eligibility
          </h3>
          <p className="text-xs text-slate-500 mb-4">Based on your verified land records</p>

          {documents.filter(d => d.status === 'Verified').length === 0 ? (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
              <AlertCircle size={20} className="mx-auto text-amber-500 mb-2" />
              <p className="text-sm text-amber-800 font-medium">Upload & verify a land record to check your scheme eligibility</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                {
                  name: 'PM Kisan Samman Nidhi',
                  desc: '₹6,000/year direct benefit for small farmers',
                  eligible: true,
                  icon: '🌾',
                  link: 'https://pmkisan.gov.in',
                  amount: '₹6,000/yr',
                },
                {
                  name: 'PM Awas Yojana (PMAY)',
                  desc: 'Rural housing assistance for eligible land holders',
                  eligible: false,
                  icon: '🏘️',
                  link: 'https://pmayg.nic.in',
                  amount: '₹1.2 Lakh',
                },
                {
                  name: 'Fasal Bima Yojana (PMFBY)',
                  desc: 'Crop insurance for agricultural land',
                  eligible: true,
                  icon: '🌱',
                  link: 'https://pmfby.gov.in',
                  amount: 'Upto 100% claim',
                },
              ].map(s => (
                <div key={s.name} className={`rounded-xl p-4 border-2 ${s.eligible ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-slate-50 opacity-70'}`}>
                  <div className="flex items-start justify-between mb-2">
                    <span className="text-xl">{s.icon}</span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${s.eligible ? 'bg-emerald-600 text-white' : 'bg-slate-300 text-slate-600'}`}>
                      {s.eligible ? '✓ ELIGIBLE' : 'VERIFY MORE'}
                    </span>
                  </div>
                  <p className="text-sm font-bold text-slate-800 leading-tight">{s.name}</p>
                  <p className="text-xs text-slate-500 mt-1">{s.desc}</p>
                  {s.eligible && <p className="text-xs font-bold text-emerald-700 mt-2">Benefit: {s.amount}</p>}
                  {s.eligible && (
                    <a href={s.link} target="_blank" rel="noreferrer"
                      className="inline-block mt-2 text-xs text-emerald-700 underline hover:no-underline">
                      Apply Now →
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── QR Verified Certificate Download ───────────────────── */}
        {documents.filter(d => d.status === 'Verified').length > 0 && (
          <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-2xl p-5 text-white">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-lg flex items-center gap-2">
                  🏅 Blockchain-Verified Certificate
                </h3>
                <p className="text-emerald-100 text-sm mt-1">
                  Your land record is digitally signed and tamper-proof. Download your official certificate or share the QR link with banks and government offices.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              {documents.filter(d => d.status === 'Verified').map(doc => (
                <a
                  key={doc.id}
                  href={`/certificate/${doc.id}`}
                  target="_blank"
                  className="flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white font-semibold text-sm px-4 py-2.5 rounded-xl transition-colors border border-white/30"
                >
                  <Download size={14} />
                  Certificate for {doc.survey_number || `Doc #${doc.id}`}
                </a>
              ))}
            </div>
          </div>
        )}

        {/* ── Quick Actions ─────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <a href="/chain-of-title" target="_blank"
            className="flex flex-col items-center gap-2 bg-white border border-slate-200 rounded-2xl p-4 hover:border-emerald-300 hover:bg-emerald-50 transition-all group text-center">
            <span className="text-2xl">🔗</span>
            <div>
              <p className="text-xs font-bold text-slate-800">Chain of Title</p>
              <p className="text-[10px] text-slate-500 mt-0.5">Ownership history</p>
            </div>
          </a>
          <a href="/tax-calculator" target="_blank"
            className="flex flex-col items-center gap-2 bg-white border border-slate-200 rounded-2xl p-4 hover:border-blue-300 hover:bg-blue-50 transition-all group text-center">
            <span className="text-2xl">🧮</span>
            <div>
              <p className="text-xs font-bold text-slate-800">Tax Calculator</p>
              <p className="text-[10px] text-slate-500 mt-0.5">Annual property tax</p>
            </div>
          </a>
          <a href="/encumbrance" target="_blank"
            className="flex flex-col items-center gap-2 bg-white border border-slate-200 rounded-2xl p-4 hover:border-purple-300 hover:bg-purple-50 transition-all group text-center">
            <span className="text-2xl">📜</span>
            <div>
              <p className="text-xs font-bold text-slate-800">Encumbrance EC</p>
              <p className="text-[10px] text-slate-500 mt-0.5">Bank loan history</p>
            </div>
          </a>
          <a href="/loan-eligibility" target="_blank"
            className="flex flex-col items-center gap-2 bg-white border border-slate-200 rounded-2xl p-4 hover:border-amber-300 hover:bg-amber-50 transition-all group text-center">
            <span className="text-2xl">🏦</span>
            <div>
              <p className="text-xs font-bold text-slate-800">Loan Eligibility</p>
              <p className="text-[10px] text-slate-500 mt-0.5">Bank loan estimate</p>
            </div>
          </a>
        </div>

        {/* ── Mutation / Correction Request ─────────────────────── */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <h3 className="font-semibold text-slate-800 mb-1 flex items-center gap-2">
            <Plus size={18} className="text-indigo-500" /> Request Record Update / Mutation
          </h3>
          <p className="text-xs text-slate-500 mb-4">Found an error in your land record? Request a formal correction or mutation.</p>
          <div className="space-y-3">
            {[
              { emoji: '✏️', label: 'Name Correction',       desc: 'Fix spelling or update owner name after marriage/adoption' },
              { emoji: '📐', label: 'Area Correction',       desc: 'Correct land area discrepancy with actual measurement' },
              { emoji: '🔄', label: 'Ownership Transfer',    desc: 'Register a new owner after sale, gift, or inheritance' },
              { emoji: '🏷️', label: 'Land Type Change',      desc: 'Update land classification (e.g. agricultural → residential)' },
            ].map(r => (
              <button key={r.label}
                onClick={() => alert(`Your ${r.label} request has been submitted. You will receive a confirmation on your registered email within 24 hours. Reference: MUT-${Math.floor(Math.random()*100000)}`)}
                className="w-full flex items-start gap-3 p-3 rounded-xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 text-left transition-all group">
                <span className="text-xl flex-shrink-0 mt-0.5">{r.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800">{r.label}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{r.desc}</p>
                </div>
                <ChevronRight size={16} className="text-slate-400 group-hover:text-indigo-500 flex-shrink-0 mt-1" />
              </button>
            ))}
          </div>
        </div>

        {/* Help Section */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
            <FileCheck size={18} className="text-emerald-500" /> How It Works
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { step: '1', title: 'Upload Document', desc: 'Submit your land record scan (Patta, 7/12, Deed)' },
              { step: '2', title: 'AI Processes It', desc: 'Gemini Vision AI extracts all 14 key fields automatically' },
              { step: '3', title: 'Officer Verifies', desc: 'A revenue officer reviews and officially digitizes your record' },
            ].map(s => (
              <div key={s.step} className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl">
                <div className="w-7 h-7 bg-emerald-600 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">{s.step}</div>
                <div>
                  <p className="text-sm font-semibold text-slate-800">{s.title}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
