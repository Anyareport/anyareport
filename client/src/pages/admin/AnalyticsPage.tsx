import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Button,
  Card,
  Col,
  Drawer,
  Dropdown,
  Empty,
  Progress,
  Row,
  Select,
  Spin,
  Space,
  theme,
  Typography,
} from 'antd';
import {
  DownloadOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
  FolderOpenOutlined,
  HourglassOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api, type Analytics, type AnalyticsInsights } from '../../lib/api';
import { sharedColors } from '../../theme/colorTokens';
import LoadingState from '../../components/LoadingState';
import { getStatusLabel, normalizeReportStatus } from '../../lib/reportWorkflow';
import { downloadCsv, toCsv, toIsoTimestamp } from '../../lib/csv';
import { getCompactAddressLabel, getIncidentLabel } from '../../lib/incidentUtils';
import KpiCard from '../../components/KpiCard';
import PurokBreakdownCard from '../../components/PurokBreakdownCard';
import { useAntdMessage } from '../../lib/useAntdMessage';
import './AnalyticsPage.css';

type AnalyticsPeriod = 'all' | 'week' | 'month' | 'year';
const { Text } = Typography;

const periodLabels: Record<AnalyticsPeriod, string> = {
  all: 'All time',
  week: 'Last 7 days',
  month: 'Last 30 days',
  year: 'Last 365 days',
};

const periodDays: Record<Exclude<AnalyticsPeriod, 'all'>, number> = {
  week: 7,
  month: 30,
  year: 365,
};

