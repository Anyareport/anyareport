import { useQuery } from '@tanstack/react-query';
import { Card, Space, Typography } from 'antd';
import { api, type Report } from '../../lib/api';
import IncidentList from '../../components/IncidentList';

const { Title, Paragraph } = Typography;

export default function SecretaryIntakePage() {
  const { data: reports = [] } = useQuery({
    queryKey: ['secretary-intake'],
    queryFn: () => api.get<Report[]>('/api/reports?status=pending'),
    refetchInterval: 30000,
  });

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Card className="soft-card page-hero">
        <Title level={2} style={{ color: '#fff', marginTop: 0 }}>
          Intake queue
        </Title>
        <Paragraph style={{ color: 'rgba(255,255,255,0.82)' }}>
          Secretary review queue for new submissions.
        </Paragraph>
      </Card>

      <Card className="soft-card">
        <IncidentList reports={reports} basePath="/admin/incidents" />
      </Card>
    </Space>
  );
}
