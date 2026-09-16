'use client';

import React, { useState, useCallback } from 'react';
import { GoogleMap, useJsApiLoader, Polygon, Marker, InfoWindow } from '@react-google-maps/api';
import type { Parcel } from '@/lib/types';

export interface MapViewProps {
  parcels: Parcel[];
  highlightSurvey?: string;
  onSelect?: (parcel: Parcel) => void;
}

const CENTER = { lat: 27.1, lng: 78.0 };
const ZOOM = 13;

const containerStyle = {
  width: '100%',
  height: '100%'
};

function jitter(base: number, range = 0.005) {
  return base + (Math.random() - 0.5) * range;
}

export default function MapView({ parcels, highlightSurvey, onSelect }: MapViewProps) {
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''
  });

  const [activeParcel, setActiveParcel] = useState<Parcel | null>(null);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const onLoad = useCallback(function callback(map: google.maps.Map) {
    // Map is loaded
  }, []);

  const onUnmount = useCallback(function callback() {
    setActiveParcel(null);
  }, []);

  if (!isLoaded) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-slate-100">
        <div className="text-slate-500 font-medium text-sm animate-pulse">Loading Google Maps...</div>
      </div>
    );
  }

  // If the key is empty/invalid, show a helpful message instead of a broken map
  if (!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY === 'YOUR_KEY_HERE') {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-100 p-6 text-center">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 max-w-sm">
          <h3 className="text-lg font-bold text-slate-800 mb-2">Google Maps Key Required</h3>
          <p className="text-slate-500 text-sm mb-4">
            The map is ready, but it needs a Google Maps API key to render. 
            Please add your API key to <code className="bg-slate-100 px-1 py-0.5 rounded text-xs">.env.local</code> 
            as <code className="bg-slate-100 px-1 py-0.5 rounded text-xs text-emerald-600">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <GoogleMap
      mapContainerStyle={containerStyle}
      center={CENTER}
      zoom={ZOOM}
      onLoad={onLoad}
      onUnmount={onUnmount}
      options={{
        disableDefaultUI: false,
        zoomControl: true,
        mapTypeControl: true,
        streetViewControl: false,
      }}
    >
      {parcels.map((parcel) => {
        const highlighted = parcel.survey_number === highlightSurvey;
        
        const options = {
          fillColor: highlighted ? '#fef08a' : '#d1fae5',
          fillOpacity: highlighted ? 0.7 : 0.4,
          strokeColor: highlighted ? '#f59e0b' : '#10b981',
          strokeWeight: highlighted ? 3 : 2,
        };

        if (parcel.geometry_geojson) {
          // Parse GeoJSON to Google Maps LatLng
          try {
            const geojson = parcel.geometry_geojson as any;
            if (geojson.type === 'Polygon' && geojson.coordinates) {
              const paths = geojson.coordinates[0].map((coord: number[]) => ({
                lat: coord[1],
                lng: coord[0]
              }));
              
              return (
                <Polygon
                  key={`poly-${parcel.id}`}
                  paths={paths}
                  options={options}
                  onClick={() => {
                    setActiveParcel(parcel);
                    onSelect?.(parcel);
                  }}
                />
              );
            }
          } catch (e) {
            console.error("Failed to parse GeoJSON for parcel", parcel.id);
          }
        }

        // Fallback marker if no valid geometry
        const pos = { lat: jitter(CENTER.lat), lng: jitter(CENTER.lng) };
        return (
          <Marker
            key={`marker-${parcel.id}`}
            position={pos}
            onClick={() => {
              setActiveParcel(parcel);
              onSelect?.(parcel);
            }}
          />
        );
      })}

      {activeParcel && (
        <InfoWindow
          position={
            activeParcel.geometry_geojson 
            ? CENTER // Approximated center for info window if polygon
            : { lat: CENTER.lat, lng: CENTER.lng }
          }
          onCloseClick={() => setActiveParcel(null)}
        >
          <div className="p-1 min-w-[150px]">
            <strong className="block text-sm font-bold text-slate-800 mb-1">
              Survey #{activeParcel.survey_number}
            </strong>
            <p className="text-xs text-slate-600 mb-0.5">Village: {activeParcel.village}</p>
            <p className="text-xs text-slate-600">
              Area: {activeParcel.area?.toLocaleString()} m²
            </p>
          </div>
        </InfoWindow>
      )}
    </GoogleMap>
  );
}
