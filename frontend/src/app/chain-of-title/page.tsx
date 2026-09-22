'use client';

/**
 * Chain of Title — Public page showing complete ownership history of any land parcel.
 * Search by Survey Number to see the full, timestamped ownership chain.
 * This is the document banks and lawyers need before approving loans or purchases.
 */
import React, { useState } from 'react';
import Link from 'next/link';
import {
  Search, Shield, ArrowDown, CheckCircle,
  AlertTriangle, Clock, User, Hash, FileText,
  Download, ChevronRight, Landmark, Link2,
} from 'lucide-react';

interface TitleEvent {
  year: string;
  type: string;
  from: string;
  to: string;
  description: string;
  amount?: string;
  status: 'verified' | 'pending' | 'disputed';
  doc?: string;
}

interface LandParcel {
  survey_number: string;
  village: string;
  district: string;
  state: string;
  area: string;
  land_type: string;
  current_owner: string;
  circle_rate: string;
  chain: TitleEvent[];
}

const DEMO_DATA: Record<string, LandParcel> = {
  '124/7': {
    survey_number: '124/7',
    village: 'Rampur',
    district: 'Agra',
    state: 'Uttar Pradesh',
    area: '2.5 Hectares (25,000 sq.m)',
    land_type: '🌾 Agricultural',
    current_owner: 'Sunita Devi',
    circle_rate: '₹450/sq.m',
    chain: [
      {
        year: '1952',
        type: 'Original Settlement',
        from: 'Government of Uttar Pradesh',
        to: 'Ram Prasad',
        description: 'Land allotted under post-independence land reform (Zamindari Abolition Act). Original Patta granted.',
        status: 'verified',
        doc: 'Patta No. 77/UP/1952',
      },
      {
        year: '1978',
        type: 'Inheritance (Will)',
        from: 'Ram Prasad (Deceased)',
        to: 'Shiv Lal (Elder Son)',
        description: 'Transfer via probated will after death of Ram Prasad. Revenue mutation No. 342/1978 approved.',
        status: 'verified',
        doc: 'Mutation #342/1978',
      },
      {
        year: '2011',
        type: 'Inheritance (Legal Heir)',
        from: 'Shiv Lal (Deceased)',
        to: 'Ramesh Kumar (Son)',
        description: 'Legal heir mutation after Shiv Lal\'s death. Succession certificate obtained from Civil Court Agra.',
        status: 'verified',
        doc: 'Succession Cert. CC-447/2011',
      },
      {
        year: '2019',
        type: 'Mortgage / Encumbrance',
        from: 'Ramesh Kumar',
        to: 'State Bank of India',
        description: 'Land mortgaged as collateral for agricultural loan of ₹5,00,000 under KISAN scheme.',
        amount: '₹5,00,000',
        status: 'verified',
        doc: 'Loan A/c KCC-SBI-2019-4421',
      },
      {
        year: '2022',
        type: 'Mortgage Discharged',
        from: 'State Bank of India',
        to: 'Ramesh Kumar',
        description: 'Loan fully repaid. Encumbrance discharged. Clear title restored to Ramesh Kumar.',
        status: 'verified',
        doc: 'Discharge Cert. SBI/2022/KCC-4421',
      },
      {
        year: '2024',
        type: 'Sale Deed',
        from: 'Ramesh Kumar',
        to: 'Sunita Devi',
        description: 'Registered sale deed executed at Sub-Registrar Office Agra. Stamp duty paid.',
        amount: '₹11,25,000',
        status: 'verified',
        doc: 'Sale Deed #SR-AGR-2024-7741',
      },
    ],
  },
  '45A': {
    survey_number: '45A',
    village: 'Sitapur Colony',
    district: 'Lucknow',
    state: 'Uttar Pradesh',
    area: '0.08 Hectares (800 sq.m)',
    land_type: '🏘️ Residential Plot',
    current_owner: 'Rohit Gupta',
    circle_rate: '₹12,000/sq.m',
    chain: [
      {
        year: '1995',
        type: 'Municipal Allotment',
        from: 'Lucknow Development Authority (LDA)',
        to: 'Mohan Gupta',
        description: 'Plot allotted under LDA residential scheme. Original allotment letter issued.',
        status: 'verified',
        doc: 'LDA Allotment Letter #R-994/1995',
      },
      {
        year: '2018',
        type: 'Gift Deed',
        from: 'Mohan Gupta',
        to: 'Rohit Gupta (Son)',
        description: 'Transferred as gift to son Rohit Gupta. Gift deed registered at Sub-Registrar.',
        status: 'verified',
        doc: 'Gift Deed #SR-LKO-2018-3312',
      },
      {
        year: '2020',
        type: 'Construction Loan',
        from: 'Rohit Gupta',
        to: 'HDFC Bank Ltd.',
        description: 'Plot mortgaged for home construction loan.',
        amount: '₹30,00,000',
        status: 'verified',
        doc: 'Loan A/c HDFC-HOME-2020-8847',
      },
    ],
  },
  '200/1': {
    survey_number: '200/1',
    village: 'Industrial Area Phase II',
    district: 'Agra',
    state: 'Uttar Pradesh',
    area: '1.2 Hectares (12,000 sq.m)',
    land_type: '🏭 Industrial',
    current_owner: 'Sharma Manufacturing Pvt. Ltd.',
    circle_rate: '₹45,000/sq.m',
    chain: [
      {
        year: '2005',
        type: 'Government Lease',
        from: 'UP Industrial Development Authority (UPIDA)',
        to: 'Sharma Industries',
        description: 'Industrial plot leased for 30 years under UPIDA industrial scheme.',
        status: 'verified',
        doc: 'Lease Deed #UPIDA-IND-2005-221',
      },
      {
        year: '2015',
        type: 'Company Succession',
        from: 'Sharma Industries (Proprietorship)',
        to: 'Sharma Manufacturing Pvt. Ltd.',
        description: 'Business converted to private limited company. Lease transferred with UPIDA approval.',
        status: 'pending',
        doc: 'Transfer Application #UPIDA-T-2015-78 (Pending Stamp Duty)',
      },
    ],
  },
};

