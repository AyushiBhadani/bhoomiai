'use client';

/**
 * Government Systems Integration Dashboard
 * Shows BhoomiAI's live connections to DILRMP, state LRMS databases,
 * ISRO Bhuvan GIS, Survey of India cadastral maps, and CORS network.
 */
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Activity, CheckCircle, Clock, AlertTriangle,
  RefreshCw, Database, Map, Satellite, Globe2,
  ArrowRight, Download, Server, Shield, Zap, ExternalLink,
} from 'lucide-react';

interface SystemStatus {
  id: string;
  name: string;
  shortName: string;
  category: string;
  description: string;
  status: 'live' | 'syncing' | 'degraded' | 'offline';
  lastSync: string;
  recordCount?: string;
  apiEndpoint?: string;
  icon: string;
  color: string;
}

const SYSTEMS: SystemStatus[] = [
  {
    id: 'dilrmp',
    name: 'DILRMP Central Portal',
    shortName: 'DILRMP',
    category: 'Central Government',
    description: 'Digital India Land Records Modernization Programme — Central registry for all state land record systems.',
    status: 'live',
    lastSync: '2 min ago',
    recordCount: '24.1 Crore',
    apiEndpoint: 'https://dilrmp.gov.in/api/v1',
    icon: '🏛️',
    color: 'emerald',
  },
  {
    id: 'up_bhulekh',
    name: 'UP Bhulekh (Uttar Pradesh)',
    shortName: 'UP Bhulekh',
    category: 'State LRMS',
    description: 'Uttar Pradesh land record system. Khataunis, Khasra maps, and Jamabandi records.',
    status: 'live',
    lastSync: '5 min ago',
    recordCount: '4.2 Crore',
    apiEndpoint: 'https://upbhulekh.gov.in/public/api',
    icon: '🗺️',
    color: 'blue',
  },
  {
    id: 'maha_bhulekh',
    name: 'MahaBhulekh (Maharashtra)',
    shortName: 'MahaBhulekh',
    category: 'State LRMS',
    description: 'Maharashtra land records — 7/12 Utara, 8A, and property card for urban areas.',
    status: 'live',
    lastSync: '8 min ago',
    recordCount: '2.8 Crore',
    apiEndpoint: 'https://mahabhulekh.maharashtra.gov.in/api',
    icon: '🗺️',
    color: 'blue',
  },
  {
    id: 'meebhoomi',
    name: 'Meebhoomi (Andhra Pradesh)',
    shortName: 'Meebhoomi',
    category: 'State LRMS',
    description: 'AP land records — Adangal (pahani), 1B, and mutation status.',
    status: 'syncing',
    lastSync: '23 min ago',
    recordCount: '1.6 Crore',
    apiEndpoint: 'https://meebhoomi.ap.gov.in/api',
    icon: '🔄',
    color: 'amber',
  },
  {
    id: 'karnataka_bhoomi',
    name: 'Bhoomi (Karnataka)',
    shortName: 'Bhoomi KA',
    category: 'State LRMS',
    description: 'Karnataka online RTC (Record of Tenancy and Crops), pahani, and mutation tracking.',
    status: 'live',
    lastSync: '11 min ago',
    recordCount: '1.9 Crore',
    apiEndpoint: 'https://landrecords.karnataka.gov.in/api',
    icon: '🗺️',
    color: 'blue',
  },
  {
    id: 'bhuvan_isro',
    name: 'Bhuvan GIS (ISRO)',
    shortName: 'ISRO Bhuvan',
    category: 'GIS Platform',
    description: 'Indian Space Research Organisation\'s national GIS portal. Provides satellite imagery, cadastral boundaries, and LULC data.',
    status: 'live',
    lastSync: 'Real-time',
    apiEndpoint: 'https://bhuvan-vec1.nrsc.gov.in/bhuvan/wms',
    icon: '🛰️',
    color: 'purple',
  },
  {
    id: 'survey_india',
    name: 'Survey of India (SoI)',
    shortName: 'Survey of India',
    category: 'GIS Platform',
    description: 'Official cadastral maps, topographic sheets, and benchmark data from India\'s national mapping agency.',
    status: 'live',
    lastSync: 'Weekly sync',
    apiEndpoint: 'https://onlinemaps.surveyofindia.gov.in/wms',
    icon: '🗺️',
    color: 'purple',
  },
  {
    id: 'cors_network',
    name: 'CORS Network (Survey of India)',
    shortName: 'CORS GPS',
    category: 'Cadastral',
    description: 'Continuously Operating Reference Stations — centimetre-accurate GPS for demarcating exact land boundaries.',
    status: 'live',
    lastSync: 'Real-time',
    icon: '📡',
    color: 'teal',
  },
  {
    id: 'doris',
    name: 'DORIS (Digital Orphan Records)',
    shortName: 'DORIS',
    category: 'Central Government',
    description: 'MoRD system for tracking disputed, orphan, and encroached land records requiring special verification.',
    status: 'degraded',
    lastSync: '2 hours ago',
    icon: '⚠️',
    color: 'red',
  },
  {
    id: 'stamps_registration',
    name: 'National E-Stamping (SHCIL)',
    shortName: 'e-Stamping',
    category: 'Registration',
    description: 'Stock Holding Corporation of India\'s national e-stamping portal for stamp duty verification on land deeds.',
    status: 'live',
    lastSync: '3 min ago',
    icon: '🔏',
    color: 'indigo',
  },
  {
    id: 'nrega_land',
    name: 'MGNREGS Land Mapping',
    shortName: 'MGNREGS',
    category: 'Welfare Link',
    description: 'MGNREGA geo-tagged asset database — cross-references land development activities against registered parcels.',
    status: 'live',
    lastSync: '1 hour ago',
    icon: '👷',
    color: 'green',
  },
  {
    id: 'aadhaar_kyc',
    name: 'Aadhaar eKYC (UIDAI)',
    shortName: 'UIDAI eKYC',
    category: 'Identity',
    description: 'Aadhaar-based identity verification for citizen registration and ownership claim validation.',
    status: 'live',
    lastSync: 'Real-time',
    icon: '🆔',
    color: 'orange',
  },
];

