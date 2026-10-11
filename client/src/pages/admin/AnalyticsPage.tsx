import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Card,
  Col,
  Empty,
  Progress,
  Row,
  Select,
  Space,
  Statistic,
  Spin,
  theme,
} from 'antd';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api, type Analytics } from '../../lib/api';
import { sharedColors } from '../../theme/colorTokens';
import { getStatusLabel, normalizeReportStatus } from '../../lib/reportWorkflow';

type AnalyticsPeriod = 'all' | 'week' | 'month' | 'year';

const periodLabels: Record<AnalyticsPeriod, string> = {
  all: 'All time',
  week: 'Last 7 days',
  month: 'Last 30 days',
  year: 'Last 365 days',
};

const workflowOrder = ['pending', 'coordinating', 'in_progress', 'resolved'];
const categoryColors = [
  sharedColors.brandPrimary,
  sharedColors.blue400,
  '#f97316',
  sharedColors.green500,
  '#8e44ad',
  '#06b6d4',
];

function startOfDay(date: Date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function formatDate(date: Date, period: AnalyticsPeriod) {
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(period === 'year' ? { year: 'numeric' } : {}),
  });
}

function fillDailyData(data: Analytics['last30Days'], period: AnalyticsPeriod) {
  const counts = new Map(data.map((item) => [item._id, item.count]));
  const sourceDates = data.map((item) => new Date(`${item._id}T00:00:00`));
  const end = startOfDay(sourceDates.length ? sourceDates[sourceDates.length - 1] : new Date());
  const dayCount = period === 'week' ? 7 : period === 'month' ? 30 : period === 'year' ? 365 : 0;
  const start = dayCount
    ? new Date(end.getTime() - (dayCount - 1) * 86400000)
    : startOfDay(sourceDates[0] || end);
  const totalDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);

  return Array.from({ length: totalDays }, (_, index) => {
    const date = new Date(start.getTime() + index * 86400000);
    const key = date.toISOString().slice(0, 10);
    return { date: key, label: formatDate(date, period), count: counts.get(key) || 0 };
  });
}

export default function AdminAnalyticsPage() {
  const [period, setPeriod] = useState<AnalyticsPeriod>('month');
  const {
    data: analytics,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['admin-analytics', period],
    queryFn: () => api.get<Analytics>(`/api/reports/analytics?period=${period}`),
    refetchInterval: 30000,
  });
  const { token } = theme.useToken();

  const categoryData = useMemo(
    () =>
      (analytics?.byCategory || []).map((entry, index) => ({
        name: entry._id || 'Other',
        count: entry.count,
        share: analytics?.total ? Math.round((entry.count / analytics.total) * 100) : 0,
        color: categoryColors[index % categoryColors.length],
      })),
    [analytics]
  );

  const statusData = useMemo(() => {
    const counts = new Map(
      (analytics?.byStatus || []).map((entry) => [normalizeReportStatus(entry._id), entry.count])
    );
    return workflowOrder.map((status) => ({
      name: getStatusLabel(status),
      count: counts.get(status) || 0,
    }));
  }, [analytics]);

  const dailyData = useMemo(
    () => fillDailyData(analytics?.last30Days || [], period),
    [analytics, period]
  );
  const openCount = statusData
    .filter((entry) => entry.name !== 'Resolved')
    .reduce((total, entry) => total + entry.count, 0);
  const hasData = Boolean(analytics && analytics.total > 0);

  if (isLoading) {
    return <Spin size="large" style={{ display: 'block', margin: '48px auto' }} />;
  }

  if (isError) {
    return (
      <Alert
        type="error"
        showIcon
        message="Analytics could not be loaded"
        description={error instanceof Error ? error.message : 'Please try again.'}
        action={<a onClick={() => void refetch()}>Retry</a>}
      />
    );
  }

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Row justify="space-between" align="middle" gutter={[16, 16]}>
        <Col>
          <Statistic title="Reporting period" value={periodLabels[period]} />
        </Col>
        <Col>
          <Select
            aria-label="Analytics period"
            value={period}
            style={{ width: 180 }}
            onChange={setPeriod}
            options={[
              { value: 'week', label: '7 days' },
              { value: 'month', label: '30 days' },
              { value: 'year', label: '12 months' },
              { value: 'all', label: 'All time' },
            ]}
          />
        </Col>
      </Row>

      {!hasData && <Alert type="info" showIcon message="No reports found for this period." />}

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} xl={6}>
          <Card className="soft-card" style={{ height: '100%' }}>
            <Statistic title="Total reports" value={analytics?.total || 0} />
          </Card>
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <Card className="soft-card" style={{ height: '100%' }}>
            <Statistic title="Resolution rate" value={analytics?.resolutionRate || 0} suffix="%" />
            <span>
              {analytics?.resolved || 0} of {analytics?.total || 0} resolved
            </span>
          </Card>
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <Card className="soft-card" style={{ height: '100%' }}>
            <Statistic title="Still open" value={openCount} />
            <span>{analytics?.pending || 0} pending</span>
          </Card>
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <Card className="soft-card" style={{ height: '100%' }}>
            <Statistic title="Categories represented" value={categoryData.length} />
            <span>Descriptive reporting only</span>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={14}>
          <Card
            className="soft-card"
            style={{ height: '100%' }}
            title="Reports per day"
            extra={periodLabels[period]}
          >
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={dailyData} barCategoryGap="18%">
                <CartesianGrid strokeDasharray="3 3" stroke={token.colorBorderSecondary} />
                <XAxis dataKey="label" tick={{ fill: token.colorTextTertiary }} minTickGap={28} />
                <YAxis allowDecimals={false} tick={{ fill: token.colorTextTertiary }} />
                <Tooltip />
                <Bar dataKey="count" fill={sharedColors.blue400} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>
        <Col xs={24} xl={10}>
          <Card
            className="soft-card"
            style={{ height: '100%' }}
            title="By category"
            extra={`Share of ${analytics?.total || 0} reports`}
          >
            <Space direction="vertical" size={14} style={{ width: '100%' }}>
              {categoryData.length ? (
                categoryData.map((entry) => (
                  <div key={entry.name}>
                    <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                      <span>{entry.name}</span>
                      <span>
                        {entry.count} · {entry.share}%
                      </span>
                    </Space>
                    <Progress percent={entry.share} showInfo={false} strokeColor={entry.color} />
                  </div>
                ))
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No category data" />
              )}
            </Space>
          </Card>
        </Col>
      </Row>

      <Card className="soft-card" title="Where reports are in the workflow">
        <Progress
          percent={analytics?.total ? 100 : 0}
          success={{
            percent: analytics?.total ? (statusData[3].count / analytics.total) * 100 : 0,
          }}
          strokeColor={sharedColors.blue400}
          format={() => ''}
        />
        <Row justify="space-between">
          {statusData.map((entry) => (
            <span key={entry.name}>
              {entry.name}: {entry.count}
            </span>
          ))}
        </Row>
      </Card>

      <Card className="soft-card" title="Status mix">
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={statusData} layout="vertical" margin={{ left: 20, right: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={token.colorBorderSecondary} />
            <XAxis type="number" allowDecimals={false} tick={{ fill: token.colorTextTertiary }} />
            <YAxis
              type="category"
              dataKey="name"
              width={100}
              tick={{ fill: token.colorTextTertiary }}
            />
            <Tooltip />
            <Bar dataKey="count" fill={sharedColors.brandPrimary} radius={[0, 3, 3, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>
    </Space>
  );
}