const STATUS_STYLE = {
  verified: { dot: 'bg-emerald-500', label: 'Verified', text: 'text-emerald-700' },
  pending:  { dot: 'bg-amber-400',   label: 'Pending',  text: 'text-amber-700' },
  disputed: { dot: 'bg-red-500',     label: 'Disputed', text: 'text-red-700' },
};

const TYPE_COLORS: Record<string, string> = {
  'Sale Deed':           'bg-blue-100 text-blue-800 border-blue-300',
  'Inheritance (Will)':  'bg-purple-100 text-purple-800 border-purple-300',
  'Inheritance (Legal Heir)': 'bg-purple-100 text-purple-800 border-purple-300',
  'Mortgage / Encumbrance': 'bg-red-100 text-red-800 border-red-300',
  'Mortgage Discharged': 'bg-emerald-100 text-emerald-800 border-emerald-300',
  'Original Settlement': 'bg-slate-100 text-slate-800 border-slate-300',
  'Municipal Allotment': 'bg-slate-100 text-slate-800 border-slate-300',
  'Government Lease':    'bg-slate-100 text-slate-800 border-slate-300',
  'Gift Deed':           'bg-pink-100 text-pink-800 border-pink-300',
  'Construction Loan':   'bg-orange-100 text-orange-800 border-orange-300',
  'Company Succession':  'bg-indigo-100 text-indigo-800 border-indigo-300',
};

