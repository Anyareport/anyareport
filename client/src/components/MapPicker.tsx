import { useEffect, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  useMapEvents,
  useMap,
  Polyline,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { GeoJSON } from "react-leaflet";
import type { Feature, Geometry, FeatureCollection } from "geojson";
import type { Layer, PathOptions } from "leaflet";
import barangayData from "../data/DMM.json";

const defaultCenter: [number, number] = [16.482, 121.1557];

const markerIcon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

function getBarangayStyle(feature?: Feature<Geometry, any>): PathOptions {
  const name = feature?.properties?.name?.toLowerCase() || "";
  const isBoundary = name.includes("don mariano marcos");

  return isBoundary
    ? { color: "#eab308", weight: 3, fillOpacity: 0 }
    : { color: "#ec4899", weight: 2, fillOpacity: 0.12, fillColor: "#ec4899" };
}

function onEachBarangayFeature(feature: Feature<Geometry, any>, layer: Layer) {
  const name = feature.properties?.name;
  if (!name) return;

  const isBoundary = name.toLowerCase().includes("don mariano marcos");

  layer.bindTooltip(name, {
    permanent: false,
    direction: "center",
    className: isBoundary ? "barangay-label" : "purok-label",
    sticky: true,
  });

  layer.on("mouseover", () => {
    (layer as L.Path).setStyle({
      weight: 3,
      fillOpacity: 0.35,
    });
  });

  layer.on("mouseout", () => {
    (layer as L.Path).setStyle(
      isBoundary
        ? { weight: 3, fillOpacity: 0 }
        : { weight: 2, fillOpacity: 0.12 },
    );
  });
}
function isPointInPolygon(
  point: [number, number],
  polygon: number[][],
): boolean {
  const [lat, lng] = point;
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [lngI, latI] = polygon[i];
    const [lngJ, latJ] = polygon[j];

    const intersects =
      latI > lat !== latJ > lat &&
      lng < ((lngJ - lngI) * (lat - latI)) / (latJ - latI) + lngI;

    if (intersects) inside = !inside;
  }

  return inside;
}

function isInsideBarangayBoundary(
  point: [number, number],
  data: FeatureCollection,
): boolean {
  for (const feature of data.features) {
    const name = feature.properties?.name?.toLowerCase() || "";
    if (!name.includes("don mariano marcos")) continue;

    const geometry = feature.geometry;

    if (geometry.type === "Polygon") {
      if (isPointInPolygon(point, geometry.coordinates[0])) return true;
    } else if (geometry.type === "MultiPolygon") {
      for (const polygon of geometry.coordinates) {
        if (isPointInPolygon(point, polygon[0])) return true;
      }
    }
  }

  return false;
}

