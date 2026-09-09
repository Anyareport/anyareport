import { useQuery } from '@tanstack/react-query';
import { Card, Space, Typography, Segmented } from 'antd';
import { useMemo, useState } from 'react';
import { api, type Report } from '../../lib/api';
import IncidentList from '../../components/IncidentList';
import { formatStatus } from '../../components/StatusTag';
import { compareIncidentPriority } from '../../lib/sortUtils';

const { Title, Paragraph } = Typography;

export default function AdminIncidentsPage() {
  const [status, setStatus] = useState<string | 'all'>('all');
  const { data: reports = [] } = useQuery({
    queryKey: ['admin-reports', status],
    queryFn: () => api.get<Report[]>(`/api/reports${status === 'all' ? '' : `?status=${status}`}`),
    refetchInterval: 30000,
  });

  const filtered = useMemo(() => {
    return [...reports].sort(compareIncidentPriority);
  }, [reports]);

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Card className="soft-card page-hero">
        <Title level={2} style={{ color: '#fff', marginTop: 0 }}>
          Incidents
        </Title>
        <Paragraph style={{ color: 'rgba(255,255,255,0.82)' }}>
          Desktop table on larger screens, card-per-incident layout below tablet width.
        </Paragraph>
      </Card>

      <Card className="soft-card">
        <Segmented
          value={status}
          options={[
            { value: 'all', label: 'All' },
            { value: 'pending', label: formatStatus('pending') },
            { value: 'verified', label: formatStatus('verified') },
            { value: 'en_route', label: formatStatus('en_route') },
            { value: 'on_scene', label: formatStatus('on_scene') },
            { value: 'resolved', label: formatStatus('resolved') },
            { value: 'flagged', label: formatStatus('flagged') },
          ]}
          onChange={(value) => setStatus(value as string)}
        />
      </Card>

      <Card className="soft-card" title="Incident monitor">
        <IncidentList reports={filtered} basePath="/admin/incidents" />
      </Card>
    </Space>
  );
}