const STATUS_CONFIG = {
  live:     { label: 'Live',     dot: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
  syncing:  { label: 'Syncing', dot: 'bg-amber-400 animate-pulse', text: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
  degraded: { label: 'Degraded',dot: 'bg-red-400',     text: 'text-red-700',     bg: 'bg-red-50 border-red-200' },
  offline:  { label: 'Offline', dot: 'bg-slate-400',   text: 'text-slate-700',   bg: 'bg-slate-50 border-slate-200' },
};

const CATEGORIES = ['All', 'Central Government', 'State LRMS', 'GIS Platform', 'Cadastral', 'Registration', 'Welfare Link', 'Identity'];

// Simulated recent sync events
const SYNC_EVENTS = [
  { time: '23:14:02', system: 'UP Bhulekh', event: '42 new mutations synced from Agra district', type: 'success' },
  { time: '23:11:45', system: 'ISRO Bhuvan', event: 'Cadastral layer updated — Uttar Pradesh zone', type: 'success' },
  { time: '23:08:33', system: 'DILRMP', event: 'Cross-state ownership check completed for 156 records', type: 'success' },
  { time: '23:05:11', system: 'Meebhoomi AP', event: 'Sync delayed — API rate limit, retry in 5 min', type: 'warning' },
  { time: '23:01:59', system: 'UIDAI eKYC', event: 'eKYC verification completed for 8 citizen registrations', type: 'success' },
  { time: '22:58:20', system: 'MahaBhulekh', event: '7/12 records pulled for Pune district — 204 updates', type: 'success' },
  { time: '22:55:07', system: 'DORIS', event: 'Service degraded — maintenance window active', type: 'error' },
];

export default function IntegrationsPage() {
  const [filter, setFilter] = useState('All');
  const [syncing, setSyncing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const liveCount    = SYSTEMS.filter(s => s.status === 'live').length;
  const syncingCount = SYSTEMS.filter(s => s.status === 'syncing').length;
  const degraded     = SYSTEMS.filter(s => s.status === 'degraded' || s.status === 'offline').length;

  const filtered = filter === 'All' ? SYSTEMS : SYSTEMS.filter(s => s.category === filter);

  const triggerSync = () => {
    setSyncing(true);
    setTimeout(() => { setSyncing(false); setLastRefresh(new Date()); }, 2500);
  };

  // Auto-refresh indicator
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick(x => x + 1), 30000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-5">
        <div className="max-w-6xl mx-auto flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Globe2 size={20} className="text-emerald-500" />
              <h1 className="text-xl font-bold text-slate-900">Government System Integrations</h1>
              <span className="text-xs bg-emerald-100 text-emerald-700 font-semibold px-2 py-0.5 rounded-full">Live</span>
            </div>
            <p className="text-slate-500 text-sm">
              BhoomiAI connects to {SYSTEMS.length} government databases — DILRMP, State LRMS, ISRO Bhuvan GIS, Survey of India, and more.
            </p>
          </div>
          <button onClick={triggerSync}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors">
            <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'Syncing…' : 'Sync All Systems'}
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6 space-y-6">

        {/* Status overview */}
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-4">
          {[
            { label: 'Total Systems', value: SYSTEMS.length, icon: <Database size={18} />, color: 'text-slate-700 bg-slate-100' },
            { label: 'Live',          value: liveCount,       icon: <CheckCircle size={18} />, color: 'text-emerald-700 bg-emerald-100' },
            { label: 'Syncing',       value: syncingCount,    icon: <RefreshCw size={18} />,  color: 'text-amber-700 bg-amber-100' },
            { label: 'Needs Attention', value: degraded,      icon: <AlertTriangle size={18} />, color: 'text-red-700 bg-red-100' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${s.color}`}>{s.icon}</div>
              <div>
                <p className="text-2xl font-black text-slate-800">{s.value}</p>
                <p className="text-xs text-slate-500">{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Architecture diagram callout */}
        <div className="bg-slate-900 rounded-2xl p-5 text-white overflow-hidden relative">
          <div className="absolute right-0 top-0 bottom-0 w-48 opacity-5 flex items-center justify-center text-9xl pointer-events-none">
            🌐
          </div>
          <p className="text-xs text-emerald-400 font-semibold uppercase tracking-widest mb-3">Integration Architecture</p>
          <div className="flex items-center gap-0 flex-wrap">
            {[
              { name: 'State LRMS', sub: 'UP/MH/AP/KA', icon: '🗄️' },
              { arrow: true },
              { name: 'BhoomiAI API', sub: 'FastAPI + AI Layer', icon: '⚡', highlight: true },
              { arrow: true },
              { name: 'DILRMP Central', sub: 'National Registry', icon: '🏛️' },
            ].map((item, i) => (
              item.arrow
                ? <ArrowRight key={i} size={20} className="text-emerald-400 mx-2 flex-shrink-0" />
                : <div key={i} className={`rounded-xl px-4 py-2.5 text-center ${
                    item.highlight ? 'bg-emerald-600 border-2 border-emerald-400' : 'bg-white/10 border border-white/20'
                  }`}>
                    <p className="text-lg">{item.icon}</p>
                    <p className="text-xs font-bold leading-tight">{item.name}</p>
                    <p className="text-[10px] opacity-60">{item.sub}</p>
                  </div>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { icon: <Satellite size={13} />, label: 'ISRO Bhuvan WMS', sub: 'Satellite + Cadastral' },
              { icon: <Map size={13} />,       label: 'Survey of India', sub: 'Topographic + CORS GPS' },
              { icon: <Shield size={13} />,    label: 'UIDAI eKYC',      sub: 'Aadhaar Verification' },
              { icon: <Server size={13} />,    label: 'e-Stamping SHCIL',sub: 'Stamp Duty Registry' },
            ].map(b => (
              <div key={b.label} className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 flex items-start gap-2">
                <span className="text-emerald-400 mt-0.5">{b.icon}</span>
                <div>
                  <p className="text-xs font-semibold leading-tight">{b.label}</p>
                  <p className="text-[10px] text-white/50">{b.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Systems list */}
          <div className="lg:col-span-2 space-y-4">
            {/* Category filter */}
            <div className="flex gap-2 flex-wrap">
              {CATEGORIES.map(cat => (
                <button key={cat} onClick={() => setFilter(cat)}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-colors ${
                    filter === cat ? 'bg-emerald-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}>
                  {cat}
                </button>
              ))}
            </div>

            {/* System cards */}
            <div className="space-y-3">
              {filtered.map(sys => {
                const sc = STATUS_CONFIG[sys.status];
                return (
                  <div key={sys.id} className="bg-white rounded-2xl border border-slate-200 p-4 hover:border-slate-300 transition-colors">
                    <div className="flex items-start gap-3">
                      <div className="text-2xl flex-shrink-0 mt-0.5">{sys.icon}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-slate-800 text-sm">{sys.name}</p>
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border flex items-center gap-1 ${sc.bg} ${sc.text}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                              {sc.label}
                            </span>
                          </div>
                          <span className="text-xs text-slate-400 flex items-center gap-1">
                            <Clock size={10} /> {sys.lastSync}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mb-2">{sys.description}</p>
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{sys.category}</span>
                          {sys.recordCount && (
                            <span className="text-xs text-emerald-700 font-semibold">{sys.recordCount} records</span>
                          )}
                          {sys.apiEndpoint && (
                            <a href="#" onClick={e => e.preventDefault()}
                              className="text-xs text-blue-600 flex items-center gap-0.5 hover:underline font-mono">
                              {sys.apiEndpoint.replace('https://', '')} <ExternalLink size={9} />
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Real-time sync log */}
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity size={14} className="text-emerald-500" />
                  <p className="text-sm font-bold text-slate-800">Live Sync Log</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                  <span className="text-xs text-slateald-500 text-slate-500">Live</span>
                </div>
              </div>
              <div className="divide-y divide-slate-50">
                {SYNC_EVENTS.map((ev, i) => (
                  <div key={i} className="px-4 py-3">
                    <div className="flex items-start gap-2">
                      <span className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${
                        ev.type === 'success' ? 'bg-emerald-400' :
                        ev.type === 'warning' ? 'bg-amber-400' : 'bg-red-400'
                      }`} />
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold text-slate-500 mb-0.5">{ev.time} · {ev.system}</p>
                        <p className="text-xs text-slate-700 leading-relaxed">{ev.event}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Data flow stats */}
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
              <p className="text-sm font-bold text-emerald-800 mb-3 flex items-center gap-2">
                <Zap size={14} /> Today&apos;s Sync Stats
              </p>
              {[
                { label: 'Records synced', value: '1,24,847' },
                { label: 'Mutations processed', value: '3,241' },
                { label: 'Fraud flags raised', value: '17' },
                { label: 'Citizen verifications', value: '892' },
                { label: 'GIS tile updates', value: '24,100' },
              ].map(s => (
                <div key={s.label} className="flex items-center justify-between py-1.5 border-b border-emerald-100 last:border-0">
                  <p className="text-xs text-emerald-700">{s.label}</p>
                  <p className="text-xs font-bold text-emerald-900">{s.value}</p>
                </div>
              ))}
            </div>

            {/* API key notice */}
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
              <p className="text-xs font-bold text-blue-800 mb-2 flex items-center gap-1.5">
                <Shield size={12} /> For Production Deployment
              </p>
              <p className="text-xs text-blue-700 leading-relaxed">
                Real DILRMP integration requires a government-issued API key via NIC (National Informatics Centre). ISRO Bhuvan WMS is publicly accessible. State LRMS APIs are available through state IT departments under the PMGSY framework.
              </p>
              <Link href="/map" className="inline-flex items-center gap-1 mt-2 text-xs text-blue-700 font-semibold hover:underline">
                View GIS Map with Bhuvan Layer <ArrowRight size={10} />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
