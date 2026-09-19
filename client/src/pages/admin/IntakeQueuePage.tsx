import { useQuery } from '@tanstack/react-query';
import { Card, Space, Segmented } from 'antd';
import { useState, useMemo } from 'react';
import { api, type Report } from '../../lib/api';
import IncidentList from '../../components/IncidentList';
import { formatStatus } from '../../components/StatusTag';
import { compareIncidentPriority } from '../../lib/sortUtils';
import PageHero from '../../components/PageHero';

export default function SecretaryIntakePage() {
  const [status, setStatus] = useState<string | 'all'>('pending');

  const { data: reports = [] } = useQuery({
    queryKey: ['secretary-intake', status],
    queryFn: () => api.get<Report[]>(`/api/reports${status === 'all' ? '' : `?status=${status}`}`),
    refetchInterval: 30000,
  });

  const sorted = useMemo(() => {
    return [...reports].sort(compareIncidentPriority);
  }, [reports]);

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <PageHero
        title="Intake queue"
        description="Secretary review queue for new submissions. Resolved cases are pushed to the bottom."
      />

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

      <Card className="soft-card" title="Intake monitor">
        <IncidentList reports={sorted} basePath="/admin/incidents" />
      </Card>
    </Space>
  );
}
