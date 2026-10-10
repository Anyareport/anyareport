import { useEffect, useRef, type ReactNode } from 'react';
import {
  CircleMarker,
  GeoJSON,
  MapContainer,
  Popup,
  TileLayer,
  Tooltip,
  useMap,
  useMapEvents,
  ZoomControl,
} from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.heat';
import L from 'leaflet';
import type { FeatureCollection } from 'geojson';
import barangayData from '../../data/DMM.json';

const severityMarkerColors: Record<string, string> = {
  Critical: '#ef4444',
  High: '#f97316',
  Medium: '#eab308',
  Low: '#22c55e',
};

export interface IncidentMarker {
  id: string;
  lat: number;
  lng: number;
  category?: string;
  status?: string;
  severity?: string | null;
  title?: string;
}

export type HeatmapMode = 'dots' | 'gradient' | 'choropleth';

interface MapDashboardProps {
  points: IncidentMarker[];
  height?: string | number;
  mode?: HeatmapMode;
  onPointClick?: (point: IncidentMarker) => void;
  onMapClick?: () => void;
  selectedPointId?: string | null;
  showPointPopup?: boolean;
  renderPointPopup?: (point: IncidentMarker) => ReactNode;
  purokCounts?: Map<string, number>;
  selectedPurok?: string;
  onPurokClick?: (name: string) => void;
  showBoundaries?: boolean;
  isPickingLocation?: boolean;
  onLocationPick?: (position: [number, number]) => void;
  selectedLocation?: [number, number] | null;
}

function IncidentDots({
  points,
  onPointClick,
  selectedPointId,
  showPointPopup,
  renderPointPopup,
}: {
  points: IncidentMarker[];
  onPointClick?: (point: IncidentMarker) => void;
  selectedPointId?: string | null;
  showPointPopup?: boolean;
  renderPointPopup?: (point: IncidentMarker) => ReactNode;
}) {
  return (
    <>
      {points
        .filter(({ lat, lng }) => Number.isFinite(lat) && Number.isFinite(lng))
        .map((point, index) => {
          const isSelected = point.id === selectedPointId;

          return (
            <IncidentDot
              key={`${point.lat}-${point.lng}-${index}`}
              point={point}
              isSelected={isSelected}
              severityColor={severityMarkerColors[point.severity || ''] || '#ef4444'}
              onPointClick={onPointClick}
              showPopup={Boolean(showPointPopup && renderPointPopup)}
              renderPopup={renderPointPopup}
            />
          );
        })}
    </>
  );
}

function IncidentDot({
  point,
  isSelected,
  severityColor,
  onPointClick,
  showPopup,
  renderPopup,
}: {
  point: IncidentMarker;
  isSelected: boolean;
  severityColor: string;
  onPointClick?: (point: IncidentMarker) => void;
  showPopup: boolean;
  renderPopup?: (point: IncidentMarker) => ReactNode;
}) {
  const markerRef = useRef<L.CircleMarker | null>(null);
  const popupRef = useRef<L.Popup | null>(null);
  const map = useMap();

  useEffect(() => {
    if (!isSelected && popupRef.current && map.hasLayer(popupRef.current)) {
      map.closePopup(popupRef.current);
    }
  }, [isSelected, map]);

  useEffect(() => {
    const element = markerRef.current?.getElement();
    if (!element) return;

    element.setAttribute('tabindex', '0');
    element.setAttribute('role', 'button');
    element.setAttribute('aria-label', point.title || point.category || 'Incident');
    const handleKeyDown: EventListener = (event) => {
      if (!(event instanceof KeyboardEvent)) return;
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      onPointClick?.(point);
    };

    element.addEventListener('keydown', handleKeyDown);
    return () => element.removeEventListener('keydown', handleKeyDown);
  }, [onPointClick, point]);

  const label = point.title || point.category || 'Incident';

  return (
    <CircleMarker
      ref={markerRef}
      center={[point.lat, point.lng]}
      radius={isSelected ? 9 : 7}
      pathOptions={{
        color: isSelected ? '#2563eb' : severityColor,
        weight: isSelected ? 3 : 1.5,
        fillColor: severityColor,
        fillOpacity: 0.9,
        bubblingMouseEvents: false,
      }}
      eventHandlers={
        onPointClick
          ? {
              click: (event) => {
                L.DomEvent.stopPropagation(event.originalEvent);
                onPointClick(point);
              },
            }
          : undefined
      }
    >
      <Tooltip direction="top" offset={[0, -8]}>
        <span className="map-marker-tooltip">
          <span className="map-marker-tooltip__dot" style={{ backgroundColor: severityColor }} />
          {label}
        </span>
      </Tooltip>
      {showPopup && renderPopup && (
        <Popup
          ref={popupRef}
          closeButton={false}
          closeOnClick={false}
          autoClose
          className="incident-map-popup"
        >
          {isSelected ? renderPopup(point) : null}
        </Popup>
      )}
    </CircleMarker>
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

function LocationClickHandler({
  enabled,
  onPick,
  onMapClick,
}: {
  enabled: boolean;
  onPick?: (position: [number, number]) => void;
  onMapClick?: () => void;
}) {
  useMapEvents({
    click(event) {
      if (enabled) onPick?.([event.latlng.lat, event.latlng.lng]);
      else {
        const target = event.originalEvent.target;
        if (target instanceof Element && target.closest('.leaflet-interactive')) return;
        onMapClick?.();
      }
    },
  });
  return null;
}

export default function MapDashboard({
  points,
  height = '100vh',
  mode = 'dots',
  onPointClick,
  onMapClick,
  selectedPointId,
  showPointPopup,
  renderPointPopup,
  purokCounts = new Map(),
  selectedPurok,
  showBoundaries = true,
  isPickingLocation = false,
  onLocationPick,
  selectedLocation,
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
        <LocationClickHandler
          enabled={isPickingLocation}
          onPick={onLocationPick}
          onMapClick={onMapClick}
        />
        <ZoomControl position="bottomright" />
        {showBoundaries && <GeoJSON key={geoJsonKey} data={barangayData as FeatureCollection} />}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {mode === 'gradient' ? (
          <GradientLayer points={points} />
        ) : (
          <IncidentDots
            points={points}
            onPointClick={onPointClick}
            selectedPointId={selectedPointId}
            showPointPopup={showPointPopup}
            renderPointPopup={renderPointPopup}
          />
        )}
        {selectedLocation && (
          <CircleMarker
            center={selectedLocation}
            radius={11}
            pathOptions={{
              color: '#ffffff',
              weight: 3,
              fillColor: 'var(--brand-color-info)',
              fillOpacity: 1,
            }}
          >
            <Tooltip>Selected report location</Tooltip>
          </CircleMarker>
        )}
      </MapContainer>
    </div>
  );
}
