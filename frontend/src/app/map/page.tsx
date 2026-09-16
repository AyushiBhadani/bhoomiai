'use client';

import React, { useEffect, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import { MapPin, Layers, Search, X, Info, AlertTriangle, Loader2 } from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import type { Parcel } from '@/lib/types';

const MapView = dynamic(() => import('@/components/MapView'), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 flex items-center justify-center bg-slate-100">
      <div className="flex flex-col items-center gap-3 text-slate-500">
        <Loader2 size={32} className="animate-spin text-emerald-500" />
        <p className="text-sm">Loading map...</p>
      </div>
    </div>
  ),
});

function MapPageContent() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const highlightSurvey = searchParams.get('survey_number');

  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Parcel | null>(null);
  const [search, setSearch] = useState('');

  const fetchParcels = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/parcels');
      const data: Parcel[] = Array.isArray(res.data) ? res.data : res.data.parcels ?? [];
      setParcels(data);
      if (highlightSurvey) {
        const found = data.find((p) => p.survey_number === highlightSurvey);
        if (found) setSelected(found);
      }
    } catch {
      setError('Could not load parcel reference data.');
    } finally {
      setLoading(false);
    }
  }, [highlightSurvey]);

  useEffect(() => {
    if (!authLoading && !user) { router.push('/login'); return; }
    if (!authLoading) fetchParcels();
  }, [authLoading, user, router, fetchParcels]);

  const filtered = parcels.filter((p) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return p.survey_number.toLowerCase().includes(q) || p.village.toLowerCase().includes(q);
  });

  return (
    <div className="relative flex h-[calc(100vh-0px)] overflow-hidden">
      {/* Full-viewport map */}
      <div className="absolute inset-0 z-0">
        {!loading && (
          <MapView parcels={parcels} highlightSurvey={highlightSurvey ?? undefined} onSelect={setSelected} />
        )}
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-100 z-10">
            <div className="flex flex-col items-center gap-3 text-slate-500">
              <Loader2 size={36} className="animate-spin text-emerald-500" />
              <p className="text-sm font-medium">Loading parcels...</p>
            </div>
          </div>
        )}
      </div>

      {/* Glass-morphism sidebar */}
      <aside
        className="relative z-10 w-72 m-3 flex flex-col rounded-2xl overflow-hidden shadow-2xl"
        style={{
          background: 'rgba(255,255,255,0.92)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: '1px solid rgba(255,255,255,0.6)',
        }}
      >
        {/* Header */}
        <div className="px-4 py-4 border-b border-slate-100/80">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center">
              <Layers size={15} className="text-emerald-600" />
            </div>
            <div>
              <h2 className="font-bold text-slate-900 text-sm">Land Parcels</h2>
              <p className="text-xs text-slate-500">{parcels.length} parcel{parcels.length !== 1 ? 's' : ''} loaded</p>
            </div>
          </div>
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Survey # or village..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-8 py-2 text-xs bg-slate-100 border-none rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X size={12} />
              </button>
            )}
          </div>
          {highlightSurvey && (
            <div className="mt-2 text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-1.5 rounded-lg flex items-center gap-1.5">
              <MapPin size={11} /> Highlighting: <strong>{highlightSurvey}</strong>
            </div>
          )}
        </div>

        {/* Parcel list */}
        <div className="flex-1 overflow-y-auto custom-scroll">
          {error ? (
            <div className="p-4 m-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 flex gap-2 items-start">
              <AlertTriangle size={13} className="mt-0.5 flex-shrink-0" />{error}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <MapPin size={28} className="mb-2 text-slate-300" />
              <p className="text-xs text-center">{search ? 'No parcels match.' : 'No parcels available.'}</p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100/80">
              {filtered.map((p) => {
                const isHighlighted = p.survey_number === highlightSurvey;
                const isSelected = selected?.id === p.id;
                return (
                  <li key={p.id}>
                    <button
                      onClick={() => setSelected(p)}
                      className={`w-full text-left px-4 py-3 hover:bg-emerald-50/60 transition-colors ${
                        isSelected ? 'bg-emerald-50 border-l-[3px] border-emerald-500' : isHighlighted ? 'bg-amber-50/60' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-xs font-semibold text-slate-800">Survey #{p.survey_number}</p>
                          <p className="text-xs text-slate-500 mt-0.5">{p.village}</p>
                        </div>
                        <span className="text-xs text-slate-400 whitespace-nowrap">{p.area?.toLocaleString()} m²</span>
                      </div>
                      {isHighlighted && (
                        <span className="inline-block mt-1 text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-medium">Highlighted</span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Selected parcel detail */}
        {selected && (
          <div className="border-t border-slate-100 bg-gradient-to-b from-emerald-50 to-white p-4">
            <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5 mb-3">
              <div className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center">
                <Info size={9} className="text-white" />
              </div>
              Selected Parcel
            </h3>
            <dl className="space-y-1.5">
              {[
                ['Survey #', selected.survey_number],
                ['Village', selected.village],
                ['Area', `${selected.area?.toLocaleString()} m2`],
                ['Has Geometry', selected.geometry_geojson ? 'Yes' : 'No'],
              ].map(([label, val]) => (
                <div key={label} className="flex items-baseline justify-between gap-2">
                  <dt className="text-xs text-slate-500">{label}</dt>
                  <dd className="text-xs font-semibold text-slate-800 text-right">{val}</dd>
                </div>
              ))}
            </dl>
            <button
              onClick={() => setSelected(null)}
              className="mt-3 w-full text-xs text-slate-400 hover:text-slate-600 flex items-center justify-center gap-1"
            >
              <X size={11} /> Clear selection
            </button>
          </div>
        )}
      </aside>
    </div>
  );
}

export default function MapPage() {
  return (
    <React.Suspense fallback={<div className="p-8 flex justify-center items-center text-slate-500 gap-2"><Loader2 className="animate-spin" size={20} /> Loading Map...</div>}>
      <MapPageContent />
    </React.Suspense>
  );
}
