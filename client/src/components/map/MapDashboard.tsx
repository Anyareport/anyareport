import { useEffect } from 'react';
import {
  CircleMarker,
  GeoJSON,
  MapContainer,
  TileLayer,
  Tooltip,
  useMap,
  ZoomControl,
} from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.heat';
import L from 'leaflet';
import type { FeatureCollection } from 'geojson';
import barangayData from '../../data/DMM.json';

export interface IncidentMarker {
  id: string;
  lat: number;
  lng: number;
  category?: string;
  status?: string;
}

export type HeatmapMode = 'dots' | 'gradient' | 'choropleth';

interface MapDashboardProps {
  points: IncidentMarker[];
  height?: string | number;
  mode?: HeatmapMode;
  onPointClick?: (point: IncidentMarker) => void;
  purokCounts?: Map<string, number>;
  selectedPurok?: string;
  onPurokClick?: (name: string) => void;
  showBoundaries?: boolean;
}

function IncidentDots({
  points,
  onPointClick,
}: {
  points: IncidentMarker[];
  onPointClick?: (point: IncidentMarker) => void;
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

function GradientLayer({ points }: { points: IncidentMarker[] }) {
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

export default function MapDashboard({
  points,
  height = '100vh',
  mode = 'dots',
  onPointClick,
  purokCounts = new Map(),
  selectedPurok,
  showBoundaries = true,
}: MapDashboardProps) {
  const center: [number, number] = [16.482, 121.1557];
  //   const maxCount = Math.max(...Array.from(purokCounts.values()), 1);

  const geoJsonKey = `${mode}-${selectedPurok || ''}-${Array.from(purokCounts.entries())
    .map(([name, count]) => `${name}:${count}`)
    .join(',')}`;

  return (
    <div style={{ height, overflow: 'hidden', position: 'relative' }}>
      <MapContainer
        center={center}
        zoom={18}
        scrollWheelZoom
        style={{ height: '100%', width: '100%' }}
        zoomControl={false}
      >
        <ZoomControl position="bottomright" />
        {showBoundaries && <GeoJSON key={geoJsonKey} data={barangayData as FeatureCollection} />}
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
    </div>
  );
}
