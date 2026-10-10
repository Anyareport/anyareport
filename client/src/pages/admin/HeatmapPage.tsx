import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Col, Progress, Row, Segmented, Select, Space, Typography } from 'antd';
import IncidentHeatmap, {
  type HeatmapMode,
  type HeatmapPoint,
} from '../../components/map/IncidentHeatmap';
import MapReportCard from '../../components/map/MapReportCard';
import '../../components/map/MapReportCard.css';
import { api, type Report } from '../../lib/api';
import type { FeatureCollection } from 'geojson';
import barangayData from '../../data/DMM.json';

const { Text } = Typography;
const severityLevels = ['Critical', 'High', 'Medium', 'Low'] as const;
const knownSeverityLevels = new Set<string>(severityLevels);

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
  const navigate = useNavigate();
  const [heatmapMode, setHeatmapMode] = useState<HeatmapMode>('dots');
  const [selectedPurok, setSelectedPurok] = useState<string>();
  const [selectedCategory, setSelectedCategory] = useState<string>();
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);

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
      .sort(
        (left, right) =>
          getPurokNumber(left.properties?.name || '') -
            getPurokNumber(right.properties?.name || '') ||
          (left.properties?.name || '').localeCompare(right.properties?.name || '', undefined, {
            numeric: true,
          })
      );
  }, []);

  const selectedFeature = useMemo(
    () => purokFeatures.find((feature) => feature.properties?.name === selectedPurok),
    [purokFeatures, selectedPurok]
  );

  const categoryFilteredPoints = useMemo(
    () => points.filter((point) => !selectedCategory || point.category === selectedCategory),
    [points, selectedCategory]
  );

  const filteredPoints = useMemo(() => {
    return categoryFilteredPoints.filter((point) => {
      const matchesPurok = !selectedFeature || isPointInFeature(point, selectedFeature);
      return matchesPurok;
    });
  }, [categoryFilteredPoints, selectedFeature]);

  const categoryPanelPoints = useMemo(() => {
    if (!selectedFeature) return points;
    return points.filter((point) => isPointInFeature(point, selectedFeature));
  }, [points, selectedFeature]);

  const selectedPurokPoints = useMemo(() => {
    if (!selectedFeature) return [];
    return categoryFilteredPoints.filter((point) => isPointInFeature(point, selectedFeature));
  }, [categoryFilteredPoints, selectedFeature]);

  const categoryCounts = useMemo(() => {
    const map = new Map<string, number>();
    categoryPanelPoints.forEach((point) => {
      if (point.category) map.set(point.category, (map.get(point.category) || 0) + 1);
    });
    return Array.from(map.entries()).sort((left, right) => right[1] - left[1]);
  }, [categoryPanelPoints]);

  const categoryTotal = categoryPanelPoints.length;
  const topCategory = categoryCounts[0]?.[0];

  const severityCounts = useMemo(() => {
    const counts: Array<{ severity: string; count: number }> = severityLevels.map((severity) => ({
      severity,
      count: selectedPurokPoints.filter((point) => point.severity === severity).length,
    }));
    counts.push({
      severity: 'Unspecified',
      count: selectedPurokPoints.filter(
        (point) => !point.severity || !knownSeverityLevels.has(point.severity)
      ).length,
    });
    return counts;
  }, [selectedPurokPoints]);

  useEffect(() => {
    if (selectedPointId && !filteredPoints.some((point) => point.id === selectedPointId)) {
      setSelectedPointId(null);
    }
  }, [filteredPoints, selectedPointId]);

  const purokCounts = useMemo(() => {
    return purokFeatures
      .map((feature) => {
        const name = feature.properties?.name || 'Unnamed purok';
        const count = categoryFilteredPoints.filter((point) =>
          isPointInFeature(point, feature)
        ).length;
        return [name, count] as const;
      })
      .sort(
        (left, right) =>
          getPurokNumber(left[0]) - getPurokNumber(right[0]) ||
          left[0].localeCompare(right[0], undefined, { numeric: true })
      );
  }, [categoryFilteredPoints, purokFeatures]);

  const selectedReport = reports.find((report) => report._id === selectedPointId);

  const categoryOptions = useMemo(
    () => Array.from(new Set(reports.map((report) => report.category))).sort(),
    [reports]
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
                onChange={(value) => {
                  setSelectedPurok(value);
                  setSelectedPointId(null);
                }}
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
                onChange={(value) => {
                  setSelectedCategory(value);
                  setSelectedPointId(null);
                }}
                options={categoryOptions.map((category) => ({
                  label: category,
                  value: category,
                }))}
                style={{ minWidth: 220 }}
              />
              <Segmented
                value={heatmapMode}
                onChange={(value) => {
                  setHeatmapMode(value as HeatmapMode);
                  setSelectedPointId(null);
                }}
                options={[
                  { label: 'Dots', value: 'dots' },
                  { label: 'Gradient', value: 'gradient' },
                  { label: 'Choropleth', value: 'choropleth' },
                ]}
              />
            </Space>
            <IncidentHeatmap
              points={filteredPoints}
              height={500}
              mode={heatmapMode}
              onPointClick={(point) => setSelectedPointId(point.id)}
              selectedPointId={selectedPointId}
              renderPointPopup={(point) => {
                if (!selectedReport || selectedReport._id !== point.id) return null;
                return (
                  <MapReportCard
                    report={selectedReport}
                    showPhoto={false}
                    onViewDetails={() => navigate(`/admin/incidents/${selectedReport._id}`)}
                    onDismiss={() => setSelectedPointId(null)}
                  />
                );
              }}
              purokCounts={new Map(purokCounts)}
              selectedPurok={selectedPurok}
              onPurokClick={(name) => {
                setSelectedPurok(name);
                setSelectedPointId(null);
              }}
            />
          </Space>
        </Card>
      </Col>
      <Col xs={24} xl={8}>
        {selectedPurok && (
          <Card
            className="soft-card"
            title={`${selectedPurok} summary`}
            style={{ marginBottom: 16 }}
          >
            <Space direction="vertical" size={8} style={{ width: '100%' }}>
              <Text>{selectedPurokPoints.length} reports</Text>
              <Text>
                Top category: <strong>{topCategory || 'None'}</strong>
              </Text>
              <Text strong>Severity breakdown</Text>
              <Space wrap>
                {severityCounts.map(({ severity, count }) => (
                  <Text key={severity} type="secondary">
                    {severity}: {count}
                  </Text>
                ))}
              </Space>
              {selectedCategory && <Text type="secondary">Filtered by {selectedCategory}</Text>}
            </Space>
          </Card>
        )}
        <Card className="soft-card" title="Purok incidents" style={{ marginBottom: 16 }}>
          <Space direction="vertical" size={4} style={{ width: '100%' }}>
            {purokCounts.map(([name, count]) => (
              <Button
                key={name}
                type={selectedPurok === name ? 'primary' : 'text'}
                block
                aria-pressed={selectedPurok === name}
                onClick={() => {
                  setSelectedPurok(selectedPurok === name ? undefined : name);
                  setSelectedPointId(null);
                }}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  textAlign: 'left',
                }}
              >
                <span>{name}</span>
                <Text strong type={selectedPurok === name ? undefined : 'secondary'}>
                  {count}
                </Text>
              </Button>
            ))}
          </Space>
        </Card>
        <Card className="soft-card" title="Category concentration">
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            {categoryCounts.map(([category, count]) => (
              <Card key={category} size="small">
                <Space direction="vertical" size={8} style={{ width: '100%' }}>
                  <Text strong>{category}</Text>
                  <Progress
                    percent={categoryTotal ? Math.round((count / categoryTotal) * 100) : 0}
                    status="normal"
                    strokeColor="var(--brand-primary)"
                  />
                  <Text type="secondary">
                    {count} of {categoryTotal} reports
                  </Text>
                </Space>
              </Card>
            ))}
            {selectedPurok && <Text type="secondary">Filtered by {selectedPurok}</Text>}
          </Space>
        </Card>
      </Col>
    </Row>
  );
}
