import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, Col, Progress, Row, Space, Typography } from 'antd';
import IncidentHeatmap, { type HeatmapPoint } from '../../components/IncidentHeatmap';
import { api, type Report } from '../../lib/api';
import type { FeatureCollection } from 'geojson';
import barangayData from '../../data/DMM.json';

const { Title, Paragraph, Text } = Typography;

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

export default function AdminHeatmapPage() {
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

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    reports.forEach((report) => map.set(report.category, (map.get(report.category) || 0) + 1));
    return Array.from(map.entries()).sort((left, right) => right[1] - left[1]);
  }, [reports]);

  const top = counts[0]?.[1] || 1;

  const purokCounts = useMemo(() => {
    const data = barangayData as FeatureCollection;
    const purokFeatures = data.features.filter((feature) =>
      feature.properties?.name?.toLowerCase().startsWith('purok')
    );

    return purokFeatures
      .map((feature) => {
        const name = feature.properties?.name || 'Unnamed purok';
        const count = points.filter((point) => isPointInFeature(point, feature)).length;
        return [name, count] as const;
      })
      .sort(
        (left, right) =>
          right[1] - left[1] || left[0].localeCompare(right[0], undefined, { numeric: true })
      );
  }, [points]);

  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} xl={16}>
        <Card className="soft-card page-hero" style={{ marginBottom: 16 }}>
          <Title level={2} style={{ color: '#fff', marginTop: 0 }}>
            Heatmap
          </Title>
          <Paragraph style={{ color: 'rgba(255,255,255,0.82)' }}>
            Category concentration visualized as a responsive intensity map.
          </Paragraph>
        </Card>
        <Card className="soft-card" title="Incident map">
          <IncidentHeatmap points={points} height={500} />
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
