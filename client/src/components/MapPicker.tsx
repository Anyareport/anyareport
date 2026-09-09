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

export function isInsideBarangayBoundary(
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

  const [locationStatus, setLocationStatus] = useState<"checking" | "inside" | "outside" | "unavailable">("checking");

  useEffect(() => {
    if (latitude && longitude) setPos([latitude, longitude]);
  }, [latitude, longitude]);

  useEffect(() => {
    if (readOnly) {
      setLocationStatus("inside");
      return;
    }

    if (!navigator.geolocation) {
      setLocationStatus("unavailable");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (p) => {
        const point: [number, number] = [p.coords.latitude, p.coords.longitude];
        const inside = isInsideBarangayBoundary(
          point,
          barangayData as FeatureCollection,
        );

        setLocationStatus(inside ? "inside" : "outside");

        if (inside && !latitude) {
          setPos(point);
          onChange(point[0], point[1]);
        }
      },
      () => setLocationStatus("unavailable"),
    );
  }, [readOnly]);

  const handleChange = (lat: number, lng: number) => {
    setPos([lat, lng]);
    onChange(lat, lng);
  };

  const isPickingDisabled =
    readOnly || locationStatus === "outside" || locationStatus === "checking";

  return (
    <div style={{ position: "relative" }}>
      {locationStatus === "outside" && (
        <div
          style={{
            position: "absolute",
            top: 8,
            left: 8,
            zIndex: 1000,
            background: "#fee2e2",
            color: "#991b1b",
            padding: "6px 12px",
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 600,
            boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
          }}
        >
          You must be inside the barangay to pick a location
        </div>
      )}

      {locationStatus === "unavailable" && (
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
          Location unavailable — tap the map to pin your location manually
        </div>
      )}

      {locationStatus === "checking" && (
        <div
          style={{
            position: "absolute",
            top: 8,
            left: 8,
            zIndex: 1000,
            background: "#f3f4f6",
            color: "#374151",
            padding: "6px 12px",
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          Checking your location…
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
        {locationStatus !== "outside" && locationStatus !== "checking" && (
          <Marker position={pos} icon={markerIcon} />
        )}
        <ClickHandler onChange={handleChange} readOnly={isPickingDisabled} />
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
