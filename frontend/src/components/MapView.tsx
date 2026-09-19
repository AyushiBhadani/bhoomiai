'use client';

/**
 * MapView – Leaflet + OpenStreetMap
 * Features:
 *  - Color-coded by land_classification
 *  - Circle rate (govt price) displayed on click
 *  - Legend overlay
 *  - Boundary polygon for each parcel
 */

import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Polygon, Marker, Popup, useMap } from 'react-leaflet';
import type { LatLngTuple } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Parcel } from '@/lib/types';

export interface MapViewProps {
  parcels: Parcel[];
  highlightSurvey?: string;
  onSelect?: (parcel: Parcel) => void;
}

// Fix default Leaflet marker icons broken by webpack
function fixLeafletIcons() {
  if (typeof window === 'undefined') return;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const L = require('leaflet');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  delete (L.Icon.Default.prototype as { _getIconUrl?: unknown })._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  });
}

// Land classification → color scheme
const LAND_COLORS: Record<string, { stroke: string; fill: string; label: string; emoji: string }> = {
  'Agricultural':           { stroke: '#16a34a', fill: '#bbf7d0', label: 'Agricultural',    emoji: '🌾' },
  'Agricultural (Irrigated)': { stroke: '#15803d', fill: '#86efac', label: 'Agricultural (Irrigated)', emoji: '🌾' },
  'Dry Crop Land':          { stroke: '#65a30d', fill: '#d9f99d', label: 'Dry Crop Land',  emoji: '🌱' },
  'Industrial':             { stroke: '#dc2626', fill: '#fecaca', label: 'Industrial',      emoji: '🏭' },
  'Residential':            { stroke: '#2563eb', fill: '#bfdbfe', label: 'Residential',     emoji: '🏘️' },
  'Commercial':             { stroke: '#d97706', fill: '#fde68a', label: 'Commercial',      emoji: '🏪' },
  'Government':             { stroke: '#7c3aed', fill: '#e9d5ff', label: 'Government',      emoji: '🏛️' },
  'Forest':                 { stroke: '#166534', fill: '#a7f3d0', label: 'Forest',          emoji: '🌳' },
  'Wasteland':              { stroke: '#78716c', fill: '#e7e5e4', label: 'Wasteland',       emoji: '🏜️' },
};

const DEFAULT_COLOR = { stroke: '#10b981', fill: '#d1fae5', label: 'Land', emoji: '📍' };

function getLandColor(classification?: string | null) {
  if (!classification) return DEFAULT_COLOR;
  for (const [key, val] of Object.entries(LAND_COLORS)) {
    if (classification.toLowerCase().includes(key.toLowerCase())) return val;
  }
  return DEFAULT_COLOR;
}

// Spread demo parcels across Agra region
const DEMO_COORDS: Record<string, [number, number]> = {
  '124/7':  [27.1767, 78.0081],
  '45A':    [27.1902, 78.0241],
  '99/3B':  [27.1630, 77.9980],
  '200/1':  [27.1840, 78.0350],
  '312':    [27.1700, 78.0180],
};

function getCoords(p: Parcel): [number, number] {
  if (p.geometry_geojson?.coordinates) {
    const c = p.geometry_geojson.coordinates;
    if (Array.isArray(c) && c.length === 2) return [c[1] as number, c[0] as number];
  }
  return DEMO_COORDS[p.survey_number] ?? [27.1767 + Math.random() * 0.02, 78.0081 + Math.random() * 0.02];
}

function makePolygon(lat: number, lng: number, size = 0.003): LatLngTuple[] {
  return [
    [lat + size, lng - size],
    [lat + size, lng + size],
    [lat - size, lng + size],
    [lat - size, lng - size],
  ];
}

function FitBounds({ coords }: { coords: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (coords.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const L = require('leaflet');
      map.fitBounds(L.latLngBounds(coords), { padding: [60, 60] });
    }
  }, [map, coords]);
  return null;
}

function formatPrice(rate?: number | null) {
  if (!rate) return null;
  if (rate >= 100000) return `₹${(rate / 100000).toFixed(1)}L/sq.m`;
  if (rate >= 1000) return `₹${(rate / 1000).toFixed(1)}K/sq.m`;
  return `₹${rate}/sq.m`;
}

