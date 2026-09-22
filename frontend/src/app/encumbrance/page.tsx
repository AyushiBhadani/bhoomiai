'use client';
import React, { useState } from 'react';
import { Search, Download, Shield, AlertCircle } from 'lucide-react';

type EcRecord = {
  year: string;
  type: string;
  parties: string;
  amount: string;
  status: string;
};

const DEMO_EC: Record<string, EcRecord[]> = {
  '124/7': [
    { year: '2024', type: 'Sale Deed', parties: 'Ramesh Kumar → Sunita Devi', amount: '₹11,25,000', status: 'Registered' },
    { year: '2020', type: 'Mortgage', parties: 'Ramesh Kumar ↔ SBI Bank', amount: '₹5,00,000', status: 'Discharged' },
    { year: '2015', type: 'Gift Deed', parties: 'Shiv Lal → Ramesh Kumar', amount: 'NIL', status: 'Registered' },
    { year: '2011', type: 'Inheritance Mutation', parties: 'Shiv Lal Estate', amount: 'NIL', status: 'Approved' },
    { year: '1998', type: 'Lease Agreement', parties: 'Shiv Lal ↔ Kisaan Co-op', amount: '₹12,000/yr', status: 'Expired' },
  ],
  '45A': [
    { year: '2022', type: 'Sale Deed', parties: 'Builder Corp → Rohan Gupta', amount: '₹45,00,000', status: 'Registered' },
    { year: '2018', type: 'Construction Loan', parties: 'Rohan Gupta ↔ HDFC', amount: '₹30,00,000', status: 'Active' },
  ],
};

const STATUS_COLORS: Record<string, string> = {
  Active:      'bg-blue-100 text-blue-700',
  Registered:  'bg-emerald-100 text-emerald-700',
  Discharged:  'bg-slate-100 text-slate-600',
};

function statusColor(status: string): string {
  return STATUS_COLORS[status] ?? 'bg-amber-100 text-amber-700';
}

export default function EncumbrancePage() {
  const [survey, setSurvey]   = useState('');
  const [result, setResult]   = useState<EcRecord[] | null>(null);
  const [searched, setSearched] = useState('');

  const doSearch = () => {
    const s   = survey.trim().toUpperCase();
    const key = Object.keys(DEMO_EC).find(k => k.toUpperCase() === s);
    setSearched(survey.trim());
    setResult(key ? DEMO_EC[key] : []);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-emerald-700 text-white px-6 py-10 text-center">
        <Shield size={36} className="mx-auto mb-3 text-emerald-300" />
        <h1 className="text-2xl font-bold">Encumbrance Certificate (EC)</h1>
        <p className="text-emerald-200 text-sm mt-2 max-w-lg mx-auto">
          View the complete 12-year transaction history of any land parcel.
          Required by banks for property loans.
        </p>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Search */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6">
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            Enter Survey Number
          </label>
          <div className="flex gap-3">
            <input
              value={survey}
              onChange={e => setSurvey(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && doSearch()}
              placeholder="e.g. 124/7 or 45A"
              className="flex-1 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            />
            <button
              onClick={doSearch}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-6 py-3 rounded-xl text-sm flex items-center gap-2 transition-colors"
            >
              <Search size={15} /> Search EC
            </button>
          </div>
          <p className="text-xs text-slate-400 mt-2">
            Try:{' '}
            <span
              className="font-mono text-emerald-600 cursor-pointer"
              onClick={() => setSurvey('124/7')}
            >
              124/7
            </span>{' '}
            or{' '}
            <span
              className="font-mono text-emerald-600 cursor-pointer"
              onClick={() => setSurvey('45A')}
            >
              45A
            </span>
          </p>
        </div>

        {result !== null && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div>
                <p className="font-bold text-slate-800">EC for Survey No: {searched}</p>
                <p className="text-xs text-slate-500 mt-0.5">Encumbrance period: Last 12 years</p>
              </div>
              {result.length > 0 && (
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 text-xs text-emerald-700 border border-emerald-300 rounded-lg px-3 py-2 hover:bg-emerald-50"
                >
                  <Download size={12} /> Download EC
                </button>
              )}
            </div>

            {result.length === 0 ? (
              <div className="text-center py-12">
                <AlertCircle size={32} className="mx-auto text-slate-300 mb-3" />
                <p className="text-slate-500">No encumbrance records found for this survey number.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      {['Year', 'Transaction Type', 'Parties Involved', 'Amount', 'Status'].map(h => (
                        <th
                          key={h}
                          className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {result.map((r, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-semibold text-slate-800">{r.year}</td>
                        <td className="px-4 py-3 text-slate-700">{r.type}</td>
                        <td className="px-4 py-3 text-slate-600 text-xs">{r.parties}</td>
                        <td className="px-4 py-3 font-medium text-emerald-700">{r.amount}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-semibold px-2 py-1 rounded-full ${statusColor(r.status)}`}>
                            {r.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
