import { useQuery } from '@tanstack/react-query';
import { Card, Space, Typography, Segmented } from 'antd';
import { useState, useMemo } from 'react';
import { api, type Report } from '../../lib/api';
import IncidentList from '../../components/IncidentList';
import { formatStatus } from '../../components/StatusTag';
import { compareIncidentPriority } from '../../lib/sortUtils';

const { Title, Paragraph } = Typography;

export default function SecretaryIntakePage() {
  const [status, setStatus] = useState<string | 'all'>('pending');

  const { data: reports = [] } = useQuery({
    queryKey: ['secretary-intake', status],
    queryFn: () =>
      api.get<Report[]>(`/api/reports${status === 'all' ? '' : `?status=${status}`}`),
    refetchInterval: 30000,
  });

  const sorted = useMemo(() => {
    return [...reports].sort(compareIncidentPriority);
  }, [reports]);

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Card className="soft-card page-hero">
        <Title level={2} style={{ color: '#fff', marginTop: 0 }}>
          Intake queue
        </Title>
        <Paragraph style={{ color: 'rgba(255,255,255,0.82)' }}>
          Secretary review queue for new submissions. Resolved cases are pushed to the bottom.
        </Paragraph>
      </Card>

      <Card className="soft-card">
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
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
          <IncidentList reports={sorted} basePath="/admin/incidents" />
        </Space>
      </Card>
    </Space>
  );
}
