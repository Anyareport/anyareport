import { useQuery } from '@tanstack/react-query';
import { Col, Row, Space, Tag } from 'antd';
import { Link } from 'react-router-dom';
import { api, type Report } from '../../lib/api';
import IncidentCard from '../../components/IncidentCard';
import { compareIncidentPriority } from '../../lib/sortUtils';
import PageHero from '../../components/PageHero';

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
            <IncidentCard
              report={report}
              className="soft-card"
              showDescription
              dateFormat="hidden"
              actions={[
                <Link key="open" to={`/responder/incidents/${report._id}`}>
                  Open incident
                </Link>,
              ]}
            >
              <Tag color={report.category === 'Emergency Situations' ? 'red' : 'blue'}>
                {report.category === 'Emergency Situations' ? 'Urgent response' : 'Standard alert'}
              </Tag>
            </IncidentCard>
          </Col>
        ))}
      </Row>
    </Space>
  );
}