const workflowOrder = ['pending', 'coordinating', 'in_progress', 'resolved', 'endorsed', 'flagged'];
const severityColors: Record<string, string> = {
  Critical: 'var(--severity-critical-tag)',
  High: 'var(--severity-high-tag)',
  Medium: 'var(--severity-medium-tag)',
  Low: 'var(--severity-low-tag)',
};

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
  const end = startOfDay(new Date());
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
  const message = useAntdMessage();
  const navigate = useNavigate();
  const [period, setPeriod] = useState<AnalyticsPeriod>('month');
  const [isInsightsOpen, setIsInsightsOpen] = useState(false);
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

  const { data: reports = [], dataUpdatedAt } = useQuery({
    queryKey: ['admin-analytics-reports', period],
    queryFn: () => api.get<import('../../lib/api').Report[]>(`/api/reports?period=${period}`),
    refetchInterval: 30000,
  });

  const analyticsFingerprint = JSON.stringify(
    analytics && {
      total: analytics.total,
      resolved: analytics.resolvedWithinBarangay,
      endorsed: analytics.resolvedExternally,
      byCategory: analytics.byCategory.slice().sort((left, right) => left._id.localeCompare(right._id)),
      byStatus: analytics.byStatus.slice().sort((left, right) => left._id.localeCompare(right._id)),
      bySeverity: analytics.bySeverity?.slice().sort((left, right) => left._id.localeCompare(right._id)),
      byHour: analytics.byHour?.slice().sort((left, right) => left._id.localeCompare(right._id)),
      byPurok: analytics.byPurok?.slice().sort((left, right) => left._id.localeCompare(right._id)),
      last30Days: analytics.last30Days,
    }
  );

  const insightsQuery = useQuery({
    queryKey: ['admin-analytics-insights', period],
    queryFn: async () => ({
      insights: await api.get<AnalyticsInsights>(`/api/reports/analytics/insights?period=${period}`),
      sourceFingerprint: analyticsFingerprint,
    }),
    enabled: false,
    staleTime: Infinity,
    retry: false,
  });

  // The reports endpoint ignores `period`, so apply the same cutoff the analytics
  // endpoint uses. Keeps the KPIs and both exports aligned with the selected period.
  const periodReports = useMemo(() => {
    if (period === 'all') return reports;
    const cutoff = dataUpdatedAt - periodDays[period] * 86400000;
    return reports.filter((report) => new Date(report.createdAt).getTime() >= cutoff);
  }, [reports, period, dataUpdatedAt]);

  const avgResolutionDays = useMemo(() => {
    const resolved = periodReports.filter((r) => r.resolution?.resolvedAt);
    if (!resolved.length) return null;
    const totalMs = resolved.reduce((sum, r) => {
      const ms = new Date(r.resolution!.resolvedAt).getTime() - new Date(r.createdAt).getTime();
      return sum + ms;
    }, 0);
    const days = totalMs / resolved.length / (1000 * 60 * 60 * 24);
    return days < 1 ? `${Math.round(days * 24)}h` : `${days.toFixed(1)}d`;
  }, [periodReports]);

  const { token } = theme.useToken();

  const categoryColors = [
    token.colorPrimary,
    sharedColors.red500,
    sharedColors.blue400,
    sharedColors.green500,
    '#8e44ad',
    '#06b6d4',
  ];

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
  const severityData = analytics?.bySeverity || [];
  const hourData = analytics?.byHour || [];
  const purokData = analytics?.byPurok || [];
  const openCount = statusData
    .filter((entry) => !['Resolved', 'Flagged'].includes(entry.name))
    .reduce((total, entry) => total + entry.count, 0);
  const hasData = Boolean(analytics && analytics.total > 0);
  const insightsData = insightsQuery.data?.insights;
  const insightsAreOutdated = Boolean(
    insightsQuery.data && analytics && insightsQuery.data.sourceFingerprint !== analyticsFingerprint
  );
  const openInsights = () => {
    setIsInsightsOpen(true);
    if (hasData && !insightsQuery.data) void insightsQuery.refetch();
  };

  const inProgressCount = statusData.find((e) => e.name === 'In Progress')?.count ?? 0;
  const pendingCount = statusData.find((e) => e.name === 'Pending')?.count ?? 0;

  // Exports follow the selected period, exactly as shown on this page.
  const getExportDates = () => {
    const now = Date.now();
    const today = new Date(now).toISOString().slice(0, 10);
    const from =
      period === 'all'
        ? dailyData[0]?.date || today
        : new Date(now - periodDays[period] * 86400000).toISOString().slice(0, 10);
    return { today, from, fileSuffix: `${period}-${today}` };
  };
  const percentOfTotal = (count: number) =>
    analytics?.total ? Math.round((count / analytics.total) * 1000) / 10 : 0;

  const exportSummary = () => {
    const { today, from, fileSuffix } = getExportDates();
    const rows: (string | number | null)[][] = [
      ['Overview', 'Period', periodLabels[period], null],
      ['Overview', 'From', from, null],
      ['Overview', 'To', today, null],
      ['Overview', 'Total reports', analytics?.total || 0, null],
      ['Overview', 'Resolved within barangay', analytics?.resolvedWithinBarangay || 0, percentOfTotal(analytics?.resolvedWithinBarangay || 0)],
      ['Overview', 'Endorsed to external agency', analytics?.resolvedExternally || 0, percentOfTotal(analytics?.resolvedExternally || 0)],
      ['Overview', 'Still open', openCount, percentOfTotal(openCount)],
      ['Overview', 'Avg. time to resolve', avgResolutionDays ?? 'n/a', null],
      ...categoryData.map((e) => ['By category', e.name, e.count, percentOfTotal(e.count)]),
      ...statusData.map((e) => ['By status', e.name, e.count, percentOfTotal(e.count)]),
      ...severityData.map((e) => ['By severity', e._id, e.count, percentOfTotal(e.count)]),
      ...hourData.map((e) => ['Time of day', e._id, e.count, percentOfTotal(e.count)]),
      ...purokData.map((e) => ['Top puroks', e._id, e.count, percentOfTotal(e.count)]),
      ...dailyData.map((e) => ['Reports per day', e.date, e.count, null]),
    ];
    downloadCsv(
      `anyareport-analytics-summary-${fileSuffix}.csv`,
      toCsv(['Section', 'Item', 'Count', 'Share (%)'], rows)
    );
  };

  const exportReportDetails = () => {
    const { fileSuffix } = getExportDates();
    // The reports endpoint returns at most the newest 200 reports.
    if (reports.length >= 200) {
      message.warning('This export includes only the 200 most recent reports and may be incomplete.');
    }
    const rows = periodReports.map((report) => [
      report.referenceNumber,
      getIncidentLabel(report),
      report.category,
      report.subcategory,
      report.severity,
      report.status,
      getCompactAddressLabel(report.location?.address),
      report.description,
      report.submitterName,
      toIsoTimestamp(report.createdAt),
      toIsoTimestamp(report.resolution?.resolvedAt),
    ]);
    downloadCsv(
      `anyareport-reports-analytics-${fileSuffix}.csv`,
      toCsv(
        [
          'Reference Number',
          'Incident',
          'Category',
          'Subcategory',
          'Severity',
          'Status',
          'Location',
          'Description',
          'Submitted By',
          'Submitted At',
          'Resolved At',
        ],
        rows
      )
    );
  };

  if (isLoading) {
    return <LoadingState />;
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
          <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>
            Period: <strong style={{ color: 'var(--text-primary)' }}>{periodLabels[period]}</strong>
          </span>
        </Col>
        <Col>
          <Space wrap>
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
            <Button
              type="primary"
              disabled={insightsQuery.isFetching}
              onClick={openInsights}
            >
              {insightsData ? 'View insights' : 'Generate insights'}
            </Button>
            <Dropdown
              disabled={!hasData}
              trigger={['click']}
              menu={{
                items: [
                  { key: 'summary', label: 'Analytics summary (CSV)' },
                  { key: 'details', label: 'Report details (CSV)' },
                ],
                onClick: ({ key }) => (key === 'summary' ? exportSummary() : exportReportDetails()),
              }}
            >
              <Button icon={<DownloadOutlined />} disabled={!hasData}>
                Export
              </Button>
            </Dropdown>
          </Space>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12}>
          <KpiCard
            label="Resolved within barangay"
            value={analytics?.resolvedWithinBarangay || 0}
            icon={<CheckCircleOutlined />}
            tone="success"
            helper="Closed by the barangay response team"
          />
        </Col>
        <Col xs={24} sm={12}>
          <KpiCard
            label="Endorsed to external agencies"
            value={analytics?.resolvedExternally || 0}
            icon={<FolderOpenOutlined />}
            tone="accent"
            helper="Sent to PNP, BFP, Red Cross, or another agency"
          />
        </Col>
      </Row>

      {!hasData && <Alert type="info" showIcon message="No reports found for this period." />}

      <Drawer
        title="Analytics insights"
        placement="right"
        width="min(440px, 100vw)"
        open={isInsightsOpen}
        onClose={() => setIsInsightsOpen(false)}
      >
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <div className="analytics-insights-heading">
            <span>
              Insights · <strong>{periodLabels[period]}</strong>
            </span>
            {insightsData && !insightsData.insufficientData && (
              <Button
                type="link"
                disabled={!hasData || insightsQuery.isFetching}
                onClick={() => void insightsQuery.refetch()}
              >
                Regenerate
              </Button>
            )}
          </div>
          {insightsAreOutdated && (
            <Alert
              type="warning"
              showIcon
              message="Analytics have changed since these insights were generated."
              description="You can review the existing insights or regenerate them to use the latest counts."
            />
          )}
          {!hasData && (
            <Alert
              type="info"
              showIcon
              message="Not enough data"
              description={`There are no reports in ${periodLabels[period].toLowerCase()}. Try a longer period.`}
              action={
                period !== 'all' ? (
                  <Button size="small" onClick={() => setPeriod('all')}>
                    Try all time
                  </Button>
                ) : undefined
              }
            />
          )}
          {hasData && !insightsData && !insightsQuery.isFetching && (
            <Button type="primary" block onClick={() => void insightsQuery.refetch()}>
              Generate insights
            </Button>
          )}
          {insightsQuery.isFetching && (
            <Spin tip={`Generating insights for ${periodLabels[period].toLowerCase()}...`} />
          )}
          {insightsQuery.isError && (
            <Alert
              type="error"
              showIcon
              message="Couldn’t generate insights"
              description="The analytics charts are unaffected. Try again in a moment."
              action={
                <Button
                  size="small"
                  onClick={() => void insightsQuery.refetch()}
                  disabled={!hasData}
                >
                  Try again
                </Button>
              }
            />
          )}
          {insightsData?.insufficientData && (
            <Alert
              type="info"
              showIcon
              message="Not enough data"
              description="There are no reports in this period. Pick a longer period."
            />
          )}
          {insightsData && !insightsData.insufficientData && hasData && (
            <>
              <Card size="small" className="analytics-insights-summary">
                <Space direction="vertical" size={8}>
                  <strong>{insightsData.overallSummary}</strong>
                  <span>
                    Resolved in barangay: {insightsData.resolvedCount} · Endorsed to
                    agencies: {insightsData.endorsedCount}
                  </span>
                </Space>
              </Card>
              {insightsData.recommendations.map((item, index) => (
                <Card
                  key={`${period}-${item.title}-${index}`}
                  size="small"
                  title={`${index + 1}. ${item.title}`}
                  className="analytics-insights-recommendation"
                >
                  <Space direction="vertical" size={6}>
                    <span className="analytics-insights-evidence">{item.evidence}</span>
                    <span>{item.recommendation}</span>
                  </Space>
                </Card>
              ))}
              <Text type="secondary" className="analytics-insights-disclaimer">
                AI suggestions are advisory. Verify with current conditions and official assessments
                before acting.
              </Text>
            </>
          )}
        </Space>
      </Drawer>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} xl={6}>
          <KpiCard
            label="Total reports"
            value={analytics?.total || 0}
            icon={<FileTextOutlined />}
            tone="accent"
            helper={`Showing data for ${periodLabels[period].toLowerCase()}`}
          />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <KpiCard
            label="Resolution rate"
            value={analytics?.resolutionRate || 0}
            suffix="%"
            icon={<CheckCircleOutlined />}
            tone="success"
            progress={{
              value: analytics?.resolutionRate || 0,
              color: 'var(--severity-low-tag)',
            }}
            helper={`${analytics?.resolved || 0} of ${analytics?.total || 0} resolved`}
          />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <KpiCard
            label="Still open"
            value={openCount}
            icon={<FolderOpenOutlined />}
            tone={openCount > 0 ? 'warning' : 'neutral'}
            progress={{
              value: analytics?.total ? Math.round((openCount / analytics.total) * 100) : 0,
              color: 'var(--severity-medium-tag)',
            }}
            helper={`${inProgressCount} in progress · ${pendingCount} pending`}
          />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <KpiCard
            label="Avg. time to resolve"
            value={avgResolutionDays ?? '—'}
            icon={<HourglassOutlined />}
            tone="neutral"
            helper={
              avgResolutionDays
                ? `Based on ${periodReports.filter((r) => r.resolution?.resolvedAt).length} resolved reports`
                : 'No resolved reports in this period'
            }
          />
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
                <Bar dataKey="count" fill={token.colorPrimary} radius={[3, 3, 0, 0]} />
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
        <div
          style={{
            display: 'flex',
            height: 50,
            overflow: 'hidden',
            borderRadius: 4,
            marginBottom: 16,
          }}
        >
          {statusData.map((entry, index) => {
            const width = analytics?.total ? (entry.count / analytics.total) * 100 : 0;
            const percentage = Math.round(width);
            const showInside = width > 5;
            const isLightBg = index < 2;
            const textColor = isLightBg ? 'var(--text-primary)' : 'white';

            return (
              <div
                key={entry.name}
                title={`${entry.name}: ${entry.count}`}
                style={{
                  width: `${width}%`,
                  minWidth: entry.count ? 3 : 0,
                  background: [
                    'var(--status-pending-border)',
                    'var(--status-coordinating-border)',
                    'var(--status-on-scene-border)',
                    'var(--status-resolved-border)',
                    'var(--status-coordinating-border)',
                    'var(--status-flagged-tag)',
                  ][index],
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'column',
                  gap: 1,
                }}
              >
                {showInside && (
                  <>
                    <span
                      style={{
                        fontSize: 20,
                        fontWeight: 700,
                        color: textColor,
                        lineHeight: 1,
                      }}
                    >
                      {entry.count}
                    </span>
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 500,
                        color: textColor,
                        lineHeight: 1,
                      }}
                    >
                      {percentage}%
                    </span>
                  </>
                )}
              </div>
            );
          })}
        </div>
        <Space wrap style={{ width: '100%' }}>
          {statusData.map((entry, index) => {
            return (
              <div key={entry.name} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: 2,
                    background: [
                      'var(--status-pending-border)',
                      'var(--status-coordinating-border)',
                      'var(--status-on-scene-border)',
                      'var(--status-resolved-border)',
                      'var(--status-flagged-tag)',
                    ][index],
                  }}
                />
                <span style={{ fontSize: 13 }}>{entry.name}</span>
              </div>
            );
          })}
        </Space>
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24} md={8}>
          <Card className="soft-card" title="By severity" style={{ height: '100%' }}>
            <Space direction="vertical" size={10} style={{ width: '100%' }}>
              {severityData.map((entry) => (
                <div key={entry._id}>
                  <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                    <span>{entry._id}</span>
                    <span>{entry.count}</span>
                  </Space>
                  <Progress
                    percent={
                      analytics?.total ? Math.round((entry.count / analytics.total) * 100) : 0
                    }
                    showInfo={false}
                    strokeColor={severityColors[entry._id] || token.colorPrimary}
                  />
                </div>
              ))}
            </Space>
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card className="soft-card" title="Busiest time of day" style={{ height: '100%' }}>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={hourData} margin={{ top: 10, right: 4, left: 0, bottom: 8 }}>
                <XAxis dataKey="_id" tick={{ fill: token.colorTextTertiary, fontSize: 11 }} />
                <YAxis hide allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill={token.colorPrimary} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <PurokBreakdownCard
            data={purokData}
            onViewHeatmap={() => navigate('/admin/heatmap')}
            style={{ height: '100%' }}
          />
        </Col>
      </Row>
    </Space>
  );
}