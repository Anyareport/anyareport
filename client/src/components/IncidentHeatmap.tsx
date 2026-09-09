import { useEffect } from "react";
import {
  CircleMarker,
  GeoJSON,
  MapContainer,
  TileLayer,
  Tooltip,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.heat";
import L from "leaflet";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import type { PathOptions } from "leaflet";
import barangayData from "../data/DMM.json";

export interface HeatmapPoint {
  lat: number;
  lng: number;
  category?: string;
  status?: string;
}

export type HeatmapMode = "dots" | "gradient";

interface IncidentHeatmapProps {
  points: HeatmapPoint[];
  height?: number;
  mode?: HeatmapMode;
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
        0.2: "#3b82f6",
        0.45: "#22c55e",
        0.7: "#facc15",
        0.9: "#ef4444",
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
  mode = "dots",
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
        {mode === "gradient" ? (
          <GradientLayer points={points} />
        ) : (
          <IncidentDots points={points} />
        )}
        
      </MapContainer>
    </div>
  );
}