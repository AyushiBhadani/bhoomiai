'use client';

/**
 * Dashboard page — premium design with stat grid, pipeline, activity feed,
 * and documents table.
 *
 * Fetches:
 *  - GET /api/dashboard/stats  → stat cards & pipeline counts
 *  - GET /api/documents         → documents table
 *  - GET /api/audit             → recent activity feed (optional)
 *
 * All sections gracefully degrade when the backend is unreachable.
 */
import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  FileText,
  CheckCircle,
  Clock,
  XCircle,
  Plus,
  Eye,
  RefreshCw,
  Database,
  AlertTriangle,
  Zap,
  Loader2,
  Upload,
  ArrowRight,
  Activity,
  TrendingUp,
  Search,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

import api from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import type { Document, DashboardStats } from '@/lib/types';
import StatusBadge from '@/components/StatusBadge';
import LoadingSpinner from '@/components/LoadingSpinner';

// ── Types ─────────────────────────────────────────────────────────────────────

type ExtendedStats = DashboardStats;

interface AuditEntry {
  action: string;
  document_id: number;
  timestamp: string;
  user_email: string;
}

// ── Stat card ─────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  streak?: string;
  suffix?: string;
}

function StatCard({ label, value, icon, iconBg, iconColor, streak, suffix }: StatCardProps) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 flex items-center gap-4 card-hover relative overflow-hidden">
      {/* Subtle streak */}
      {streak && (
        <div
          className={`absolute top-0 right-0 w-20 h-full opacity-40 ${streak}`}
          style={{
            background: `linear-gradient(135deg, transparent 60%, ${streak})`,
          }}
        />
      )}
      <div
        className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${iconBg}`}
      >
        <span className={iconColor}>{icon}</span>
      </div>
      <div className="min-w-0 relative z-10">
        <p className="text-2xl font-bold text-slate-900 leading-none">
          {value}
          {suffix && (
            <span className="text-sm font-semibold text-slate-500 ml-1">
              {suffix}
            </span>
          )}
        </p>
        <p className="text-xs text-slate-500 mt-1 leading-tight">{label}</p>
      </div>
    </div>
  );
}

// ── Pipeline stage ─────────────────────────────────────────────────────────────

interface PipelineStageProps {
  label: string;
  count: number;
  active?: boolean;
  last?: boolean;
}

function PipelineStage({ label, count, active, last }: PipelineStageProps) {
  return (
    <div className="flex items-center gap-0">
      <div className="flex flex-col items-center">
        <div
          className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all ${
            active
              ? 'bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-500/30'
              : count > 0
              ? 'bg-white border-emerald-300 text-emerald-700'
              : 'bg-slate-50 border-slate-200 text-slate-400'
          }`}
        >
          {count}
        </div>
        <p className="text-xs text-slate-500 mt-1 text-center w-20 leading-tight">
          {label}
        </p>
      </div>
      {!last && (
        <div className="w-8 h-0.5 bg-slate-200 mb-5 flex-shrink-0" />
      )}
    </div>
  );
}

// ── Bar colours ───────────────────────────────────────────────────────────────

const BAR_COLOURS: Record<string, string> = {
  Verified:            '#10b981',
  'Needs Verification': '#f59e0b',
  Processing:          '#3b82f6',
  Failed:              '#ef4444',
  Uploaded:            '#64748b',
  Pending:             '#f59e0b',
};

// ── Action colours for audit feed ─────────────────────────────────────────────

function auditIcon(action: string) {
  const a = action.toLowerCase();
  if (a.includes('upload'))   return { icon: <Upload size={12} />, cls: 'bg-blue-100 text-blue-600' };
  if (a.includes('approve') || a.includes('verify')) return { icon: <CheckCircle size={12} />, cls: 'bg-emerald-100 text-emerald-600' };
  if (a.includes('reject'))   return { icon: <XCircle size={12} />, cls: 'bg-red-100 text-red-600' };
  if (a.includes('correct'))  return { icon: <AlertTriangle size={12} />, cls: 'bg-amber-100 text-amber-600' };
  return { icon: <Activity size={12} />, cls: 'bg-slate-100 text-slate-500' };
}

