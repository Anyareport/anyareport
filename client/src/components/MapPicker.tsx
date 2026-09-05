import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const defaultCenter: [number, number] = [16.4833, 121.3708];

const markerIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

interface MapPickerProps {
  latitude?: number;
  longitude?: number;
  onChange: (lat: number, lng: number) => void;
  height?: number;
  readOnly?: boolean;
}

function ClickHandler({ onChange, readOnly }: { onChange: (lat: number, lng: number) => void; readOnly?: boolean }) {
  useMapEvents({
    click(e) {
      if (!readOnly) onChange(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export default function MapPicker({
  latitude,
  longitude,
  onChange,
  height = 300,
  readOnly = false,
}: MapPickerProps) {
  const [pos, setPos] = useState<[number, number]>(
    latitude && longitude ? [latitude, longitude] : defaultCenter
  );

  useEffect(() => {
    if (latitude && longitude) setPos([latitude, longitude]);
  }, [latitude, longitude]);

  useEffect(() => {
    if (!readOnly && !latitude && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (p) => {
          const lat = p.coords.latitude;
          const lng = p.coords.longitude;
          setPos([lat, lng]);
          onChange(lat, lng);
        },
        () => {}
      );
    }
  }, [readOnly, latitude, onChange]);

  const handleChange = (lat: number, lng: number) => {
    setPos([lat, lng]);
    onChange(lat, lng);
  };

  return (
    <MapContainer center={pos} zoom={15} style={{ height, width: '100%', borderRadius: 8 }} scrollWheelZoom>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Marker position={pos} icon={markerIcon} />
      <ClickHandler onChange={handleChange} readOnly={readOnly} />
    </MapContainer>
  );
}

interface RouteMapProps {
  incidentLat: number;
  incidentLng: number;
  height?: number;
}

export function RouteMap({ incidentLat, incidentLng, height = 350 }: RouteMapProps) {
  const [responderPos, setResponderPos] = useState<[number, number] | null>(null);
  const incidentPos: [number, number] = [incidentLat, incidentLng];

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.watchPosition(
        (p) => setResponderPos([p.coords.latitude, p.coords.longitude]),
        () => setResponderPos(incidentPos)
      );
    }
  }, [incidentLat, incidentLng]);

  const center = responderPos || incidentPos;
  const route: [number, number][] = responderPos ? [responderPos, incidentPos] : [incidentPos];

  return (
    <MapContainer center={center} zoom={14} style={{ height, width: '100%', borderRadius: 8 }} scrollWheelZoom>
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <Marker position={incidentPos} icon={markerIcon} />
      {responderPos && <Marker position={responderPos} icon={markerIcon} />}
      {responderPos && <Polyline positions={route} color="#E63333" weight={4} dashArray="8 8" />}
    </MapContainer>
  );
}

interface StaticMapProps {
  latitude: number;
  longitude: number;
  height?: number;
}

export function StaticMap({ latitude, longitude, height = 250 }: StaticMapProps) {
  return (
    <MapContainer center={[latitude, longitude]} zoom={15} style={{ height, width: '100%', borderRadius: 8 }} scrollWheelZoom={false}>
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <Marker position={[latitude, longitude]} icon={markerIcon} />
    </MapContainer>
  );
}
