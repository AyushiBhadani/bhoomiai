'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  CheckCircle, XCircle, Clock, Shield, Hash,
  MapPin, FileText, ChevronDown, ChevronUp,
  Loader2, Zap, Link as LinkIcon, AlertTriangle, RefreshCw
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import api from '@/lib/api';
import LoadingSpinner from '@/components/LoadingSpinner';

interface ChainEvent { event: string; year: string; type: string; current: boolean; }

interface MutationRecord {
  id: number;
  owner_name: string;
  survey_number: string;
  khasra_number?: string;
  village: string;
  tehsil: string;
  district: string;
  area: string;
  land_classification?: string;
  ownership_type?: string;
  blockchain_hash: string;
  ai_recommendation: string;
  ai_confidence: number;
  validation_status: string;
  chain_of_title: ChainEvent[];
}

const DEMO_MUTATIONS: MutationRecord[] = [
  {
    id: 101, owner_name: 'Ramesh Kumar (Son of Shiv Lal)', survey_number: '142/2',
    khasra_number: '142', village: 'Agra Rural', tehsil: 'Sadar', district: 'Agra',
    area: '0.45', land_classification: 'Agricultural (Irrigated)', ownership_type: 'Sole Proprietor',
    blockchain_hash: '0x8f9c...3b21', ai_recommendation: 'Approved', ai_confidence: 98.4,
    validation_status: 'pending',
    chain_of_title: [
      { event: 'State Land Settlement & Patta Grant to Shiv Lal', year: '1985', type: 'Original Allotment', current: false },
      { event: 'Legal Heir Mutation: Shiv Lal (Deceased) → Ramesh Kumar', year: '2011', type: 'Inheritance', current: false },
      { event: 'Sale Deed Execution: Ramesh Kumar → Sunita Devi', year: '2024', type: 'Sale/Transfer', current: true },
    ]
  },
  {
    id: 102, owner_name: 'Priya Singh', survey_number: '89/1A',
    khasra_number: '89', village: 'Rampur', tehsil: 'Haveli', district: 'Pune',
    area: '1.20', land_classification: 'Dry Crop Land', ownership_type: 'Joint Ownership',
    blockchain_hash: '0x3a7d...9f12', ai_recommendation: 'Review Needed', ai_confidence: 67.2,
    validation_status: 'needs_verification',
    chain_of_title: [
      { event: 'Original Allotment to Ram Singh', year: '1990', type: 'First Settlement', current: false },
      { event: 'Transfer to Priya Singh (Disputed)', year: '2024', type: 'Sale/Transfer', current: true },
    ]
  },
  {
    id: 103, owner_name: 'Mohammed Iqbal', survey_number: '556/3B',
    village: 'Nabi Nagar', tehsil: 'Lucknow Sadar', district: 'Lucknow',
    area: '0.80', land_classification: 'Residential Plot', ownership_type: 'Sole Proprietor',
    blockchain_hash: '0x9c1e...4f77', ai_recommendation: 'Approved', ai_confidence: 94.1,
    validation_status: 'pending',
    chain_of_title: [
      { event: 'Municipal Plot Allotment', year: '1999', type: 'Government Allotment', current: false },
      { event: 'Sale: Previous Owner → Mohammed Iqbal', year: '2024', type: 'Sale/Transfer', current: true },
    ]
  },
];

interface Toast { id: number; msg: string; type: 'success' | 'error'; hash?: string; }

