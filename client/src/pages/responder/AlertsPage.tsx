import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Empty, Space, Spin, Typography } from 'antd';
import { ClockCircleOutlined } from '@ant-design/icons';
import { api, type Report } from '../../lib/api';
import IncidentCard from '../../components/IncidentCard';
import { compareDateAsc, compareSeverity } from '../../lib/sortUtils';
import PageHero from '../../components/PageHero';
import { FilterControl } from '../../components/StatusFilter';

const { Text } = Typography;
type AlertCategoryFilter = 'all' | 'emergency' | 'public-concern' | 'criminal';

function formatWaitingTime(createdAt: string) {
  const elapsed = Math.max(0, Date.now() - new Date(createdAt).getTime());
  if (!Number.isFinite(elapsed)) return 'Waiting time unavailable';

  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 60) return `Waiting ${minutes || '<1'} min`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Waiting ${hours} ${hours === 1 ? 'hour' : 'hours'}`;

  const days = Math.floor(hours / 24);
  return `Waiting ${days} ${days === 1 ? 'day' : 'days'}`;
}

export default function ResponderAlertsPage() {
  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['responder-alerts'],
    queryFn: () => api.get<Report[]>('/api/reports'),
    refetchInterval: 15000,
  });
  const [categoryFilter, setCategoryFilter] = useState<AlertCategoryFilter>('all');

  const alerts = reports
    .filter(
      (report) =>
        report.status === 'pending' &&
        !report.acknowledgedBy &&
        (['Emergency Situations', 'Public Concerns'].includes(report.category) ||
          (report.category === 'Blotter Cases' && report.subcategory === 'Criminal'))
    )
    .sort((left, right) => compareSeverity(left, right) || compareDateAsc(left, right));

  const emergencyCount = alerts.filter(
    (report) => report.category === 'Emergency Situations'
  ).length;
  const publicConcernCount = alerts.filter(
    (report) => report.category === 'Public Concerns'
  ).length;
  const criminalCount = alerts.filter(
    (report) => report.category === 'Blotter Cases' && report.subcategory === 'Criminal'
  ).length;
  const visibleAlerts = alerts.filter((report) => {
    if (categoryFilter === 'emergency') return report.category === 'Emergency Situations';
    if (categoryFilter === 'public-concern') return report.category === 'Public Concerns';
    if (categoryFilter === 'criminal') {
      return report.category === 'Blotter Cases' && report.subcategory === 'Criminal';
    }
    return true;
  });

  const filterOptions = [
    { label: `All ${alerts.length}`, value: 'all' },
    { label: `Emergency ${emergencyCount}`, value: 'emergency' },
    { label: `Public concern ${publicConcernCount}`, value: 'public-concern' },
    { label: `Criminal ${criminalCount}`, value: 'criminal' },
  ];

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <PageHero
        title="Alerts"
        description={
          isLoading
            ? 'Loading reports waiting for a response.'
            : `${alerts.length} ${alerts.length === 1 ? 'report' : 'reports'} waiting for a response · Sorted by severity, then longest waiting.`
        }
      />

      <FilterControl
        value={categoryFilter}
        onChange={(value) => setCategoryFilter(value as AlertCategoryFilter)}
        options={filterOptions}
        ariaLabel="Filter alerts by category"
      />

      {isLoading ? (
        <Spin />
      ) : visibleAlerts.length === 0 ? (
        <Empty
          description={
            alerts.length === 0
              ? 'No reports are waiting for a response'
              : 'No alerts in this category'
          }
        />
      ) : (
        <div style={{ width: '100%', marginInline: 'auto' }}>
          <Space direction="vertical" size={8} style={{ width: '100%' }}>
            {visibleAlerts.map((report) => (
              <IncidentCard
                key={report._id}
                report={report}
                title={report.aiTitle?.trim() || report.subcategory || report.category}
                to={`/responder/incidents/${encodeURIComponent(report._id)}`}
                showSubmitter={false}
                showStatus={false}
                showDescription
                descriptionLines={2}
                dateFormat="hidden"
                extra={
                  <Text
                    type={report.severity === 'Critical' ? 'danger' : 'secondary'}
                    style={{ whiteSpace: 'nowrap', fontSize: 12 }}
                  >
                    <ClockCircleOutlined /> {formatWaitingTime(report.createdAt)}
                  </Text>
                }
              />
            ))}
          </Space>
        </div>
      )}
    </Space>
  );
}
