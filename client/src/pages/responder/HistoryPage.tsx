import { useQuery } from '@tanstack/react-query';
import { Card, Space, Typography } from 'antd';
import { api, type Report } from '../../lib/api';
import IncidentList from '../../components/IncidentList';

const { Title, Paragraph } = Typography;

export default function ResponderHistoryPage() {
  const { data: reports = [] } = useQuery({
    queryKey: ['responder-history'],
    queryFn: () => api.get<Report[]>('/api/reports'),
    refetchInterval: 60000,
  });

  const history = reports.filter((report) => report.status === 'resolved' || report.status === 'flagged');

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Card className="soft-card page-hero">
        <Title level={2} style={{ color: '#fff', marginTop: 0 }}>History</Title>
        <Paragraph style={{ color: 'rgba(255,255,255,0.82)' }}>
          Closed and reviewed incidents remain searchable for follow-up and after-action review.
        </Paragraph>
      </Card>

      <Card className="soft-card" title="Incident history">
        <IncidentList reports={history} basePath="/responder/incidents" />
      </Card>
    </Space>
  );
}