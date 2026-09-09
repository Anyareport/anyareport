import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, Col, Progress, Row, Segmented, Select, Space, Typography } from 'antd';
import IncidentHeatmap, {
  type HeatmapMode,
  type HeatmapPoint,
} from '../../components/IncidentHeatmap';
import { api, type Report } from '../../lib/api';
import type { FeatureCollection } from 'geojson';
import barangayData from '../../data/DMM.json';

const { Text } = Typography;

function isPointInRing(lat: number, lng: number, ring: number[][]) {
  let inside = false;

  for (let current = 0, previous = ring.length - 1; current < ring.length; previous = current++) {
    const [currentLng, currentLat] = ring[current];
    const [previousLng, previousLat] = ring[previous];
    const intersects =
      currentLat > lat !== previousLat > lat &&
      lng <
        ((previousLng - currentLng) * (lat - currentLat)) / (previousLat - currentLat) + currentLng;

    if (intersects) inside = !inside;
  }

  return inside;
}

function isPointInFeature(point: HeatmapPoint, feature: FeatureCollection['features'][number]) {
  const geometry = feature.geometry;
  if (geometry.type === 'Polygon') {
    return isPointInRing(point.lat, point.lng, geometry.coordinates[0] as number[][]);
  }

  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates.some((polygon) =>
      isPointInRing(point.lat, point.lng, polygon[0] as number[][])
    );
  }

  return false;
}

function getPurokNumber(name: string) {
  return Number(name.match(/purok\s*(\d+)/i)?.[1] || Number.MAX_SAFE_INTEGER);
}

export default function AdminHeatmapPage() {
  const [heatmapMode, setHeatmapMode] = useState<HeatmapMode>('dots');
  const [selectedPurok, setSelectedPurok] = useState<string>();
  const [selectedCategory, setSelectedCategory] = useState<string>();

  const { data: points = [] } = useQuery({
    queryKey: ['admin-heatmap-points'],
    queryFn: () => api.get<HeatmapPoint[]>('/api/reports/heatmap'),
    refetchInterval: 30000,
  });

  const { data: reports = [] } = useQuery({
    queryKey: ['admin-reports'],
    queryFn: () => api.get<Report[]>('/api/reports'),
    refetchInterval: 30000,
  });

  const purokFeatures = useMemo(() => {
    const data = barangayData as FeatureCollection;
    return data.features
      .filter((feature) => feature.properties?.name?.toLowerCase().startsWith('purok'))
      .sort((left, right) =>
        getPurokNumber(left.properties?.name || '') -
          getPurokNumber(right.properties?.name || '') ||
        (left.properties?.name || '').localeCompare(right.properties?.name || '', undefined, {
          numeric: true,
        }),
      );
  }, []);

  const filteredPoints = useMemo(() => {
    const selectedFeature = purokFeatures.find(
      (feature) => feature.properties?.name === selectedPurok,
    );

    return points.filter((point) => {
      const matchesCategory = !selectedCategory || point.category === selectedCategory;
      const matchesPurok = !selectedFeature || isPointInFeature(point, selectedFeature);
      return matchesCategory && matchesPurok;
    });
  }, [points, purokFeatures, selectedCategory, selectedPurok]);

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    filteredPoints.forEach((point) => {
      if (point.category) map.set(point.category, (map.get(point.category) || 0) + 1);
    });
    return Array.from(map.entries()).sort((left, right) => right[1] - left[1]);
  }, [filteredPoints]);

  const top = counts[0]?.[1] || 1;

  const purokCounts = useMemo(() => {
    return purokFeatures
      .map((feature) => {
        const name = feature.properties?.name || 'Unnamed purok';
        const count = points.filter((point) => isPointInFeature(point, feature)).length;
        return [name, count] as const;
      })
      .sort(
        (left, right) =>
          getPurokNumber(left[0]) - getPurokNumber(right[0]) ||
          left[0].localeCompare(right[0], undefined, { numeric: true })
      );
  }, [points, purokFeatures]);

  const categoryOptions = useMemo(
    () => Array.from(new Set(reports.map((report) => report.category))).sort(),
    [reports],
  );

  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} xl={16}>
        
        <Card className="soft-card" title="Incident map">
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <Space wrap>
              <Select
                allowClear
                placeholder="Filter by purok"
                value={selectedPurok}
                onChange={setSelectedPurok}
                options={purokFeatures.map((feature) => ({
                  label: feature.properties?.name,
                  value: feature.properties?.name,
                }))}
                style={{ minWidth: 180 }}
              />
              <Select
                allowClear
                placeholder="Filter by category"
                value={selectedCategory}
                onChange={setSelectedCategory}
                options={categoryOptions.map((category) => ({
                  label: category,
                  value: category,
                }))}
                style={{ minWidth: 220 }}
              />
              <Segmented
                value={heatmapMode}
                onChange={(value) => setHeatmapMode(value as HeatmapMode)}
                options={[
                  { label: 'Dots', value: 'dots' },
                  { label: 'Gradient', value: 'gradient' },
                ]}
              />
            </Space>
            <IncidentHeatmap points={filteredPoints} height={500} mode={heatmapMode} />
          </Space>
        </Card>
      </Col>
      <Col xs={24} xl={8}>
        <Card className="soft-card" title="Purok incidents" style={{ marginBottom: 16 }}>
          <Space direction="vertical" size={8} style={{ width: '100%' }}>
            {purokCounts.map(([name, count]) => (
              <Space key={name} style={{ justifyContent: 'space-between', width: '100%' }}>
                <Text>{name}</Text>
                <Text strong>{count}</Text>
              </Space>
            ))}
          </Space>
        </Card>
        <Card className="soft-card" title="Category concentration">
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            {counts.map(([category, count]) => (
              <Card key={category} size="small">
                <Space direction="vertical" size={8} style={{ width: '100%' }}>
                  <Text strong>{category}</Text>
                  <Progress percent={Math.round((count / top) * 100)} strokeColor="#E63333" />
                  <Text type="secondary">{count} reports</Text>
                </Space>
              </Card>
            ))}
          </Space>
        </Card>
      </Col>
    </Row>
  );
}
