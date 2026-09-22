'use client';

/**
 * Property Tax Calculator — estimates annual property tax based on
 * government circle rate, land area, land type, and location.
 * Helps citizens understand their tax liability BEFORE visiting a taluka office.
 */
import React, { useState } from 'react';
import { Calculator, Info, TrendingUp, MapPin, FileText, ChevronRight } from 'lucide-react';
import Link from 'next/link';

const LAND_TYPES = [
  { value: 'Agricultural',             label: '🌾 Agricultural',             taxRate: 0.0005 },
  { value: 'Agricultural (Irrigated)', label: '🌾 Agricultural (Irrigated)', taxRate: 0.0007 },
  { value: 'Dry Crop Land',            label: '🌱 Dry Crop Land',            taxRate: 0.0004 },
  { value: 'Residential',              label: '🏘️ Residential',               taxRate: 0.001  },
  { value: 'Commercial',               label: '🏪 Commercial',                taxRate: 0.002  },
  { value: 'Industrial',               label: '🏭 Industrial',                taxRate: 0.0025 },
  { value: 'Government',               label: '🏛️ Government',               taxRate: 0       },
  { value: 'Forest',                   label: '🌳 Forest',                    taxRate: 0       },
];

const DISTRICTS = [
  { name: 'Agra',      multiplier: 1.2 },
  { name: 'Mathura',   multiplier: 1.1 },
  { name: 'Lucknow',   multiplier: 1.5 },
  { name: 'Aligarh',   multiplier: 1.0 },
  { name: 'Varanasi',  multiplier: 1.3 },
  { name: 'Pune',      multiplier: 1.8 },
  { name: 'Mumbai',    multiplier: 2.5 },
  { name: 'Delhi',     multiplier: 2.0 },
  { name: 'Jaipur',    multiplier: 1.4 },
  { name: 'Hyderabad', multiplier: 1.6 },
  { name: 'Other',     multiplier: 1.0 },
];

