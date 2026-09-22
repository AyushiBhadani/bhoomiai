'use client';

/**
 * Loan Eligibility Estimator — helps citizens understand how much home/land loan
 * they can get against their property, and what the EMI would be.
 */
import React, { useState } from 'react';
import Link from 'next/link';
import {
  Calculator, TrendingUp, ChevronRight, Info,
  CheckCircle, Building2, Percent, IndianRupee,
} from 'lucide-react';

const BANKS = [
  { name: 'State Bank of India (SBI)',  rate: 8.5,  maxLTV: 75, logo: '🏦', schemes: ['Kisan Credit Card', 'Agricultural Term Loan', 'Home Loan'] },
  { name: 'HDFC Bank',                  rate: 8.75, maxLTV: 80, logo: '🏛️', schemes: ['Home Loan', 'Plot Loan', 'LAP'] },
  { name: 'Punjab National Bank (PNB)', rate: 8.4,  maxLTV: 70, logo: '🏢', schemes: ['Kisan Vikas', 'Housing Loan', 'LAP'] },
  { name: 'Bank of Baroda',             rate: 8.6,  maxLTV: 75, logo: '🏦', schemes: ['Baroda Kisan', 'Home Loan', 'LAP'] },
  { name: 'NABARD (via RRBs)',          rate: 7.0,  maxLTV: 85, logo: '🌾', schemes: ['Agri Infrastructure Fund', 'KCC', 'RIDF'] },
];

const LAND_TYPE_LTV: Record<string, number> = {
  'Agricultural':             70,
  'Agricultural (Irrigated)': 75,
  'Dry Crop Land':            60,
  'Residential':              80,
  'Commercial':               65,
  'Industrial':               60,
};

