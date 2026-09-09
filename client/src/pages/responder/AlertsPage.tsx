import { useQuery } from '@tanstack/react-query';
import { Card, Col, Row, Space, Tag, Typography } from 'antd';
import { Link } from 'react-router-dom';
import { api, type Report } from '../../lib/api';
import StatusTag from '../../components/StatusTag';
import { compareIncidentPriority } from '../../lib/sortUtils';

const { Title, Paragraph, Text } = Typography;

export default function ResponderAlertsPage() {
  const { data: reports = [] } = useQuery({
    queryKey: ['responder-alerts'],
    queryFn: () => api.get<Report[]>('/api/reports?status=verified'),
    refetchInterval: 15000,
  });

  const alerts = reports
    .filter((report) => ['verified', 'en_route', 'on_scene'].includes(report.status))
    .sort(compareIncidentPriority);

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Card className="soft-card page-hero">
        <Title level={2} style={{ color: '#fff', marginTop: 0 }}>
          Alerts
        </Title>
        <Paragraph style={{ color: 'rgba(255,255,255,0.82)' }}>
          Dual-layer urgent alerts surface verified incidents and emergency calls for fast triage.
        </Paragraph>
      </Card>

      <Row gutter={[16, 16]}>
        {alerts.map((report) => (
          <Col xs={24} md={12} lg={8} key={report._id}>
            <Card
              className="soft-card"
              title={report.category}
              extra={<StatusTag status={report.status} />}
              actions={[
                <Link key="open" to={`/responder/incidents/${report._id}`}>
                  Open incident
                </Link>,
              ]}
            >
              <Space direction="vertical" size={8} style={{ width: '100%' }}>
                <Text>{report.description}</Text>
                <Tag color={report.category === 'Emergency Situations' ? 'red' : 'blue'}>
                  {report.category === 'Emergency Situations'
                    ? 'Urgent response'
                    : 'Verified alert'}
                </Tag>
                <Text type="secondary">{report.location?.address || 'Location unknown'}</Text>
              </Space>
            </Card>
          </Col>
        ))}
      </Row>
    </Space>
  );
}
