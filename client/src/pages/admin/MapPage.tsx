import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, Col, Row, Space, Typography } from 'antd';
import { api, type Report } from '../../lib/api';
import { StaticMap } from '../../components/MapPicker';
import StatusTag from '../../components/StatusTag';

const { Title, Paragraph, Text } = Typography;

export default function AdminMapPage() {
  const { data: reports = [] } = useQuery({
    queryKey: ['admin-map-reports'],
    queryFn: () => api.get<Report[]>('/api/reports'),
    refetchInterval: 30000,
  });
  const [selectedId, setSelectedId] = useState<string | null>(reports[0]?._id || null);

  const selected = useMemo(
    () => reports.find((report) => report._id === selectedId) || reports[0],
    [reports, selectedId],
  );
  const [lng, lat] = selected?.location?.coordinates || [121.3708, 16.4833];

  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} xl={16}>
        <Card className="soft-card page-hero" style={{ marginBottom: 16 }}>
          <Title level={2} style={{ color: '#fff', marginTop: 0 }}>Map view</Title>
          <Paragraph style={{ color: 'rgba(255,255,255,0.82)' }}>
            Geographic overview of report locations with responsive single-column fallback on smaller screens.
          </Paragraph>
        </Card>
        <Card className="soft-card" title="Incident map">
          <StaticMap latitude={lat} longitude={lng} height={500} />
        </Card>
      </Col>
      <Col xs={24} xl={8}>
        <Card className="soft-card" title="Recent incidents">
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            {reports.slice(0, 8).map((report) => (
              <Card key={report._id} size="small" onClick={() => setSelectedId(report._id)} hoverable>
                <Space direction="vertical" size={4} style={{ width: '100%' }}>
                  <StatusTag status={report.status} />
                  <Text strong>{report.category}</Text>
                  <Text type="secondary">{report.location?.address || 'No address'}</Text>
                </Space>
              </Card>
            ))}
          </Space>
        </Card>
      </Col>
    </Row>
  );
}