export default function ChainOfTitlePage() {
  const [query, setQuery]     = useState('');
  const [parcel, setParcel]   = useState<LandParcel | null>(null);
  const [notFound, setNotFound] = useState(false);

  const doSearch = () => {
    const key = query.trim().toUpperCase();
    const match = Object.keys(DEMO_DATA).find(k => k.toUpperCase() === key);
    if (match) {
      setParcel(DEMO_DATA[match]);
      setNotFound(false);
    } else {
      setParcel(null);
      setNotFound(true);
    }
  };

  const isClean = parcel && parcel.chain.every(e => e.status === 'verified');

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-2 mb-1">
            <Link2 size={20} className="text-emerald-500" />
            <h1 className="text-xl font-bold text-slate-900">Chain of Title</h1>
            <span className="text-xs bg-emerald-100 text-emerald-700 font-semibold px-2 py-0.5 rounded-full">Public</span>
          </div>
          <p className="text-slate-500 text-sm">
            Complete verified ownership history of any land parcel — used by banks, lawyers, and buyers before property transactions.
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-6 space-y-6">

        {/* Search */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <label className="block text-sm font-semibold text-slate-700 mb-2">Enter Survey Number</label>
          <div className="flex gap-3">
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && doSearch()}
              placeholder="e.g. 124/7 or 45A or 200/1"
              className="flex-1 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            />
            <button
              onClick={doSearch}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-6 py-3 rounded-xl text-sm flex items-center gap-2 transition-colors"
            >
              <Search size={15} /> Search
            </button>
          </div>
          <div className="flex gap-2 mt-2 flex-wrap">
            <p className="text-xs text-slate-400 mr-1">Try demo surveys:</p>
            {['124/7', '45A', '200/1'].map(s => (
              <button key={s} onClick={() => { setQuery(s); setTimeout(doSearch, 50); }}
                className="text-xs font-mono text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg hover:bg-emerald-100 transition-colors">
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Not found */}
        {notFound && (
          <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
            <AlertTriangle size={32} className="mx-auto text-amber-400 mb-3" />
            <p className="text-slate-600 font-semibold">No chain of title found for "{query}"</p>
            <p className="text-slate-400 text-sm mt-1">The survey number may not be digitized yet. Try 124/7, 45A, or 200/1.</p>
          </div>
        )}

        {/* Result */}
        {parcel && (
          <>
            {/* Parcel info header */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className={`px-6 py-4 flex items-start justify-between gap-4 ${isClean ? 'bg-emerald-600' : 'bg-amber-500'} text-white`}>
                <div>
                  <p className="text-xs opacity-80 uppercase tracking-widest mb-1">Land Record — Chain of Title</p>
                  <h2 className="text-2xl font-black">Survey #{parcel.survey_number}</h2>
                  <p className="text-sm opacity-80 mt-0.5">{parcel.village}, {parcel.district}, {parcel.state}</p>
                </div>
                <div className={`flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-full ${isClean ? 'bg-white/20' : 'bg-white/20'}`}>
                  {isClean
                    ? <><CheckCircle size={13} /> CLEAR TITLE</>
                    : <><Clock size={13} /> PENDING ITEMS</>}
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-0 divide-x divide-y divide-slate-100">
                {[
                  { icon: <Hash size={14} />,    label: 'Survey No',      value: parcel.survey_number },
                  { icon: <FileText size={14} />, label: 'Area',           value: parcel.area },
                  { icon: <User size={14} />,     label: 'Current Owner',  value: parcel.current_owner },
                  { icon: <Shield size={14} />,   label: 'Circle Rate',    value: parcel.circle_rate },
                ].map(f => (
                  <div key={f.label} className="px-4 py-3">
                    <div className="flex items-center gap-1.5 text-slate-400 mb-1">{f.icon}<p className="text-xs uppercase tracking-wide">{f.label}</p></div>
                    <p className="text-sm font-bold text-slate-800">{f.value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Timeline */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  <Link2 size={16} className="text-emerald-500" />
                  Ownership Chain ({parcel.chain.length} events)
                </h3>
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 text-xs text-emerald-700 border border-emerald-300 rounded-lg px-3 py-2 hover:bg-emerald-50 transition-colors"
                >
                  <Download size={12} /> Download Chain
                </button>
              </div>

              <div className="relative">
                {/* Vertical line */}
                <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-slate-100" />

                <div className="space-y-0">
                  {parcel.chain.map((event, i) => {
                    const st  = STATUS_STYLE[event.status];
                    const tc  = TYPE_COLORS[event.type] ?? 'bg-slate-100 text-slate-700 border-slate-300';
                    const isLast = i === parcel.chain.length - 1;

                    return (
                      <div key={i} className="relative flex gap-5">
                        {/* Node */}
                        <div className="flex flex-col items-center flex-shrink-0 w-12">
                          <div className={`w-12 h-12 rounded-full border-4 border-white shadow flex items-center justify-center text-white font-bold text-sm ${
                            isLast ? 'bg-emerald-600' : 'bg-slate-400'
                          } z-10`}>
                            {isLast ? <Landmark size={18} /> : (parcel.chain.length - i)}
                          </div>
                          {!isLast && <div className="w-0.5 bg-slate-200 flex-1 my-1" style={{ minHeight: 24 }} />}
                        </div>

                        {/* Card */}
                        <div className={`flex-1 mb-4 rounded-2xl border p-4 ${isLast ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-white'}`}>
                          <div className="flex items-start justify-between gap-3 flex-wrap mb-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-slate-500 text-sm">{event.year}</span>
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${tc}`}>{event.type}</span>
                              <span className={`text-xs font-semibold ${st.text}`}>● {st.label}</span>
                            </div>
                            {event.amount && (
                              <span className="text-sm font-bold text-emerald-700">{event.amount}</span>
                            )}
                          </div>

                          {/* Transfer arrow */}
                          <div className="flex items-center gap-2 text-xs text-slate-600 mb-2 flex-wrap">
                            <span className="font-semibold bg-slate-100 px-2 py-0.5 rounded">{event.from}</span>
                            <ArrowDown size={12} className="text-slate-400 rotate-[-90deg] flex-shrink-0" />
                            <span className={`font-semibold px-2 py-0.5 rounded ${isLast ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-50 text-blue-800'}`}>{event.to}</span>
                          </div>

                          <p className="text-xs text-slate-600 leading-relaxed">{event.description}</p>

                          {event.doc && (
                            <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-400">
                              <FileText size={11} />
                              <span className="font-mono">{event.doc}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Summary bar */}
              <div className={`mt-2 rounded-2xl p-4 flex items-center gap-3 ${isClean ? 'bg-emerald-50 border border-emerald-200' : 'bg-amber-50 border border-amber-200'}`}>
                {isClean
                  ? <><CheckCircle size={18} className="text-emerald-600 flex-shrink-0" /><p className="text-sm text-emerald-800"><strong>Clear Title:</strong> All {parcel.chain.length} ownership events are verified. This parcel has no outstanding disputes or encumbrances.</p></>
                  : <><AlertTriangle size={18} className="text-amber-600 flex-shrink-0" /><p className="text-sm text-amber-800"><strong>Pending Items:</strong> Some events are awaiting verification. Consult a lawyer before transacting on this parcel.</p></>}
              </div>
            </div>

            {/* Quick actions */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { label: 'View Encumbrance Certificate', href: '/encumbrance', icon: <Shield size={14} /> },
                { label: 'Estimate Property Tax',        href: '/tax-calculator', icon: <FileText size={14} /> },
                { label: 'Search Other Parcels',         href: '/citizen',  icon: <Search size={14} /> },
              ].map(a => (
                <Link key={a.label} href={a.href}
                  className="flex items-center justify-between gap-3 bg-white border border-slate-200 rounded-2xl px-4 py-3 hover:bg-slate-50 transition-colors group">
                  <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                    <span className="text-emerald-500">{a.icon}</span>
                    {a.label}
                  </div>
                  <ChevronRight size={14} className="text-slate-400 group-hover:text-slate-600" />
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