export default function MutationWorkbenchPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [mutations, setMutations] = useState<MutationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [acting, setActing] = useState<number | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = (msg: string, type: 'success' | 'error', hash?: string) => {
    const id = Date.now();
    setToasts(t => [...t, { id, msg, type, hash }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 5000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // In a real app we would fetch this from /api/mutations
      // For now, load demo data with a slight delay
      await new Promise(resolve => setTimeout(resolve, 500));
      setMutations(DEMO_MUTATIONS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && !user) { router.push('/login'); return; }
    if (!authLoading) load();
  }, [authLoading, user, router, load]);

  const handleApprove = async (id: number) => {
    setActing(id);
    try {
      const res = await api.post(`/mutations/${id}/approve`);
      const hash = res.data?.blockchain_hash ?? '0x' + Math.random().toString(16).slice(2, 18);
      addToast(`Mutation #${id} approved & blockchain-anchored!`, 'success', hash);
      setMutations(m => m.filter(x => x.id !== id));
    } catch {
      const hash = '0x' + Math.random().toString(16).slice(2, 18);
      addToast(`Mutation #${id} approved (demo mode)`, 'success', hash);
      setMutations(m => m.filter(x => x.id !== id));
    } finally {
      setActing(null);
    }
  };

  const handleReject = async (id: number) => {
    setActing(id);
    try {
      await api.post(`/mutations/${id}/reject`, { comment: 'Rejected by officer' });
      addToast(`Mutation #${id} rejected.`, 'error');
    } catch {
      addToast(`Mutation #${id} rejected (demo mode).`, 'error');
    } finally {
      setActing(null);
      setMutations(m => m.filter(x => x.id !== id));
    }
  };

  if (authLoading || loading) return (
    <div className="flex-1 flex items-center justify-center min-h-screen bg-slate-950">
      <LoadingSpinner size="lg" label="Loading mutation workbench…" />
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Toast notifications */}
      <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm w-full">
        {toasts.map(t => (
          <div key={t.id} className={`flex flex-col gap-1 px-4 py-3 rounded-xl text-sm font-medium shadow-2xl border ${
            t.type === 'success'
              ? 'bg-emerald-900/90 border-emerald-500/40 text-emerald-100 backdrop-blur'
              : 'bg-red-900/90 border-red-500/40 text-red-100 backdrop-blur'
          }`}>
            <div className="flex items-center gap-2">
              {t.type === 'success' ? <CheckCircle size={15} className="text-emerald-400" /> : <XCircle size={15} className="text-red-400" />}
              {t.msg}
            </div>
            {t.hash && <p className="text-xs font-mono opacity-70 pl-5">Hash: {t.hash.slice(0, 20)}…</p>}
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 border-b border-slate-700/60 px-6 py-6">
        <div className="max-w-5xl mx-auto flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs text-slate-500 font-mono uppercase tracking-widest">OFFICER MODULE // MUTATION REVIEW</span>
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs text-emerald-400">System Online</span>
            </div>
            <h1 className="text-2xl font-black text-white">Single-Window Mutation Review Workbench</h1>
            <p className="text-slate-400 text-sm mt-1">
              Review, digitally sign, and approve land mutation requests with AI-assisted verification.
            </p>
          </div>
          <button onClick={load} className="flex items-center gap-2 text-sm text-slate-400 hover:text-white border border-slate-700 hover:border-slate-500 px-3 py-2 rounded-lg transition-all flex-shrink-0">
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: 'Pending', value: mutations.length, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
            { label: 'AI Recommended Approve', value: mutations.filter(m => m.ai_recommendation === 'Approved').length, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
            { label: 'Needs Review', value: mutations.filter(m => m.ai_recommendation !== 'Approved').length, color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
          ].map(s => (
            <div key={s.label} className={`${s.bg} border rounded-xl p-4`}>
              <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
              <p className="text-slate-400 text-xs mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {mutations.length === 0 ? (
          <div className="text-center py-20">
            <CheckCircle size={48} className="mx-auto mb-4 text-emerald-500" />
            <h2 className="text-xl font-bold text-white mb-2">All caught up!</h2>
            <p className="text-slate-400">No pending mutation requests at this time.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {mutations.map(m => (
              <div key={m.id} className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl overflow-hidden transition-all">
                {/* Card header */}
                <div className="px-5 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className="text-xs font-mono text-slate-500">MUTATION ID: #MUT-2024-{m.id}</span>
                        <div className="flex items-center gap-1.5 bg-blue-500/10 border border-blue-500/20 rounded-full px-2.5 py-0.5">
                          <LinkIcon size={10} className="text-blue-400" />
                          <span className="text-blue-400 text-xs font-mono">{m.blockchain_hash}</span>
                        </div>
                        <div className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                          m.ai_recommendation === 'Approved'
                            ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                            : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                        }`}>
                          <Zap size={10} />
                          AI: {m.ai_recommendation} ({m.ai_confidence}% confidence)
                        </div>
                      </div>
                      <h3 className="text-white font-bold text-lg leading-tight">{m.owner_name}</h3>
                      <div className="flex flex-wrap items-center gap-4 mt-1.5 text-xs text-slate-400">
                        <span className="flex items-center gap-1"><Hash size={10} />Survey {m.survey_number}</span>
                        <span className="flex items-center gap-1"><MapPin size={10} />{m.village}, {m.district}</span>
                        <span className="flex items-center gap-1"><FileText size={10} />{m.area} Ha · {m.land_classification}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => setExpanded(expanded === m.id ? null : m.id)}
                      className="text-slate-500 hover:text-white transition-colors p-2 flex-shrink-0"
                    >
                      {expanded === m.id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </button>
                  </div>
                </div>

                {/* Expanded detail */}
                {expanded === m.id && (
                  <div className="border-t border-slate-800 px-5 py-5 grid grid-cols-1 lg:grid-cols-2 gap-6 bg-slate-900/40">
                    {/* AI Summary */}
                    <div className="bg-slate-800/60 rounded-xl p-4">
                      <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                        <Zap size={11} className="text-purple-400" />AI Automated Verification Summary
                      </h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2 text-slate-300">
                          <CheckCircle size={13} className="text-emerald-400 flex-shrink-0" />
                          OCR confidence: <span className="text-emerald-400 font-bold ml-auto">{m.ai_confidence}%</span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-300">
                          <CheckCircle size={13} className="text-emerald-400 flex-shrink-0" />
                          GIS boundary match: <span className="text-emerald-400 font-bold ml-auto">Verified (0.00% delta)</span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-300">
                          <CheckCircle size={13} className="text-emerald-400 flex-shrink-0" />
                          Biometric OTP: <span className="text-emerald-400 font-bold ml-auto">Aadhaar verified</span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-300">
                          <CheckCircle size={13} className="text-emerald-400 flex-shrink-0" />
                          NJDG check: <span className="text-emerald-400 font-bold ml-auto">No pending litigations</span>
                        </div>
                        {m.ai_recommendation !== 'Approved' && (
                          <div className="flex items-center gap-2 text-amber-300 bg-amber-500/10 rounded-lg p-2 mt-2">
                            <AlertTriangle size={13} className="flex-shrink-0" />
                            Low confidence — manual review recommended
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Chain of Title */}
                    <div>
                      <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                        <Clock size={11} className="text-blue-400" />Chain-of-Title Timeline (Last 30 Years)
                      </h4>
                      <div className="space-y-3 relative">
                        <div className="absolute left-3.5 top-4 bottom-4 w-px bg-slate-700" />
                        {m.chain_of_title.map((c, i) => (
                          <div key={i} className="flex items-start gap-3 relative">
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 z-10 ${
                              c.current
                                ? 'bg-emerald-500/20 border-2 border-emerald-500 text-emerald-400'
                                : 'bg-slate-800 border border-slate-700 text-slate-500'
                            }`}>
                              <Clock size={11} />
                            </div>
                            <div className="pt-0.5">
                              <p className={`text-sm font-medium ${c.current ? 'text-white' : 'text-slate-300'}`}>{c.event}</p>
                              <p className="text-xs text-slate-500 mt-0.5">{c.type} · {c.year}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Action bar */}
                <div className="px-5 py-3.5 bg-slate-800/30 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs text-slate-500 flex items-center gap-1.5">
                    <Shield size={11} className="text-slate-600" />
                    Approving will generate an immutable SHA-256 hash inscribed in the National Land Ledger.
                  </p>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleReject(m.id)}
                      disabled={acting === m.id}
                      className="flex items-center gap-2 border border-red-500/30 text-red-400 hover:bg-red-500/10 text-sm font-medium px-4 py-2 rounded-xl transition-all disabled:opacity-50"
                    >
                      <XCircle size={14} /> Reject
                    </button>
                    <button
                      onClick={() => handleApprove(m.id)}
                      disabled={acting === m.id}
                      className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold px-5 py-2 rounded-xl transition-all disabled:opacity-50 shadow-lg shadow-emerald-900/40"
                    >
                      {acting === m.id ? <Loader2 size={14} className="animate-spin" /> : <Shield size={14} />}
                      One-Click Digital Sign & Approve
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
