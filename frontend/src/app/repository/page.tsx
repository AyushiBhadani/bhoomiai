'use client';

/**
 * Land Record Repository — paginated table with search/filter and export.
 *
 * GET /api/repository?skip=0&limit=20&search=...&status=...&district=...
 * GET /api/export/csv  → triggers CSV download
 * GET /api/export/json → triggers JSON download
 */
import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Search,
  Filter,
  Download,
  ChevronLeft,
  ChevronRight,
  Eye,
  Database,
  FileDown,
  Loader2,
  AlertCircle,
} from 'lucide-react';

import api from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import type { RepositoryRecord } from '@/lib/types';
import StatusBadge from '@/components/StatusBadge';
import ConfidenceBadge from '@/components/ConfidenceBadge';

const PAGE_SIZE = 20;

const DISTRICTS = [
  'All Districts',
  'Pune',
  'Mumbai',
  'Nashik',
  'Nagpur',
  'Aurangabad',
  'Solapur',
  'Kolhapur',
];

const STATUSES = [
  { value: '', label: 'All Statuses' },
  { value: 'verified', label: 'Verified' },
  { value: 'pending', label: 'Pending' },
  { value: 'error', label: 'Error' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];

export default function RepositoryPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();

  // ── Filter state ─────────────────────────────────────────────────────────
  const [search, setSearch]     = useState('');
  const [status, setStatus]     = useState('');
  const [district, setDistrict] = useState('');
  const [page, setPage]         = useState(0);

  // ── Data state ───────────────────────────────────────────────────────────
  const [records, setRecords] = useState<RepositoryRecord[]>([]);
  const [total, setTotal]     = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [exporting, setExporting] = useState<'csv' | 'json' | null>(null);

  // ── Fetch records ─────────────────────────────────────────────────────────
  const fetchRecords = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string | number> = {
        skip: page * PAGE_SIZE,
        limit: PAGE_SIZE,
      };
      if (search)   params.search   = search;
      if (status)   params.status   = status;
      if (district && district !== 'All Districts') params.district = district;

      const res = await api.get('/repository', { params });
      // Backend may return { records, total } or a plain array
      if (Array.isArray(res.data)) {
        setRecords(res.data);
        setTotal(res.data.length);
      } else {
        setRecords(res.data.records ?? []);
        setTotal(res.data.total ?? res.data.records?.length ?? 0);
      }
    } catch {
      setError('Could not load repository. Is the backend running?');
    } finally {
      setLoading(false);
    }
  }, [page, search, status, district]);

  useEffect(() => {
    if (!authLoading && !user) { router.push('/login'); return; }
    if (!authLoading) fetchRecords();
  }, [authLoading, user, router, fetchRecords]);

  // Reset to page 0 when filters change
  useEffect(() => { setPage(0); }, [search, status, district]);

  // ── Export helpers ────────────────────────────────────────────────────────
  const handleExport = async (format: 'csv' | 'json') => {
    setExporting(format);
    try {
      const res = await api.get(`/export/${format}`, { responseType: 'blob' });
      const mime = format === 'csv' ? 'text/csv' : 'application/json';
      const blob = new Blob([res.data], { type: mime });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `land_records.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert(`Export failed. Ensure the backend /api/export/${format} endpoint exists.`);
    } finally {
      setExporting(null);
    }
  };

  // ── Avg confidence helper ─────────────────────────────────────────────────
  const avgConfidence = (rec: RepositoryRecord): number | null => {
    if (!rec.confidence_scores) return null;
    const confMap: Record<string, number> = { high: 100, medium: 60, low: 20 };
    const vals = Object.values(rec.confidence_scores).map((v) =>
      typeof v === 'number' ? v : (confMap[String(v)] ?? 50)
    );
    if (!vals.length) return null;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  };

  // ── Pagination math ───────────────────────────────────────────────────────
  const start  = page * PAGE_SIZE + 1;
  const end    = Math.min((page + 1) * PAGE_SIZE, total || records.length);
  const maxPage = Math.ceil((total || records.length) / PAGE_SIZE) - 1;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Database size={22} className="text-green-700" />
            <div>
              <h1 className="text-xl font-bold text-gray-900">Land Record Repository</h1>
              <p className="text-xs text-gray-500 mt-0.5">
                Browse, filter and export all digitized land records
              </p>
            </div>
          </div>

          {/* Export buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleExport('csv')}
              disabled={exporting !== null}
              className="flex items-center gap-1.5 text-sm border border-gray-300 hover:border-green-400 text-gray-700 hover:text-green-700 px-3 py-2 rounded-lg transition-colors disabled:opacity-50"
            >
              {exporting === 'csv' ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />}
              Export All (CSV)
            </button>
            <button
              onClick={() => handleExport('json')}
              disabled={exporting !== null}
              className="flex items-center gap-1.5 text-sm border border-gray-300 hover:border-green-400 text-gray-700 hover:text-green-700 px-3 py-2 rounded-lg transition-colors disabled:opacity-50"
            >
              {exporting === 'json' ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              Export All (JSON)
            </button>
          </div>
        </div>

        {/* Filter bar */}
        <div className="mt-4 flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search owner, survey no., village…"
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter size={14} className="text-gray-400" />
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
            >
              {STATUSES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          <select
            value={district}
            onChange={(e) => setDistrict(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
          >
            {DISTRICTS.map((d) => (
              <option key={d} value={d === 'All Districts' ? '' : d}>{d}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center py-32 gap-3 text-gray-500">
            <Loader2 size={22} className="animate-spin text-green-600" />
            <span className="text-sm">Loading records…</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <AlertCircle size={40} className="text-red-400 mb-3" />
            <p className="text-sm text-gray-600 mb-1">{error}</p>
            <button onClick={fetchRecords} className="text-xs text-green-700 hover:underline mt-2">
              Retry
            </button>
          </div>
        ) : records.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <Database size={48} className="text-gray-300 mb-4" />
            <p className="text-gray-500 text-sm font-medium">No records found</p>
            <p className="text-xs text-gray-400 mt-1">Try adjusting your filters or upload documents first.</p>
          </div>
        ) : (
          <>
            {/* Table */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {['Doc ID', 'Owner Name', 'Survey No.', 'Khasra No.', 'Village / District', 'Area', 'Status', 'AI Confidence', 'Actions'].map((col) => (
                      <th
                        key={col}
                        className="text-left text-xs font-semibold text-gray-600 uppercase tracking-wide px-4 py-3"
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {records.map((rec) => {
                    const conf = avgConfidence(rec);
                    const docId = rec.doc_id ?? rec.document_id;
                    return (
                      <tr
                        key={rec.id}
                        onClick={() => router.push(`/verify/${docId}`)}
                        className="hover:bg-green-50 cursor-pointer transition-colors"
                      >
                        <td className="px-4 py-3 font-mono text-xs text-gray-500">
                          #{docId}
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-900">
                          {rec.owner_name ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {rec.survey_number ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {rec.khasra_number ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          <span className="font-medium">{rec.village ?? '—'}</span>
                          {rec.district && <span className="text-gray-400"> / {rec.district}</span>}
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {rec.area != null ? `${rec.area.toLocaleString()} m²` : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={rec.validation_status} />
                        </td>
                        <td className="px-4 py-3">
                          {conf !== null ? (
                            <ConfidenceBadge score={conf} />
                          ) : (
                            <span className="text-gray-400 text-xs">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                            <Link
                              href={`/verify/${docId}`}
                              className="flex items-center gap-1 text-xs text-green-700 hover:text-green-600 border border-green-200 hover:border-green-400 px-2 py-1 rounded-md transition-colors"
                            >
                              <Eye size={11} />
                              View
                            </Link>
                            <button
                              onClick={() => handleExport('csv')}
                              className="flex items-center gap-1 text-xs text-gray-600 hover:text-gray-800 border border-gray-200 hover:border-gray-400 px-2 py-1 rounded-md transition-colors"
                            >
                              <Download size={11} />
                              Export
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
              <span>
                Showing <strong>{start}</strong>–<strong>{end}</strong> of{' '}
                <strong>{total || records.length}</strong> records
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-300 hover:border-green-400 hover:text-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft size={14} />
                  Previous
                </button>
                <span className="text-xs text-gray-400">Page {page + 1}</span>
                <button
                  onClick={() => setPage((p) => Math.min(maxPage, p + 1))}
                  disabled={page >= maxPage}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-300 hover:border-green-400 hover:text-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
