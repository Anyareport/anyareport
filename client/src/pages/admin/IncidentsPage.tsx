import { useQuery } from '@tanstack/react-query';
import { Card, Space, Typography, Segmented } from 'antd';
import { useMemo, useState } from 'react';
import { api, type Report } from '../../lib/api';
import IncidentList from '../../components/IncidentList';

const { Title, Paragraph } = Typography;

export default function AdminIncidentsPage() {
  const [status, setStatus] = useState<string | 'all'>('all');
  const { data: reports = [] } = useQuery({
    queryKey: ['admin-reports', status],
    queryFn: () => api.get<Report[]>(`/api/reports${status === 'all' ? '' : `?status=${status}`}`),
    refetchInterval: 30000,
  });

  const filtered = useMemo(() => reports, [reports]);

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Card className="soft-card page-hero">
        <Title level={2} style={{ color: '#fff', marginTop: 0 }}>Incidents</Title>
        <Paragraph style={{ color: 'rgba(255,255,255,0.82)' }}>
          Desktop table on larger screens, card-per-incident layout below tablet width.
        </Paragraph>
      </Card>

      <Card className="soft-card">
        <Segmented
          value={status}
          options={['all', 'pending', 'verified', 'en_route', 'on_scene', 'resolved', 'flagged']}
          onChange={(value) => setStatus(value as string)}
        />
      </Card>

      <Card className="soft-card" title="Incident monitor">
        <IncidentList reports={filtered} basePath="/admin/incidents" />
      </Card>
    </Space>
  );
}