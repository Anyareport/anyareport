import { useQuery } from '@tanstack/react-query';
import { Card, Col, Row, Space, Typography } from 'antd';
import { api, type Report } from '../../lib/api';
import { RouteMap } from '../../components/MapPicker';

const { Title, Paragraph, Text } = Typography;

export default function ResponderRoutingPage() {
  const { data: reports = [] } = useQuery({
    queryKey: ['responder-routing'],
    queryFn: () => api.get<Report[]>('/api/reports?status=en_route'),
    refetchInterval: 30000,
  });

  const incident = reports[0];
  const [lng, lat] = incident?.location?.coordinates || [121.3708, 16.4833];

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Card className="soft-card page-hero">
        <Title level={2} style={{ color: '#fff', marginTop: 0 }}>Routing view</Title>
        <Paragraph style={{ color: 'rgba(255,255,255,0.82)' }}>
          Live positioning and dispatch context for the current response.
        </Paragraph>
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={16}>
          <Card className="soft-card" title="Current route">
            <RouteMap incidentLat={lat} incidentLng={lng} height={420} />
          </Card>
        </Col>
        <Col xs={24} xl={8}>
          <Card className="soft-card" title="Dispatch queue">
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              {reports.slice(0, 6).map((report) => (
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