import { useQuery } from '@tanstack/react-query';
import { Card, Col, Row, Space, Tag, Typography } from 'antd';
import { Link } from 'react-router-dom';
import { api, type Report } from '../../lib/api';
import StatusTag from '../../components/StatusTag';
import { compareIncidentPriority } from '../../lib/sortUtils';
import PageHero from '../../components/PageHero';

const { Text } = Typography;

export default function ResponderAlertsPage() {
  const { data: reports = [] } = useQuery({
    queryKey: ['responder-alerts'],
    queryFn: () => api.get<Report[]>('/api/reports'),
    refetchInterval: 15000,
  });

  const alerts = reports
    .filter(
      (report) =>
        report.status === 'pending' &&
        !report.acknowledgedBy &&
        ['Emergency Situations', 'Public Concerns'].includes(report.category)
    )
    .sort(compareIncidentPriority);

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <PageHero
        title="Alerts"
        description="New emergency and public concern reports available for response."
      />

      <Row gutter={[16, 16]}>
        {alerts.map((report) => (
          <Col xs={24} md={12} lg={8} key={report._id}>
            <Card
              className="soft-card"
              title={report.aiTitle?.trim() || report.subcategory || report.category}
              extra={<StatusTag status={report.status} />}
              actions={[
                <Link key="open" to={`/responder/incidents/${report._id}`}>
                  Open incident
                </Link>,
              ]}
            >
              <Space direction="vertical" size={8} style={{ width: '100%' }}>
                <Text type="secondary">
                  {report.category}
                  {report.subcategory ? ` · ${report.subcategory}` : ''}
                </Text>
                {report.referenceNumber && (
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Reference {report.referenceNumber}
                  </Text>
                )}
                <Text>{report.description}</Text>
                <Tag color={report.category === 'Emergency Situations' ? 'red' : 'blue'}>
                  {report.category === 'Emergency Situations'
                    ? 'Urgent response'
                    : 'Standard alert'}
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
