import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, Col, Row, Space, Typography } from 'antd';
import { api, type Report } from '../../lib/api';
import { RouteMap } from '../../components/MapPicker';
import { compareIncidentPriority } from '../../lib/sortUtils';
import PageHero from '../../components/PageHero';

const { Text } = Typography;

export default function ResponderRoutingPage() {
  const { data: reports = [] } = useQuery({
    queryKey: ['responder-routing'],
    queryFn: () => api.get<Report[]>('/api/reports'),
    refetchInterval: 30000,
  });

  const sortedReports = useMemo(
    () =>
      reports
        .filter((report) => ['en_route', 'on_scene'].includes(report.status))
        .sort(compareIncidentPriority),
    [reports]
  );

  const incident = sortedReports[0];
  const [lng, lat] = incident?.location?.coordinates || [121.3708, 16.4833];

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <PageHero
        title="Routing view"
        description="Live positioning and dispatch context for the current response."
      />

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={16}>
          <Card className="soft-card" title="Current route">
            <RouteMap incidentLat={lat} incidentLng={lng} height={420} />
          </Card>
        </Col>
        <Col xs={24} xl={8}>
          <Card className="soft-card" title="Dispatch queue">
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              {sortedReports.slice(0, 6).map((report) => (
                <Card size="small" key={report._id}>
                  <Text strong>{report.category}</Text>
                  <br />
                  <Text type="secondary">{report.location?.address || 'No address'}</Text>
                </Card>
              ))}
            </Space>
          </Card>
        </Col>
      </Row>
    </Space>
  );
}
