import {
  CircleMarker,
  GeoJSON,
  MapContainer,
  TileLayer,
  Tooltip,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import type { PathOptions } from "leaflet";
import barangayData from "../data/DMM.json";

export interface HeatmapPoint {
  lat: number;
  lng: number;
  category?: string;
  status?: string;
}

interface IncidentHeatmapProps {
  points: HeatmapPoint[];
  height?: number;
}

function getBoundaryStyle(feature?: Feature<Geometry, any>): PathOptions {
  const name = feature?.properties?.name?.toLowerCase() || "";
  const isBarangayBoundary = name.includes("don mariano marcos");

  return isBarangayBoundary
    ? { color: "#eab308", weight: 3, fillOpacity: 0 }
    : { color: "#ec4899", weight: 1, fillOpacity: 0.12, fillColor: "#ec4899" };
}

function IncidentDots({ points }: { points: HeatmapPoint[] }) {
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
              color: "#991b1b",
              weight: 1.5,
              fillColor: "#ef4444",
              fillOpacity: 0.85,
            }}
          >
            <Tooltip>
              {point.category || "Incident"}
              {point.status ? ` - ${point.status.replace(/_/g, " ")}` : ""}
            </Tooltip>
          </CircleMarker>
        ))}
    </>
  );
}

export default function IncidentHeatmap({
  points,
  height = 460,
}: IncidentHeatmapProps) {
  const center: [number, number] = [16.482, 121.1557];

  return (
    <div style={{ height, overflow: "hidden", borderRadius: 8 }}>
      <MapContainer
        center={center}
        zoom={15}
        scrollWheelZoom
        style={{ height: "100%", width: "100%" }}
      >
        <GeoJSON
          data={barangayData as FeatureCollection}
          style={getBoundaryStyle}
        />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <IncidentDots points={points} />
        
      </MapContainer>
    </div>
  );
}