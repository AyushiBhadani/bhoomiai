'use client';

/**
 * MapView – uses React-Leaflet + OpenStreetMap tiles.
 * Completely free, no API key required.
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

// Generate a stable polygon around a parcel's lat/lng
function makePolygon(lat: number, lng: number, size = 0.003): LatLngTuple[] {
  return [
    [lat + size, lng - size],
    [lat + size, lng + size],
    [lat - size, lng + size],
    [lat - size, lng - size],
  ];
}

// Spread demo parcels across Agra region
const DEMO_COORDS: Record<string, [number, number]> = {
  '124/7': [27.1767, 78.0081],
  '45A':   [27.1902, 78.0241],
  '99/3B': [27.1630, 77.9980],
  '200/1': [27.1840, 78.0350],
  '312':   [27.1700, 78.0180],
};

function getCoords(p: Parcel): [number, number] {
  if (p.geometry_geojson?.coordinates) {
    const c = p.geometry_geojson.coordinates;
    if (Array.isArray(c) && c.length === 2) return [c[1] as number, c[0] as number];
  }
  return DEMO_COORDS[p.survey_number] ?? [27.1767 + Math.random() * 0.02, 78.0081 + Math.random() * 0.02];
}

// Auto-fit map bounds to show all parcels
function FitBounds({ coords }: { coords: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (coords.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const L = require('leaflet');
      map.fitBounds(L.latLngBounds(coords), { padding: [40, 40] });
    }
  }, [map, coords]);
  return null;
}

export default function MapView({ parcels, highlightSurvey, onSelect }: MapViewProps) {
  useEffect(() => { fixLeafletIcons(); }, []);

  const center: LatLngTuple = [27.1767, 78.0081];
  const coords = parcels.map(getCoords);

  return (
    <MapContainer
      center={center}
      zoom={13}
      style={{ width: '100%', height: '100%' }}
      className="z-0"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {coords.length > 0 && <FitBounds coords={coords} />}

      {parcels.map((parcel, i) => {
        const [lat, lng] = coords[i];
        const isHighlighted = parcel.survey_number === highlightSurvey;
        const polygon = makePolygon(lat, lng);

        return (
          <React.Fragment key={parcel.id ?? parcel.survey_number}>
            {/* Shaded polygon for the parcel boundary */}
            <Polygon
              positions={polygon}
              pathOptions={{
                color: isHighlighted ? '#f59e0b' : '#10b981',
                fillColor: isHighlighted ? '#fde68a' : '#d1fae5',
                fillOpacity: 0.45,
                weight: isHighlighted ? 3 : 2,
              }}
              eventHandlers={{
                click: () => onSelect?.(parcel),
              }}
            >
              <Popup>
                <div className="text-sm">
                  <p className="font-bold text-slate-800">Survey #{parcel.survey_number}</p>
                  <p className="text-slate-500">{parcel.village}</p>
                  <p className="text-slate-600 mt-1">Area: <strong>{parcel.area} Ha</strong></p>
                </div>
              </Popup>
            </Polygon>

            {/* Centre marker */}
            <Marker
              position={[lat, lng]}
              eventHandlers={{ click: () => onSelect?.(parcel) }}
            >
              <Popup>
                <div className="text-sm">
                  <p className="font-bold text-slate-800">Survey #{parcel.survey_number}</p>
                  <p className="text-slate-500">{parcel.village}</p>
                  <p className="text-slate-600 mt-1">Area: <strong>{parcel.area} Ha</strong></p>
                </div>
              </Popup>
            </Marker>
          </React.Fragment>
        );
      })}
    </MapContainer>
  );
}
