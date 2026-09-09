import { useQuery } from '@tanstack/react-query';
import { Card, Space, Typography, Segmented } from 'antd';
import { useState, useMemo } from 'react';
import { api, type Report } from '../../lib/api';
import IncidentList from '../../components/IncidentList';
import { getSeverityOrder } from '../../components/SeverityTag';

const { Title, Paragraph } = Typography;

const RESOLVED_STATUSES = new Set(['resolved', 'flagged']);

type SortMode = 'severity' | 'date' | 'status';

const STATUS_ORDER: Record<string, number> = {
  pending: 0,
  verified: 1,
  en_route: 2,
  on_scene: 3,
  flagged: 4,
  resolved: 5,
};

export default function SecretaryIntakePage() {
  const [sortMode, setSortMode] = useState<SortMode>('severity');

  const { data: reports = [] } = useQuery({
    queryKey: ['secretary-intake'],
    queryFn: () => api.get<Report[]>('/api/reports?status=pending'),
    refetchInterval: 30000,
  });

  const sorted = useMemo(() => {
    const active = reports.filter((r) => !RESOLVED_STATUSES.has(r.status));
    const handled = reports.filter((r) => RESOLVED_STATUSES.has(r.status));

    const compare = (a: Report, b: Report): number => {
      if (sortMode === 'severity') {
        const diff = getSeverityOrder(a.severity) - getSeverityOrder(b.severity);
        if (diff !== 0) return diff;
        // secondary: most recent first
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      if (sortMode === 'date') {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      // sortMode === 'status'
      const diff = (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99);
      if (diff !== 0) return diff;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    };

    return [...active.sort(compare), ...handled.sort(compare)];
  }, [reports, sortMode]);

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
        <Space style={{ marginBottom: 16 }}>
          <Segmented
            value={sortMode}
            options={[
              { value: 'severity', label: 'By Severity' },
              { value: 'date', label: 'By Date' },
              { value: 'status', label: 'By Status' },
            ]}
            onChange={(val) => setSortMode(val as SortMode)}
          />
        </Space>
        <IncidentList reports={sorted} basePath="/admin/incidents" />
      </Card>
    </Space>
  );
}
