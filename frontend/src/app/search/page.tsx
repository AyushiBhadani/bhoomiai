'use client';

/**
 * Intelligent Land Record Search — instant search across all records
 * with field targeting, confidence display, and quick actions.
 */
import React, { useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Search, MapPin, FileText, User, Hash,
  ExternalLink, Loader2, AlertCircle, Filter,
  CheckCircle, XCircle, Clock, Zap, X,
  ChevronRight, Database,
} from 'lucide-react';

import api from '@/lib/api';
import type { SearchRecord } from '@/lib/types';
import StatusBadge from '@/components/StatusBadge';
import ConfidenceBadge from '@/components/ConfidenceBadge';
import { useAuth } from '@/lib/auth-context';
import { useEffect } from 'react';

const FIELD_OPTIONS = [
  { value: 'all',           label: 'All Fields' },
  { value: 'owner_name',    label: 'Owner Name' },
  { value: 'survey_number', label: 'Survey Number' },
  { value: 'khasra_number', label: 'Khasra Number' },
  { value: 'village',       label: 'Village' },
  { value: 'district',      label: 'District' },
];

const QUICK_SEARCHES = ['Survey 412/2', 'Rampur', 'Khasra 45', 'Agra', 'Verified'];

const STATUS_ICONS: Record<string, React.ReactNode> = {
  verified:          <CheckCircle size={12} className="text-emerald-500" />,
  needs_verification: <Clock size={12} className="text-amber-500" />,
  failed:            <XCircle size={12} className="text-red-500" />,
  processing:        <Loader2 size={12} className="text-blue-500 animate-spin" />,
};

function avgConfidence(rec: SearchRecord): number | null {
  if (!rec.confidence_scores) return null;
  const confMap: Record<string, number> = { high: 100, medium: 60, low: 20 };
  const vals = Object.values(rec.confidence_scores).map(v =>
    typeof v === 'number' ? v : (confMap[String(v)] ?? 50)
  );
  if (!vals.length) return null;
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}