export default function MapView({ parcels, highlightSurvey, onSelect }: MapViewProps) {
  useEffect(() => { fixLeafletIcons(); }, []);

  const center: LatLngTuple = [27.1767, 78.0081];
  const coords = parcels.map(getCoords);

  // Unique land types for legend
  const legendTypes = Array.from(
    new Set(parcels.map(p => (p as Parcel & { land_classification?: string }).land_classification || 'Unknown'))
  ).slice(0, 6);

  return (
    <div className="relative w-full h-full">
      <MapContainer center={center} zoom={13} style={{ width: '100%', height: '100%' }} className="z-0">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {coords.length > 0 && <FitBounds coords={coords} />}

        {parcels.map((parcel, i) => {
          const [lat, lng] = coords[i];
          const isHighlighted = parcel.survey_number === highlightSurvey;
          const polygon = makePolygon(lat, lng, isHighlighted ? 0.005 : 0.003);
          const lc = (parcel as Parcel & { land_classification?: string }).land_classification;
          const colors = getLandColor(lc);
          const circleRate = (parcel as Parcel & { circle_rate_per_sqm?: number }).circle_rate_per_sqm;
          const estimatedValue = circleRate && parcel.area
            ? Math.round(parcel.area * 10000 * circleRate)  // area in hectares → sq.m
            : null;

          return (
            <React.Fragment key={parcel.id ?? parcel.survey_number}>
              <Polygon
                positions={polygon}
                pathOptions={{
                  color: isHighlighted ? '#f59e0b' : colors.stroke,
                  fillColor: isHighlighted ? '#fde68a' : colors.fill,
                  fillOpacity: isHighlighted ? 0.7 : 0.5,
                  weight: isHighlighted ? 4 : 2,
                  dashArray: isHighlighted ? undefined : '0',
                }}
                eventHandlers={{ click: () => onSelect?.(parcel) }}
              >
                <Popup maxWidth={260}>
                  <div className="text-sm space-y-1.5 p-1">
                    <div className="flex items-center gap-2">
                      <span className="text-base">{colors.emoji}</span>
                      <div>
                        <p className="font-bold text-slate-800">Survey #{parcel.survey_number}</p>
                        <p className="text-xs text-slate-500">{parcel.village}</p>
                      </div>
                    </div>
                    {lc && (
                      <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium"
                        style={{ background: colors.fill, color: colors.stroke, border: `1px solid ${colors.stroke}` }}>
                        {lc}
                      </span>
                    )}
                    <div className="grid grid-cols-2 gap-1 mt-2 text-xs">
                      <div className="bg-slate-50 rounded p-1.5">
                        <p className="text-slate-400">Area</p>
                        <p className="font-semibold text-slate-800">{parcel.area} Ha</p>
                        <p className="text-slate-400">{parcel.area ? (parcel.area * 10000).toFixed(0) : '-'} sq.m</p>
                      </div>
                      {circleRate && (
                        <div className="bg-emerald-50 rounded p-1.5">
                          <p className="text-emerald-600">Govt. Rate</p>
                          <p className="font-bold text-emerald-700">{formatPrice(circleRate)}</p>
                          <p className="text-emerald-500 text-xs">Circle Rate</p>
                        </div>
                      )}
                    </div>
                    {estimatedValue && (
                      <div className="bg-blue-50 border border-blue-200 rounded p-2 mt-1">
                        <p className="text-xs text-blue-600 font-medium">Estimated Minimum Value</p>
                        <p className="font-bold text-blue-800">₹{estimatedValue.toLocaleString('en-IN')}</p>
                        <p className="text-xs text-blue-400">Based on government circle rate</p>
                      </div>
                    )}
                  </div>
                </Popup>
              </Polygon>

              <Marker position={[lat, lng]} eventHandlers={{ click: () => onSelect?.(parcel) }}>
                <Popup maxWidth={220}>
                  <p className="font-bold text-sm">{colors.emoji} Survey #{parcel.survey_number}</p>
                  <p className="text-xs text-slate-500">{parcel.village} · {parcel.area} Ha</p>
                  {lc && <p className="text-xs mt-1" style={{ color: colors.stroke }}>{lc}</p>}
                </Popup>
              </Marker>
            </React.Fragment>
          );
        })}
      </MapContainer>

      {/* Legend Overlay */}
      {legendTypes.length > 0 && legendTypes[0] !== 'Unknown' && (
        <div className="absolute bottom-8 right-2 z-[1000] bg-white/95 backdrop-blur rounded-xl shadow-lg border border-slate-200 p-3 max-w-[180px]">
          <p className="text-xs font-bold text-slate-700 mb-2 uppercase tracking-wider">Land Type</p>
          <div className="space-y-1.5">
            {Object.entries(LAND_COLORS).slice(0, 5).map(([key, val]) => (
              <div key={key} className="flex items-center gap-2">
                <div className="w-4 h-3 rounded flex-shrink-0 border" style={{ background: val.fill, borderColor: val.stroke }} />
                <span className="text-xs text-slate-600">{val.emoji} {val.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
