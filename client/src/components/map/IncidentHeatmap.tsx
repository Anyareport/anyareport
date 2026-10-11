import { useEffect } from 'react';
import type { ReactNode } from 'react';
import {
  CircleMarker,
  GeoJSON,
  MapContainer,
  Popup,
  TileLayer,
  Tooltip,
  ZoomControl,
  useMap,
} from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.heat';
import L from 'leaflet';
import { incidentHeatGradient } from '../../theme/colorTokens';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import type { PathOptions } from 'leaflet';
import barangayData from '../../data/DMM.json';
import { getIncidentSeverityColor } from '../../lib/incidentUtils';

export interface HeatmapPoint {
  id: string;
  lat: number;
  lng: number;
  category?: string;
  status?: string;
  severity?: string | null;
}

export type HeatmapMode = 'dots' | 'gradient' | 'choropleth';

interface IncidentHeatmapProps {
  points: HeatmapPoint[];
  height?: number | string;
  mode?: HeatmapMode;
  onPointClick?: (point: HeatmapPoint) => void;
  selectedPointId?: string | null;
  renderPointPopup?: (point: HeatmapPoint) => ReactNode;
  purokCounts?: Map<string, number>;
  selectedPurok?: string;
  onPurokClick?: (name: string) => void;
}

function getChoroplethColor(count: number, maxCount: number): string {
  if (count === 0) return 'var(--shared-color-slate100)';
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
      return { color: 'var(--map-boundary)', weight: 2, fillOpacity: 0, dashArray: '6 4' };
    }

    const isSelected = name === selectedPurok;

    if (mode === 'choropleth') {
      const count = purokCounts.get(name) || 0;
      return {
        color: isSelected ? 'var(--brand-color-info)' : 'var(--shared-color-white)',
        weight: isSelected ? 2.5 : 1,
        fillOpacity: 0.7,
        fillColor: getChoroplethColor(count, maxCount),
      };
    }

    return {
      color: isSelected ? 'var(--brand-color-info)' : 'var(--map-area)',
      weight: isSelected ? 2.5 : 1,
      fillOpacity: isSelected ? 0.22 : 0.12,
      fillColor: 'var(--map-area)',
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

function IncidentDots({
  points,
  onPointClick,
  selectedPointId,
  renderPointPopup,
}: {
  points: HeatmapPoint[];
  onPointClick?: (point: HeatmapPoint) => void;
  selectedPointId?: string | null;
  renderPointPopup?: (point: HeatmapPoint) => ReactNode;
}) {
  return (
    <>
      {points
        .filter(({ lat, lng }) => Number.isFinite(lat) && Number.isFinite(lng))
        .map((point, index) => {
          const severityColor = getIncidentSeverityColor(point.severity);

          return (
            <CircleMarker
              key={`${point.lat}-${point.lng}-${index}`}
              center={[point.lat, point.lng]}
              radius={7}
              pathOptions={{
                color: severityColor,
                weight: 1.5,
                fillColor: severityColor,
                fillOpacity: 0.9,
                bubblingMouseEvents: false,
              }}
              eventHandlers={onPointClick ? { click: () => onPointClick(point) } : undefined}
            >
              <Tooltip>
                {point.category || 'Incident'}
                {point.status ? ` - ${point.status.replace(/_/g, ' ')}` : ''}
              </Tooltip>
              {point.id === selectedPointId && renderPointPopup && (
                <Popup
                  closeButton={false}
                  closeOnClick={false}
                  autoClose
                  className="incident-map-popup"
                >
                  {renderPointPopup(point)}
                </Popup>
              )}
            </CircleMarker>
          );
        })}
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
      gradient: incidentHeatGradient,
    });

    heatLayer.addTo(map);
    return () => {
      map.removeLayer(heatLayer);
    };
  }, [map, points]);

  return null;
}

function FitToBarangay() {
  const map = useMap();

  useEffect(() => {
    const bounds = L.geoJSON(barangayData as FeatureCollection).getBounds();
    if (bounds.isValid()) {
      map.fitBounds(bounds.pad(0.04), { animate: false });
    }
  }, [map]);

  return null;
}

export default function IncidentHeatmap({
  points,
  height = 460,
  mode = 'dots',
  onPointClick,
  selectedPointId,
  renderPointPopup,
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
    <div
      className="incident-heatmap"
      style={{ height, overflow: 'hidden', borderRadius: 8, position: 'relative' }}
    >
      <MapContainer
        center={center}
        zoom={15}
        scrollWheelZoom
        zoomControl={false}
        style={{ height: '100%', width: '100%' }}
      >
        <FitToBarangay />
        <ZoomControl position="bottomleft" />
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
        ) : mode === 'dots' ? (
          <IncidentDots
            points={points}
            onPointClick={onPointClick}
            selectedPointId={selectedPointId}
            renderPointPopup={renderPointPopup}
          />
        ) : null}
      </MapContainer>
    </div>
  );
}