export default function SearchPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();

  const [query, setQuery]   = useState('');
  const [field, setField]   = useState('all');
  const [results, setResults] = useState<SearchRecord[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState<string | null>(null);
  const [searched, setSearched] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [authLoading, user, router]);

  const doSearch = useCallback(async (q: string, f: string) => {
    if (!q.trim()) return;
    setLoading(true);
    setError(null);
    setSearched(q);
    try {
      const res = await api.get('/search', { params: { q, field: f } });
      const data = res.data;
      setResults(Array.isArray(data) ? data : data?.results ?? []);
    } catch {
      // Fallback demo results
      setResults([]);
      setError('Could not connect to server — showing empty state.');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    doSearch(query, field);
  };

  const handleQuick = (q: string) => {
    setQuery(q);
    doSearch(q, field);
    inputRef.current?.focus();
  };

  const clearSearch = () => {
    setQuery('');
    setResults(null);
    setSearched('');
    inputRef.current?.focus();
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 px-6 py-6">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-2 mb-1">
            <Database size={16} className="text-slate-400" />
            <h1 className="text-xl font-bold text-slate-900">Search Land Records</h1>
          </div>
          <p className="text-slate-500 text-sm">Full-text search across all extracted fields in the database.</p>

          {/* Search bar */}
          <form onSubmit={handleSubmit} className="mt-5 flex gap-3">
            <div className="flex-1 relative">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search by survey number, owner name, village, khasra…"
                className="w-full pl-10 pr-10 py-3 border border-slate-200 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 rounded-xl text-sm bg-white focus:outline-none transition-all"
              />
              {query && (
                <button type="button" onClick={clearSearch} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <X size={15} />
                </button>
              )}
            </div>

            <select
              value={field}
              onChange={e => setField(e.target.value)}
              className="border border-slate-200 rounded-xl px-3 py-3 text-sm bg-white focus:outline-none focus:border-emerald-400 text-slate-700 pr-8"
            >
              {FIELD_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>

            <button
              type="submit"
              disabled={!query.trim() || loading}
              className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold px-6 py-3 rounded-xl text-sm transition-all flex items-center gap-2 shadow-sm"
            >
              {loading ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
              Search
            </button>
          </form>

          {/* Quick search tags */}
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <span className="text-xs text-slate-400 flex items-center gap-1"><Zap size={11} />Quick:</span>
            {QUICK_SEARCHES.map(q => (
              <button
                key={q}
                onClick={() => handleQuick(q)}
                className="text-xs text-slate-500 hover:text-emerald-600 bg-slate-100 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 px-2.5 py-1 rounded-full transition-all"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6">
        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm mb-4">
            <AlertCircle size={15} className="flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <Loader2 size={32} className="animate-spin text-emerald-500 mb-3" />
            <p className="text-sm">Searching across all land records…</p>
          </div>
        )}

        {/* Results */}
        {!loading && results !== null && (
          <>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                {results.length > 0
                  ? <><CheckCircle size={14} className="text-emerald-500" /><span className="text-sm text-slate-700">Found <strong>{results.length}</strong> result{results.length !== 1 ? 's' : ''} for "<strong>{searched}</strong>"</span></>
                  : <><AlertCircle size={14} className="text-amber-500" /><span className="text-sm text-slate-500">No records found for "<strong>{searched}</strong>"</span></>
                }
              </div>
              {results.length > 0 && (
                <span className="text-xs text-slate-400">{field !== 'all' ? `Searched in: ${FIELD_OPTIONS.find(o => o.value === field)?.label}` : 'Searched all fields'}</span>
              )}
            </div>

            {results.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-2xl border border-slate-100">
                <Search size={40} className="mx-auto mb-3 text-slate-200" />
                <p className="text-slate-400 text-sm">Try a different search term or field filter.</p>
                <button onClick={clearSearch} className="mt-4 text-sm text-emerald-600 hover:underline">Clear search</button>
              </div>
            ) : (
              <div className="space-y-3">
                {results.map(rec => {
                  const conf = avgConfidence(rec);
                  return (
                    <div key={rec.id} className="bg-white border border-slate-100 hover:border-emerald-200 hover:shadow-sm rounded-2xl p-4 transition-all group">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            <StatusBadge status={rec.validation_status ?? 'pending'} />
                            {conf !== null && (
                              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                                conf >= 80 ? 'bg-emerald-50 text-emerald-700' :
                                conf >= 60 ? 'bg-amber-50 text-amber-700' :
                                'bg-red-50 text-red-600'
                              }`}>
                                {conf}% confidence
                              </span>
                            )}
                          </div>
                          <h3 className="text-slate-900 font-bold text-base">
                            {rec.owner_name ?? <span className="text-slate-400 italic">Unknown Owner</span>}
                          </h3>
                          <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-slate-500">
                            {rec.survey_number && (
                              <span className="flex items-center gap-1"><Hash size={11} />Survey {rec.survey_number}</span>
                            )}
                            {rec.village && (
                              <span className="flex items-center gap-1"><MapPin size={11} />{rec.village}{rec.district ? `, ${rec.district}` : ''}</span>
                            )}
                            {rec.area && (
                              <span className="flex items-center gap-1"><FileText size={11} />{rec.area} sq.m</span>
                            )}
                            {rec.khasra_number && (
                              <span className="flex items-center gap-1"><Hash size={11} />Khasra {rec.khasra_number}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2 flex-shrink-0">
                          <Link
                            href={`/verify/${rec.document_id ?? rec.id}`}
                            className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3 py-1.5 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                          >
                            <ExternalLink size={12} /> Review
                          </Link>
                          {rec.survey_number && (
                            <Link
                              href={`/map?survey_number=${rec.survey_number}`}
                              className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-3 py-1.5 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                            >
                              <MapPin size={12} /> View on Map
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* Empty initial state */}
        {!loading && results === null && (
          <div className="text-center py-20">
            <div className="w-20 h-20 rounded-3xl bg-white border border-slate-200 shadow-sm flex items-center justify-center mx-auto mb-5">
              <Search size={32} className="text-slate-300" />
            </div>
            <h2 className="text-lg font-bold text-slate-700 mb-1">Search across all land records</h2>
            <p className="text-slate-400 text-sm max-w-sm mx-auto">
              Enter a survey number, owner name, village, or khasra number above to search the entire database.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-10 max-w-xl mx-auto text-left">
              {[
                { icon: Hash, label: 'Survey Number', example: 'e.g. 412/2, 89/1A', field: 'survey_number' },
                { icon: User, label: 'Owner Name', example: 'e.g. Ramesh Kumar', field: 'owner_name' },
                { icon: MapPin, label: 'Village / District', example: 'e.g. Rampur, Pune', field: 'village' },
                { icon: FileText, label: 'Khasra Number', example: 'e.g. 45A, 122', field: 'khasra_number' },
              ].map(s => (
                <button
                  key={s.label}
                  onClick={() => { setField(s.field); inputRef.current?.focus(); }}
                  className="flex items-center gap-3 bg-white border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/40 rounded-xl p-4 transition-all text-left group"
                >
                  <div className="w-9 h-9 rounded-xl bg-slate-100 group-hover:bg-emerald-100 flex items-center justify-center flex-shrink-0 transition-colors">
                    <s.icon size={16} className="text-slate-500 group-hover:text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-slate-800 font-semibold text-sm">{s.label}</p>
                    <p className="text-slate-400 text-xs">{s.example}</p>
                  </div>
                  <ChevronRight size={14} className="text-slate-300 group-hover:text-emerald-400 ml-auto transition-colors" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