function timeAgo(ts: string): string {
  try {
    const diff = Date.now() - new Date(ts).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  } catch {
    return '';
  }
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [stats, setStats] = useState<ExtendedStats | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [activity, setActivity] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsRes, docsRes] = await Promise.allSettled([
        api.get('/dashboard/stats'),
        api.get('/documents'),
      ]);

      if (statsRes.status === 'fulfilled') {
        setStats(statsRes.value.data);
        // Extract activity from stats if embedded
        if (statsRes.value.data?.recent_activity) {
          setActivity(statsRes.value.data.recent_activity.slice(0, 8));
        }
      } else {
        setStats({ total_documents: 0, verified_documents: 0, pending_verification: 0, failed_documents: 0, processing_documents: 0, total_records: 0, records_with_errors: 0, avg_confidence: 0, recent_activity: [] });
      }

      if (docsRes.status === 'fulfilled') {
        const d = docsRes.value.data;
        setDocuments(Array.isArray(d) ? d : d?.documents ?? []);
      }

      if (statsRes.status === 'rejected' && docsRes.status === 'rejected') {
        setError('Could not reach the server. Showing demo state.');
      }
    } catch {
      setError('Could not reach the server. Showing demo state.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && !user) { router.push('/login'); return; }
    if (!authLoading) fetchData();
  }, [authLoading, user, router, fetchData]);

  // Chart data from documents
  const chartData = React.useMemo(() => {
    const counts: Record<string, number> = {};
    documents.forEach((d) => {
      const label =
        d.status === 'needs_verification'
          ? 'Needs Verification'
          : d.status.charAt(0).toUpperCase() + d.status.slice(1);
      counts[label] = (counts[label] ?? 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [documents]);

  // Filtered documents by search
  const filteredDocs = documents.filter((d) =>
    !search || d.filename.toLowerCase().includes(search.toLowerCase())
  );

  if (authLoading || loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" label="Loading dashboard…" />
      </div>
    );
  }

  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ── Gradient header ─────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-white">
                Land Record Dashboard
              </h1>
              <p className="text-emerald-100 text-sm mt-1">{today}</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={fetchData}
                className="flex items-center gap-2 text-sm text-emerald-100 hover:text-white border border-emerald-400/40 hover:border-emerald-300 px-3 py-2 rounded-lg transition-all"
              >
                <RefreshCw size={14} />
                Refresh
              </button>
              <Link
                href="/upload"
                className="flex items-center gap-2 bg-white text-emerald-700 hover:bg-emerald-50 text-sm font-semibold px-4 py-2 rounded-lg transition-all shadow-lg"
              >
                <Plus size={15} />
                Upload Document
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* Error banner */}
        {error && (
          <div className="bg-amber-50 border border-amber-200 text-amber-700 rounded-xl px-4 py-3 text-sm flex gap-2 items-center">
            <AlertTriangle size={15} className="flex-shrink-0" />
            {error}
          </div>
        )}

        {/* ── 8 Stat cards (4×2) ────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard
            label="Total Documents"
            value={stats?.total_documents ?? 0}
            icon={<FileText size={20} />}
            iconBg="bg-blue-50"
            iconColor="text-blue-600"
          />
          <StatCard
            label="Verified Records"
            value={stats?.verified_documents ?? 0}
            icon={<CheckCircle size={20} />}
            iconBg="bg-emerald-50"
            iconColor="text-emerald-600"
          />
          <StatCard
            label="Pending Verification"
            value={stats?.pending_verification ?? 0}
            icon={<Clock size={20} />}
            iconBg="bg-amber-50"
            iconColor="text-amber-600"
          />
          <StatCard
            label="Failed / Rejected"
            value={stats?.failed_documents ?? 0}
            icon={<XCircle size={20} />}
            iconBg="bg-red-50"
            iconColor="text-red-500"
          />
          <StatCard
            label="Total Records"
            value={stats?.total_records ?? documents.reduce((s, d) => s + (d.records?.length ?? 0), 0)}
            icon={<Database size={20} />}
            iconBg="bg-purple-50"
            iconColor="text-purple-600"
          />
          <StatCard
            label="Records with Errors"
            value={stats?.records_with_errors ?? 0}
            icon={<AlertTriangle size={20} />}
            iconBg="bg-orange-50"
            iconColor="text-orange-600"
          />
          <StatCard
            label="Avg AI Confidence"
            value={stats?.avg_confidence ? `${Math.round(stats.avg_confidence)}` : '—'}
            suffix="%"
            icon={<TrendingUp size={20} />}
            iconBg="bg-teal-50"
            iconColor="text-teal-600"
          />
          <StatCard
            label="Processing"
            value={stats?.processing_documents ?? documents.filter((d) => d.status === 'processing').length}
            icon={<Loader2 size={20} />}
            iconBg="bg-slate-100"
            iconColor="text-slate-600"
          />
        </div>

        {/* ── Pipeline status bar ────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-5">
            <Zap size={16} className="text-emerald-500" />
            <h2 className="text-sm font-semibold text-slate-800">
              Processing Pipeline
            </h2>
          </div>
          <div className="flex items-start gap-0 overflow-x-auto pb-2">
            <PipelineStage label="Uploaded"    count={documents.filter((d) => d.status === 'uploaded').length} />
            <PipelineStage label="Processing"  count={documents.filter((d) => d.status === 'processing').length} active />
            <PipelineStage label="OCR"         count={0} />
            <PipelineStage label="Extraction"  count={0} />
            <PipelineStage label="Validation"  count={documents.filter((d) => d.status === 'needs_verification').length} />
            <PipelineStage label="Verification" count={stats?.pending_verification ?? 0} />
            <PipelineStage label="Verified"    count={stats?.verified_documents ?? 0} last />
          </div>
        </div>

        {/* ── Main content: Table + Activity feed ───────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Documents table (2/3 width) */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            {/* Table header */}
            <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
              <FileText size={16} className="text-slate-400" />
              <h2 className="text-sm font-semibold text-slate-800 flex-1">
                Documents
              </h2>
              <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                {documents.length}
              </span>
            </div>

            {/* Search */}
            <div className="px-5 py-3 border-b border-slate-50">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search filename…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-slate-50"
                />
              </div>
            </div>

            {filteredDocs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                <FileText size={40} className="mb-3 text-slate-200" />
                <p className="text-sm">
                  {search ? 'No documents match your search.' : 'No documents uploaded yet.'}
                </p>
                {!search && (
                  <Link
                    href="/upload"
                    className="mt-4 text-sm text-emerald-600 hover:text-emerald-700 hover:underline flex items-center gap-1"
                  >
                    Upload your first document
                    <ArrowRight size={13} />
                  </Link>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-100">
                    <tr>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        Filename
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        Uploaded
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        Records
                      </th>
                      <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filteredDocs.slice(0, 12).map((doc) => (
                      <tr
                        key={doc.id}
                        className="hover:bg-slate-50/80 transition-colors group"
                      >
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            <FileText size={14} className="text-slate-300 flex-shrink-0" />
                            <span className="font-medium text-slate-900 max-w-[180px] truncate">
                              {doc.filename}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <StatusBadge status={doc.status} />
                        </td>
                        <td className="px-4 py-3.5 text-slate-500 text-xs">
                          {doc.upload_date
                            ? new Date(doc.upload_date).toLocaleDateString('en-IN', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                              })
                            : '—'}
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-full">
                            {doc.records?.length ?? 0}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Link
                              href={`/verify/${doc.id}`}
                              className="inline-flex items-center gap-1 text-emerald-700 hover:text-white hover:bg-emerald-600 font-medium text-xs bg-emerald-50 px-2.5 py-1.5 rounded-lg transition-colors"
                            >
                              <Eye size={12} />
                              Review
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Right column: chart + activity feed */}
          <div className="space-y-5">
            {/* Bar chart */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <h2 className="text-sm font-semibold text-slate-800 mb-4">
                Status Distribution
              </h2>
              {chartData.length === 0 ? (
                <div className="h-40 flex items-center justify-center text-sm text-slate-400">
                  No data yet
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart
                    data={chartData}
                    margin={{ top: 4, right: 4, left: -24, bottom: 4 }}
                  >
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
                      cursor={{ fill: '#f0fdf4' }}
                    />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      {chartData.map((entry) => (
                        <Cell
                          key={entry.name}
                          fill={BAR_COLOURS[entry.name] ?? '#94a3b8'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Recent Activity */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-4">
                <Activity size={15} className="text-slate-400" />
                <h2 className="text-sm font-semibold text-slate-800">
                  Recent Activity
                </h2>
              </div>
              {activity.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6">
                  No recent activity
                </p>
              ) : (
                <div className="space-y-3">
                  {activity.map((entry, i) => {
                    const { icon, cls } = auditIcon(entry.action);
                    return (
                      <div key={i} className="flex items-start gap-3">
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${cls}`}
                        >
                          {icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-slate-700 font-medium leading-tight truncate">
                            {entry.action}
                          </p>
                          <p className="text-xs text-slate-400 mt-0.5">
                            Doc #{entry.document_id} · {timeAgo(entry.timestamp)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