function formatInr(val: number): string {
  if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`;
  if (val >= 100000)   return `₹${(val / 100000).toFixed(2)} L`;
  return `₹${Math.round(val).toLocaleString('en-IN')}`;
}

function calcEMI(principal: number, ratePercent: number, tenureYears: number): number {
  const r = ratePercent / (12 * 100);
  const n = tenureYears * 12;
  if (r === 0) return principal / n;
  return principal * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1);
}

export default function LoanEligibilityPage() {
  const [area, setArea]         = useState('');
  const [areaUnit, setAreaUnit] = useState<'hectare' | 'sqm' | 'acre'>('hectare');
  const [circleRate, setCircleRate] = useState('');
  const [landType, setLandType] = useState('Agricultural');
  const [income, setIncome]     = useState('');
  const [result, setResult]     = useState<null | {
    propertyValue: number;
    maxLoan: number;
    ltv: number;
  }>(null);

  const calculate = () => {
    const rawArea    = parseFloat(area);
    const rate       = parseFloat(circleRate);
    if (isNaN(rawArea) || isNaN(rate) || rawArea <= 0 || rate <= 0) return;
    let sqm = rawArea;
    if (areaUnit === 'hectare') sqm = rawArea * 10000;
    if (areaUnit === 'acre')    sqm = rawArea * 4047;
    const propertyValue = sqm * rate;
    const ltv           = LAND_TYPE_LTV[landType] ?? 70;
    const maxLoan       = propertyValue * (ltv / 100);
    setResult({ propertyValue, maxLoan, ltv });
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white border-b border-slate-200 px-6 py-5">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-2 mb-1">
            <Building2 size={20} className="text-blue-500" />
            <h1 className="text-xl font-bold text-slate-900">Land Loan Eligibility Estimator</h1>
            <span className="text-xs bg-blue-100 text-blue-700 font-semibold px-2 py-0.5 rounded-full">Free</span>
          </div>
          <p className="text-slate-500 text-sm">Find out how much loan you can get against your land, and compare bank offers.</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-6 space-y-5">

        {/* Input form */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h2 className="text-sm font-bold text-slate-800 mb-4">Enter Your Land Details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Area */}
            <div className="sm:col-span-2">
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Land Area</label>
              <div className="flex gap-2">
                <input type="number" value={area} onChange={e => setArea(e.target.value)}
                  placeholder="e.g. 2.5"
                  className="flex-1 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
                <select value={areaUnit} onChange={e => setAreaUnit(e.target.value as 'hectare' | 'sqm' | 'acre')}
                  className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none">
                  <option value="hectare">Hectares</option>
                  <option value="acre">Acres</option>
                  <option value="sqm">Sq. Metres</option>
                </select>
              </div>
            </div>

            {/* Land Type */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Land Type</label>
              <select value={landType} onChange={e => setLandType(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm bg-white focus:outline-none focus:border-blue-400">
                {Object.keys(LAND_TYPE_LTV).map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            {/* Circle Rate */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Govt. Circle Rate (₹/sq.m)</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-semibold">₹</span>
                <input type="number" value={circleRate} onChange={e => setCircleRate(e.target.value)}
                  placeholder="e.g. 450"
                  className="w-full border border-slate-200 rounded-xl pl-8 pr-4 py-2.5 text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
              </div>
              <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                <Info size={10} /> Find rate on <Link href="/map" className="text-blue-600 hover:underline">GIS Map</Link>
              </p>
            </div>

            {/* Monthly Income (optional) */}
            <div className="sm:col-span-2">
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                Monthly Income <span className="font-normal text-slate-400">(optional — for income-based limit)</span>
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-semibold">₹</span>
                <input type="number" value={income} onChange={e => setIncome(e.target.value)}
                  placeholder="e.g. 25000"
                  className="w-full border border-slate-200 rounded-xl pl-8 pr-4 py-2.5 text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
              </div>
            </div>
          </div>

          <button onClick={calculate} disabled={!area || !circleRate}
            className="mt-5 w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl text-sm transition-colors flex items-center justify-center gap-2">
            <Calculator size={16} /> Check Loan Eligibility
          </button>
        </div>

        {/* Result */}
        {result && (
          <>
            {/* Summary */}
            <div className="bg-blue-600 rounded-2xl p-5 text-white">
              <p className="text-sm font-semibold opacity-80 mb-1">Maximum Loan You Can Get</p>
              <p className="text-4xl font-black">{formatInr(result.maxLoan)}</p>
              <div className="flex items-center gap-4 mt-3 text-sm">
                <div><p className="opacity-70 text-xs">Property Value</p><p className="font-bold">{formatInr(result.propertyValue)}</p></div>
                <div className="w-px h-8 bg-white/30" />
                <div><p className="opacity-70 text-xs">Max LTV Ratio</p><p className="font-bold">{result.ltv}%</p></div>
                {income && (
                  <>
                    <div className="w-px h-8 bg-white/30" />
                    <div><p className="opacity-70 text-xs">Income-based Limit</p>
                      <p className="font-bold">{formatInr(parseFloat(income) * 12 * 4)}</p></div>
                  </>
                )}
              </div>
            </div>

            {/* EMI Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                <Percent size={16} className="text-blue-500" /> EMI Comparison (for {formatInr(result.maxLoan)} loan)
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      {['Tenure', '10 Years', '15 Years', '20 Years', '25 Years'].map(h => (
                        <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {BANKS.slice(0, 4).map(bank => (
                      <tr key={bank.name} className="hover:bg-slate-50">
                        <td className="px-3 py-3">
                          <p className="font-semibold text-slate-800 text-xs">{bank.logo} {bank.name.split('(')[0].trim()}</p>
                          <p className="text-xs text-blue-600">{bank.rate}% p.a.</p>
                        </td>
                        {[10, 15, 20, 25].map(y => (
                          <td key={y} className="px-3 py-3 font-semibold text-slate-700">
                            {formatInr(calcEMI(result.maxLoan, bank.rate, y))}<span className="text-xs font-normal text-slate-400">/mo</span>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Bank Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {BANKS.map(bank => (
                <div key={bank.name} className="bg-white rounded-2xl border border-slate-200 p-4 hover:border-blue-300 transition-colors">
                  <div className="flex items-start justify-between mb-3">
                    <span className="text-2xl">{bank.logo}</span>
                    <span className="text-xs font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                      up to {bank.maxLTV}% LTV
                    </span>
                  </div>
                  <p className="text-sm font-bold text-slate-800 mb-1">{bank.name}</p>
                  <p className="text-lg font-black text-blue-600 mb-2">{bank.rate}% <span className="text-xs font-normal text-slate-400">p.a.</span></p>
                  <div className="flex flex-wrap gap-1">
                    {bank.schemes.map(s => (
                      <span key={s} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{s}</span>
                    ))}
                  </div>
                  <div className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                    <CheckCircle size={12} /> Eligible for: {formatInr(result.maxLoan * (bank.maxLTV / 100))}
                  </div>
                </div>
              ))}
            </div>

            {/* NABARD highlight */}
            <div className="bg-green-50 border border-green-200 rounded-2xl p-4 flex items-start gap-3">
              <span className="text-2xl flex-shrink-0">🌾</span>
              <div>
                <p className="font-bold text-green-800">NABARD Agri Loans — Lowest Rate at 7%</p>
                <p className="text-sm text-green-700 mt-1">
                  If your land is <strong>agricultural</strong>, you qualify for NABARD-backed loans at 7% through Regional Rural Banks (RRBs) and cooperatives. Up to 85% LTV and repayment up to 25 years. Apply at your nearest Gramin Bank.
                </p>
              </div>
            </div>

            {/* Quick actions */}
            <div className="flex flex-wrap gap-3">
              {[
                { label: 'View Chain of Title',     href: '/chain-of-title' },
                { label: 'Encumbrance Certificate', href: '/encumbrance' },
                { label: 'Calculate Property Tax',  href: '/tax-calculator' },
              ].map(a => (
                <Link key={a.label} href={a.href}
                  className="flex items-center gap-1.5 text-xs text-slate-700 bg-white border border-slate-200 rounded-xl px-4 py-2 hover:bg-slate-50 transition-colors">
                  {a.label} <ChevronRight size={12} />
                </Link>
              ))}
            </div>
          </>
        )}

        {/* Explainer */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { icon: <TrendingUp size={16} className="text-blue-500" />, title: 'What is LTV?', desc: 'Loan-to-Value ratio is the maximum % of your property value a bank will lend. Agricultural land gets 60-75%, residential gets up to 80%.' },
            { icon: <IndianRupee size={16} className="text-emerald-500" />, title: 'Why Circle Rate?', desc: 'Banks use government circle rates (not market price) to calculate your property value for loans. Circle rates are fixed and fraud-proof.' },
            { icon: <Building2 size={16} className="text-purple-500" />, title: 'Loan Against Property (LAP)', desc: 'You can get a loan against any type of land — agricultural, residential, or commercial — without selling it.' },
          ].map(b => (
            <div key={b.title} className="bg-white rounded-2xl border border-slate-200 p-4">
              <div className="flex items-center gap-2 mb-2">{b.icon}<p className="text-sm font-semibold text-slate-800">{b.title}</p></div>
              <p className="text-xs text-slate-500 leading-relaxed">{b.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
