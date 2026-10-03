import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, Space } from 'antd';
import { api, type Report } from '../../lib/api';
import IncidentList from '../../components/IncidentList';
import StatusFilter from '../../components/StatusFilter';
import { compareIncidentPriority } from '../../lib/sortUtils';
import PageHero from '../../components/PageHero';
import { useAuth } from '../../contexts/AuthContext';

export interface IncidentHistoryPageProps {
  variant?: 'admin' | 'responder';
}

export default function IncidentHistoryPage({ variant = 'admin' }: IncidentHistoryPageProps) {
  const [status, setStatus] = useState<string | 'all'>('all');
  const { role } = useAuth();

  const { data: reports = [] } = useQuery({
    queryKey: variant === 'responder' ? ['responder-history'] : ['admin-reports', status],
    queryFn: () =>
      api.get<Report[]>(
        variant === 'responder'
          ? '/api/reports?handledByMe=true'
          : `/api/reports${status === 'all' ? '' : `?status=${status}`}`
      ),
    refetchInterval: 30000,
  });

  const filtered = useMemo(() => {
    const sorted = [...reports].sort(compareIncidentPriority);

    if (variant === 'responder') {
      return sorted.filter((report) => report.status === 'resolved' || report.status === 'flagged');
    }

    return sorted;
  }, [reports, variant]);

  // Responder-specific settings
  if (variant === 'responder') {
    return (
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <PageHero
          title="Incident History"
          description="Closed and reviewed incidents remain searchable for follow-up and after-action review."
        />

        {/* <Card className="soft-card" title="Incident history"> */}
        <IncidentList reports={filtered} basePath="/responder/incidents" />
        {/* </Card> */}
      </Space>
    );
  }

  // Admin/Secretary settings
  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <PageHero
        title="Incidents"
        description="Review incidents by urgency, status, and location."
      />

      <StatusFilter value={status} onChange={setStatus} />

      <IncidentList
        reports={filtered}
        basePath="/admin/incidents"
        showSubmitter={role !== 'admin'}
      />
    </Space>
  );
}
