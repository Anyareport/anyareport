import { useEffect } from 'react';
import { CircleMarker, GeoJSON, MapContainer, TileLayer, Tooltip, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.heat';
import L from 'leaflet';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import type { PathOptions } from 'leaflet';
import barangayData from '../data/DMM.json';

export interface HeatmapPoint {
  id: string;
  lat: number;
  lng: number;
  category?: string;
  status?: string;
}

export type HeatmapMode = 'dots' | 'gradient' | 'choropleth';

interface IncidentHeatmapProps {
  points: HeatmapPoint[];
  height?: number;
  mode?: HeatmapMode;
  onPointClick?: (point: HeatmapPoint) => void;
  purokCounts?: Map<string, number>;
  selectedPurok?: string;
  onPurokClick?: (name: string) => void;
}

function getChoroplethColor(count: number, maxCount: number): string {
  if (count === 0) return '#f1f5f9';
  const intensity = Math.min(count / maxCount, 1);

  const start = { r: 216, g: 232, b: 248 };
  const end = { r: 52, g: 129, b: 245 };

  const r = Math.round(start.r + (end.r - start.r) * intensity);
  const g = Math.round(start.g + (end.g - start.g) * intensity);
  const b = Math.round(start.b + (end.b - start.b) * intensity);

  return `rgb(${r}, ${g}, ${b})`;
}

function createBoundaryStyle({
  mode,
  purokCounts,
  maxCount,
  selectedPurok,
}: {
  mode: HeatmapMode;
  purokCounts: Map<string, number>;
  maxCount: number;
  selectedPurok?: string;
}) {
  return (feature?: Feature<Geometry, any>): PathOptions => {
    const name: string = feature?.properties?.name || '';
    const isBarangayBoundary = name.toLowerCase().includes('don mariano marcos');

    if (isBarangayBoundary) {
      return { color: '#94a3b8', weight: 2, fillOpacity: 0, dashArray: '6 4' };
    }

    const isSelected = name === selectedPurok;

    if (mode === 'choropleth') {
      const count = purokCounts.get(name) || 0;
      return {
        color: isSelected ? '#1677ff' : '#ffffff',
        weight: isSelected ? 2.5 : 1,
        fillOpacity: 0.7,
        fillColor: getChoroplethColor(count, maxCount),
      };
    }

    return {
      color: isSelected ? '#1677ff' : '#79a8ee',
      weight: isSelected ? 2.5 : 1,
      fillOpacity: isSelected ? 0.22 : 0.12,
      fillColor: '#79a8ee',
    };
  };
}

function createOnEachFeature({
  purokCounts,
  onPurokClick,
}: {
  purokCounts: Map<string, number>;
  onPurokClick?: (name: string) => void;
}) {
  return (feature: Feature<Geometry, any>, layer: L.Layer) => {
    const name: string = feature?.properties?.name || '';
    if (!name.toLowerCase().startsWith('purok')) return;

    const count = purokCounts.get(name) || 0;
    layer.bindTooltip(`${name}: ${count} incident${count === 1 ? '' : 's'}`, {
      sticky: true,
    });

    if (onPurokClick) {
      layer.on('click', () => onPurokClick(name));
    }
  };
}

function ChoroplethLegend({ maxCount }: { maxCount: number }) {
  const steps = [0, 0.25, 0.5, 0.75, 1];
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 12,
        left: 12,
        zIndex: 1000,
        background: 'rgba(255,255,255,0.92)',
        borderRadius: 6,
        padding: '8px 10px',
        fontSize: 12,
        boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
      }}
    >
      <div style={{ marginBottom: 4, fontWeight: 600 }}>Incidents</div>
      <div style={{ display: 'flex', gap: 2 }}>
        {steps.map((step) => (
          <div
            key={step}
            style={{
              width: 20,
              height: 10,
              background: getChoroplethColor(Math.round(step * maxCount), maxCount),
            }}
          />
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
        <span>0</span>
        <span>{maxCount}</span>
      </div>
    </div>
  );
}

function IncidentDots({
  points,
  onPointClick,
}: {
  points: HeatmapPoint[];
  onPointClick?: (point: HeatmapPoint) => void;
}) {
  return (
    <>
      {points
        .filter(({ lat, lng }) => Number.isFinite(lat) && Number.isFinite(lng))
        .map((point, index) => (
          <CircleMarker
            key={`${point.lat}-${point.lng}-${index}`}
            center={[point.lat, point.lng]}
            radius={7}
            pathOptions={{
              color: '#991b1b',
              weight: 1.5,
              fillColor: '#ef4444',
              fillOpacity: 0.85,
            }}
            eventHandlers={onPointClick ? { click: () => onPointClick(point) } : undefined}
          >
            <Tooltip>
              {point.category || 'Incident'}
              {point.status ? ` - ${point.status.replace(/_/g, ' ')}` : ''}
            </Tooltip>
          </CircleMarker>
        ))}
    </>
  );
}

function GradientLayer({ points }: { points: HeatmapPoint[] }) {
  const map = useMap();

  useEffect(() => {
    const heatPoints: Array<[number, number, number]> = points
      .filter(({ lat, lng }) => Number.isFinite(lat) && Number.isFinite(lng))
      .map(({ lat, lng }) => [lat, lng, 1]);
    const heatLayer = L.heatLayer(heatPoints, {
      radius: 28,
      blur: 22,
      maxZoom: 17,
      max: 1,
      minOpacity: 0.35,
      gradient: {
        0.2: '#3b82f6',
        0.45: '#22c55e',
        0.7: '#facc15',
        0.9: '#ef4444',
      },
    });

    heatLayer.addTo(map);
    return () => {
      map.removeLayer(heatLayer);
    };
  }, [map, points]);

  return null;
}

export default function IncidentHeatmap({
  points,
  height = 460,
  mode = 'dots',
  onPointClick,
  purokCounts = new Map(),
  selectedPurok,
  onPurokClick,
}: IncidentHeatmapProps) {
  const center: [number, number] = [16.482, 121.1557];
  const maxCount = Math.max(...Array.from(purokCounts.values()), 1);

  const boundaryStyle = createBoundaryStyle({ mode, purokCounts, maxCount, selectedPurok });
  const onEachFeature = createOnEachFeature({ purokCounts, onPurokClick });

  const geoJsonKey = `${mode}-${selectedPurok || ''}-${Array.from(purokCounts.entries())
    .map(([name, count]) => `${name}:${count}`)
    .join(',')}`;

  return (
    <div style={{ height, overflow: 'hidden', borderRadius: 8, position: 'relative' }}>
      <MapContainer
        center={center}
        zoom={15}
        scrollWheelZoom
        style={{ height: '100%', width: '100%' }}
      >
        <GeoJSON
          key={geoJsonKey}
          data={barangayData as FeatureCollection}
          style={boundaryStyle}
          onEachFeature={onEachFeature}
        />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {mode === 'gradient' ? (
          <GradientLayer points={points} />
        ) : (
          <IncidentDots points={points} onPointClick={onPointClick} />
        )}
      </MapContainer>
      {mode === 'choropleth' && <ChoroplethLegend maxCount={maxCount} />}
    </div>
  );
}
