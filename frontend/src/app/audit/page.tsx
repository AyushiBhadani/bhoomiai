'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Upload, Edit3, CheckCircle, XCircle, Clock,
  Filter, ScrollText, Loader2, AlertCircle, ArrowRight, User,
} from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import type { AuditLogEntry } from '@/lib/types';

function relativeTime(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
  return `${Math.floor(hours / 24)} days ago`;
}

interface ActionConfig { icon: React.ElementType; bgColor: string; iconColor: string; label: string; }
const ACTION_CONFIG: Record<string, ActionConfig> = {
  upload:          { icon: Upload,      bgColor: 'bg-blue-100',  iconColor: 'text-blue-600',  label: 'Document Uploaded' },
  field_corrected: { icon: Edit3,       bgColor: 'bg-amber-100', iconColor: 'text-amber-600', label: 'Field Corrected' },
  approved:        { icon: CheckCircle, bgColor: 'bg-green-100', iconColor: 'text-green-600', label: 'Record Approved' },
  rejected:        { icon: XCircle,     bgColor: 'bg-red-100',   iconColor: 'text-red-600',   label: 'Record Rejected' },
  default:         { icon: ScrollText,  bgColor: 'bg-gray-100',  iconColor: 'text-gray-600',  label: 'Action' },
};
const getActionConfig = (a: string): ActionConfig => ACTION_CONFIG[a] ?? ACTION_CONFIG.default;
const ALL_ACTIONS = ['All Actions', ...Object.keys(ACTION_CONFIG).filter((k) => k !== 'default')];

function TimelineEvent({ entry }: { entry: AuditLogEntry }) {
  const cfg = getActionConfig(entry.action);
  const Icon = cfg.icon;
  return (
    <div className="relative flex gap-4 pb-8 last:pb-0">
      <div className="absolute left-5 top-10 bottom-0 w-0.5 bg-gray-200" />
      <div className={`relative z-10 flex-shrink-0 w-10 h-10 rounded-full ${cfg.bgColor} flex items-center justify-center`}>
        <Icon size={16} className={cfg.iconColor} />
      </div>
      <div className="flex-1 bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
        <div className="flex items-start justify-between mb-1">
          <h3 className="text-sm font-semibold text-gray-900">{cfg.label}</h3>
          <span className="flex items-center gap-1 text-xs text-gray-400"><Clock size={11} />{relativeTime(entry.timestamp)}</span>
        </div>
        <div className="text-xs text-gray-500 flex flex-wrap gap-3 mb-2">
          {entry.user_id != null && <span className="flex items-center gap-1"><User size={11} />User #{entry.user_id}</span>}
          <span>Record #{entry.record_id}</span>
          {entry.field_name && <span className="text-amber-600 font-medium">Field: {entry.field_name}</span>}
        </div>
        {(entry.old_value || entry.new_value) && (
          <div className="flex items-center gap-2 mt-2 text-xs">
            {entry.old_value != null && <span className="bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 rounded font-mono">{entry.old_value}</span>}
            {entry.old_value != null && entry.new_value != null && <ArrowRight size={12} className="text-gray-400" />}
            {entry.new_value != null && <span className="bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded font-mono">{entry.new_value}</span>}
          </div>
        )}
        {entry.comment && <p className="mt-2 text-xs text-gray-600 italic">&ldquo;{entry.comment}&rdquo;</p>}
        <div className="mt-3 flex justify-end">
          <Link href={`/verify/${entry.record_id}`} className="text-xs text-green-700 hover:underline flex items-center gap-1">
            View Record <ArrowRight size={10} />
          </Link>
        </div>
      </div>
    </div>
  );
}

function AuditPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoading: authLoading } = useAuth();
  const docId = searchParams.get('doc_id');
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionFilter, setActionFilter] = useState('All Actions');

  const fetchAudit = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      if (docId) {
        const docRes = await api.get(`/documents/${docId}`);
        const firstId = docRes.data.records?.[0]?.id;
        if (firstId) {
          const r = await api.get(`/audit/${firstId}`);
          setEntries(Array.isArray(r.data) ? r.data : []);
        } else { setEntries([]); }
      } else {
        const r = await api.get('/dashboard/stats');
        setEntries(r.data?.recent_activity ?? []);
      }
    } catch { setError('Could not load audit trail. Is the backend running?'); }
    finally { setLoading(false); }
  }, [docId]);

  useEffect(() => {
    if (!authLoading && !user) { router.push('/login'); return; }
    if (!authLoading) fetchAudit();
  }, [authLoading, user, router, fetchAudit]);

  const filtered = actionFilter === 'All Actions' ? entries : entries.filter((e) => e.action === actionFilter);

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ScrollText size={22} className="text-green-700" />
            <div>
              <h1 className="text-xl font-bold text-gray-900">{docId ? `Audit Trail - Document #${docId}` : 'System Audit Trail'}</h1>
              <p className="text-xs text-gray-500 mt-0.5">{docId ? 'All actions on this document' : 'Recent activity across all records'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-gray-400" />
            <select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)}
              className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-green-500 focus:outline-none">
              {ALL_ACTIONS.map((a) => <option key={a} value={a}>{a === 'All Actions' ? a : getActionConfig(a).label}</option>)}
            </select>
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-6 max-w-3xl w-full mx-auto">
        {loading ? (
          <div className="flex items-center justify-center py-32 gap-3 text-gray-500">
            <Loader2 size={22} className="animate-spin text-green-600" /><span className="text-sm">Loading...</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center py-24 text-center">
            <AlertCircle size={40} className="text-red-400 mb-3" /><p className="text-sm text-gray-600">{error}</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-24 text-center">
            <ScrollText size={48} className="text-gray-300 mb-4" />
            <p className="text-gray-500 text-sm font-medium">No audit events found</p>
            <p className="text-xs text-gray-400 mt-1">Upload documents and take actions to see events here.</p>
          </div>
        ) : (
          <div className="relative">
            <p className="text-xs text-gray-500 mb-6">Showing <strong>{filtered.length}</strong> event{filtered.length !== 1 ? 's' : ''}</p>
            {filtered.map((entry) => <TimelineEvent key={entry.id} entry={entry} />)}
          </div>
        )}
      </div>
    </div>
  );
}

export default function AuditPage() {
  return (
    <React.Suspense fallback={<div className="p-8 flex justify-center items-center text-slate-500 gap-2"><Loader2 className="animate-spin" size={20} /> Loading...</div>}>
      <AuditPageContent />
    </React.Suspense>
  );
}