function formatInr(val: number) {
  if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Crore`;
  if (val >= 100000)   return `₹${(val / 100000).toFixed(2)} Lakh`;
  if (val >= 1000)     return `₹${(val / 1000).toFixed(1)}K`;
  return `₹${Math.round(val).toLocaleString('en-IN')}`;
}

export default function TaxCalculatorPage() {
  const [area, setArea]         = useState('');
  const [areaUnit, setAreaUnit] = useState<'hectare' | 'sqm' | 'acre'>('hectare');
  const [landType, setLandType] = useState(LAND_TYPES[0].value);
  const [circleRate, setCircleRate] = useState('');
  const [district, setDistrict] = useState('Agra');
  const [result, setResult]     = useState<null | {
    marketValue: number;
    annualTax: number;
    quarterlyTax: number;
    monthlyTax: number;
    taxRate: number;
    areaSqm: number;
  }>(null);

  const calculate = () => {
    const rawArea = parseFloat(area);
    const rate    = parseFloat(circleRate);
    if (isNaN(rawArea) || isNaN(rate) || rawArea <= 0 || rate <= 0) return;

    // Convert area to sq.m
    let sqm = rawArea;
    if (areaUnit === 'hectare') sqm = rawArea * 10000;
    if (areaUnit === 'acre')    sqm = rawArea * 4047;

    const type         = LAND_TYPES.find(t => t.value === landType)!;
    const dist         = DISTRICTS.find(d => d.name === district)!;
    const marketValue  = sqm * rate;
    const taxRate      = type.taxRate * dist.multiplier;
    const annualTax    = marketValue * taxRate;

    setResult({
      marketValue,
      annualTax,
      quarterlyTax: annualTax / 4,
      monthlyTax: annualTax / 12,
      taxRate: taxRate * 100,
      areaSqm: sqm,
    });
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-5">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-2 mb-1">
            <Calculator size={20} className="text-emerald-500" />
            <h1 className="text-xl font-bold text-slate-900">Property Tax Calculator</h1>
            <span className="text-xs bg-emerald-100 text-emerald-700 font-semibold px-2 py-0.5 rounded-full">Free</span>
          </div>
          <p className="text-slate-500 text-sm">
            Estimate your annual property tax before visiting the taluka office. Based on government circle rates.
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-6 space-y-5">
        {/* Calculator card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Area */}
            <div className="sm:col-span-2">
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Land Area</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={area}
                  onChange={e => setArea(e.target.value)}
                  placeholder="e.g. 2.5"
                  className="flex-1 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                />
                <select
                  value={areaUnit}
                  onChange={e => setAreaUnit(e.target.value as 'hectare' | 'sqm' | 'acre')}
                  className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-emerald-400"
                >
                  <option value="hectare">Hectares</option>
                  <option value="acre">Acres</option>
                  <option value="sqm">Sq. Metres</option>
                </select>
              </div>
            </div>

            {/* Land Type */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Land Classification</label>
              <select
                value={landType}
                onChange={e => setLandType(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm bg-white focus:outline-none focus:border-emerald-400"
              >
                {LAND_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            {/* District */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">District</label>
              <div className="relative">
                <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <select
                  value={district}
                  onChange={e => setDistrict(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 text-sm bg-white focus:outline-none focus:border-emerald-400"
                >
                  {DISTRICTS.map(d => (
                    <option key={d.name} value={d.name}>{d.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Circle Rate */}
            <div className="sm:col-span-2">
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                Government Circle Rate
                <span className="ml-1 text-xs font-normal text-slate-400">(₹ per sq.metre)</span>
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-semibold text-sm">₹</span>
                <input
                  type="number"
                  value={circleRate}
                  onChange={e => setCircleRate(e.target.value)}
                  placeholder="e.g. 450 for agricultural, 12000 for residential"
                  className="w-full border border-slate-200 rounded-xl pl-8 pr-4 py-2.5 text-sm focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                />
              </div>
              <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                <Info size={11} />
                Find your circle rate on the <Link href="/map" className="text-emerald-600 hover:underline">GIS Map</Link> (click any parcel)
              </p>
            </div>
          </div>

          <button
            onClick={calculate}
            disabled={!area || !circleRate}
            className="mt-5 w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
          >
            <Calculator size={16} /> Calculate Tax Estimate
          </button>
        </div>

        {/* Result */}
        {result && (
          <div className="bg-white rounded-2xl border-2 border-emerald-400 shadow-sm overflow-hidden">
            <div className="bg-emerald-600 px-6 py-4 text-white">
              <p className="text-sm font-semibold opacity-80">Estimated Annual Property Tax</p>
              <p className="text-4xl font-black mt-0.5">{formatInr(result.annualTax)}</p>
              <p className="text-xs text-emerald-200 mt-1">Effective rate: {result.taxRate.toFixed(3)}% of market value</p>
            </div>

            <div className="p-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: 'Market Value',    value: formatInr(result.marketValue),    color: 'text-slate-800' },
                { label: 'Annual Tax',      value: formatInr(result.annualTax),      color: 'text-emerald-700 font-bold' },
                { label: 'Quarterly Tax',   value: formatInr(result.quarterlyTax),   color: 'text-blue-700' },
                { label: 'Monthly (EMI)',   value: formatInr(result.monthlyTax),     color: 'text-purple-700' },
              ].map(r => (
                <div key={r.label} className="bg-slate-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-slate-400 mb-1">{r.label}</p>
                  <p className={`text-base font-bold ${r.color}`}>{r.value}</p>
                </div>
              ))}
            </div>

            <div className="px-6 pb-4">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
                <Info size={14} className="text-amber-600 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-amber-800">
                  This is an <strong>estimate only</strong>. Actual tax may vary based on municipal rules, exemptions (e.g. SC/ST, small farmers), and local cess. Visit your Taluka office or the state revenue portal for official calculation.
                </p>
              </div>
            </div>

            <div className="px-6 pb-5 flex gap-3">
              <Link href="/citizen" className="flex items-center gap-1.5 text-xs text-emerald-700 border border-emerald-300 rounded-xl px-4 py-2 hover:bg-emerald-50 transition-colors">
                Search Land Records <ChevronRight size={12} />
              </Link>
              <Link href="/encumbrance" className="flex items-center gap-1.5 text-xs text-slate-700 border border-slate-200 rounded-xl px-4 py-2 hover:bg-slate-50 transition-colors">
                Check Encumbrance <ChevronRight size={12} />
              </Link>
            </div>
          </div>
        )}

        {/* Info boxes */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            {
              icon: <TrendingUp size={16} className="text-emerald-500" />,
              title: 'What is Circle Rate?',
              desc: 'The minimum price per sq.m fixed by the state government for property registration. Stamp duty and tax are calculated on this rate.',
            },
            {
              icon: <FileText size={16} className="text-blue-500" />,
              title: 'Tax-Free Categories',
              desc: 'Government land, forest land, and land held by SC/ST communities under tribal land acts are typically fully exempt.',
            },
            {
              icon: <MapPin size={16} className="text-purple-500" />,
              title: 'Urban vs Rural',
              desc: 'Urban (municipal) areas have higher tax rates than rural (gram panchayat) areas. The district multiplier accounts for this.',
            },
          ].map(box => (
            <div key={box.title} className="bg-white rounded-2xl border border-slate-200 p-4">
              <div className="flex items-center gap-2 mb-2">{box.icon}<p className="text-sm font-semibold text-slate-800">{box.title}</p></div>
              <p className="text-xs text-slate-500 leading-relaxed">{box.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