function MapResizeHandler() {
  const map = useMap();

  useEffect(() => {
    const container = map.getContainer();
    const observer = new ResizeObserver(() => {
      map.invalidateSize();
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [map]);

  return null;
}
function RecenterMap({ position }: { position: [number, number] }) {
  const map = useMap();

  useEffect(() => {
    map.setView(position, map.getZoom());
  }, [position, map]);

  return null;
}

interface MapPickerProps {
  latitude?: number;
  longitude?: number;
  onChange: (lat: number, lng: number) => void;
  height?: number;
  readOnly?: boolean;
}

function ClickHandler({
  onChange,
  readOnly,
}: {
  onChange: (lat: number, lng: number) => void;
  readOnly?: boolean;
}) {
  useMapEvents({
    click(e) {
      if (readOnly) return;

      const point: [number, number] = [e.latlng.lat, e.latlng.lng];
      const isInside = isInsideBarangayBoundary(
        point,
        barangayData as FeatureCollection,
      );

      if (!isInside) {
        alert("Please select a location within the barangay boundary.");
        return;
      }

      onChange(e.latlng.lat, e.latlng.lng);
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
    latitude && longitude ? [latitude, longitude] : defaultCenter,
  );
  const [isOutsideBoundary, setIsOutsideBoundary] = useState(false);

  useEffect(() => {
    if (latitude && longitude) setPos([latitude, longitude]);
  }, [latitude, longitude]);

  useEffect(() => {
    const inside = isInsideBarangayBoundary(
      pos,
      barangayData as FeatureCollection,
    );
    setIsOutsideBoundary(!inside);
  }, [pos]);

  useEffect(() => {
  if (!readOnly && !latitude && navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const lat = p.coords.latitude;
        const lng = p.coords.longitude;
        const point: [number, number] = [lat, lng];

        const isInside = isInsideBarangayBoundary(
          point,
          barangayData as FeatureCollection,
        );

        if (isInside) {
          setPos(point);
          onChange(lat, lng);
        }
        // If outside, do nothing — keep defaultCenter, no marker placed there
      },
      () => {},
    );
  }
}, [readOnly, latitude, onChange]);

  const handleChange = (lat: number, lng: number) => {
    setPos([lat, lng]);
    onChange(lat, lng);
  };

  return (
    <div style={{ position: "relative" }}>
      {isOutsideBoundary && (
        <div
          style={{
            position: "absolute",
            top: 8,
            left: 8,
            zIndex: 1000,
            background: "#fef3c7",
            color: "#92400e",
            padding: "6px 12px",
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 600,
            boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
          }}
        >
          ⚠️ User location is outside the barangay boundary
        </div>
      )}
      <MapContainer
        center={pos}
        zoom={15}
        style={{ height, width: "100%", borderRadius: 8 }}
        scrollWheelZoom
      >
        <MapResizeHandler />
        <RecenterMap position={pos} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <GeoJSON
          data={barangayData as FeatureCollection}
          style={getBarangayStyle}
          onEachFeature={onEachBarangayFeature}
        />
        <Marker position={pos} icon={markerIcon} />
        <ClickHandler onChange={handleChange} readOnly={readOnly} />
      </MapContainer>
    </div>
  );
}

interface RouteMapProps {
  incidentLat: number;
  incidentLng: number;
  height?: number;
}

export function RouteMap({
  incidentLat,
  incidentLng,
  height = 350,
}: RouteMapProps) {
  const [responderPos, setResponderPos] = useState<[number, number] | null>(
    null,
  );
  const [routeCoords, setRouteCoords] = useState<[number, number][] | null>(
    null,
  );
  const incidentPos: [number, number] = [incidentLat, incidentLng];

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.watchPosition(
        (p) => setResponderPos([p.coords.latitude, p.coords.longitude]),
        () => setResponderPos(incidentPos),
      );
    }
  }, [incidentLat, incidentLng]);

  useEffect(() => {
    if (!responderPos) return;

    const [rLat, rLng] = responderPos;
    const url = `https://router.project-osrm.org/route/v1/driving/${rLng},${rLat};${incidentLng},${incidentLat}?overview=full&geometries=geojson`;

    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        if (data.routes && data.routes.length > 0) {
          const coords: [number, number][] =
            data.routes[0].geometry.coordinates.map(
              ([lng, lat]: [number, number]) => [lat, lng],
            );
          setRouteCoords(coords);
        }
      })
      .catch(() => {
        setRouteCoords([responderPos, incidentPos]);
      });
  }, [responderPos, incidentLat, incidentLng]);

  const center = responderPos || incidentPos;

  return (
    <MapContainer
      center={center}
      zoom={14}
      style={{ height, width: "100%", borderRadius: 8 }}
      scrollWheelZoom
    >
      <MapResizeHandler />
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <Marker position={incidentPos} icon={markerIcon} />
      {responderPos && <Marker position={responderPos} icon={markerIcon} />}
      {routeCoords && (
        <Polyline
          positions={routeCoords}
          color="#E63333"
          weight={4}
          dashArray="8 8"
        />
      )}
    </MapContainer>
  );
}

interface StaticMapProps {
  latitude: number;
  longitude: number;
  height?: number;
  showBoundaries?: boolean; // toggle the barangay/purok overlay on or off
}

export function StaticMap({
  latitude,
  longitude,
  height = 250,
  showBoundaries = true,
}: StaticMapProps) {
  return (
    <MapContainer
      center={[latitude, longitude]}
      zoom={15}
      style={{ height, width: "100%", borderRadius: 8 }}
      scrollWheelZoom={false}
    >
      <MapResizeHandler />
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      {showBoundaries && (
        <GeoJSON
          data={barangayData as FeatureCollection}
          style={getBarangayStyle}
          onEachFeature={onEachBarangayFeature}
        />
      )}
      <Marker position={[latitude, longitude]} icon={markerIcon} />
    </MapContainer>
  );
}
// interface BarangayMapProps {
//   center?: [number, number];
//   zoom?: number;
//   height?: number;
// }

// export function BarangayMap({
//   center = [16.482, 121.1557],
//   zoom = 16,
//   height = 500,
// }: BarangayMapProps) {
//   return (
//     <MapContainer
//       center={center}
//       zoom={zoom}
//       style={{ height, width: "100%", borderRadius: 8 }}
//       scrollWheelZoom
//     >
//       <MapResizeHandler />
//       <TileLayer
//         attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
//         url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
//       />
//       <GeoJSON
//         data={barangayData as FeatureCollection}
//         style={getBarangayStyle}
//         onEachFeature={onEachBarangayFeature}
//       />
//     </MapContainer>
//   );
// }
