import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, Col, Row, Space, Typography, List, Button } from 'antd';

import {
  AlertOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  InboxOutlined,
  BellOutlined,
  FileSearchOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { api, type Analytics, type Report } from '../../lib/api';
import IncidentCard from '../../components/IncidentCard';
import KpiCard from '../../components/KpiCard';
import { useAuth } from '../../contexts/AuthContext';
import { useNotificationFeed } from '../../lib/notificationFeed';

const { Text } = Typography;

export default function AdminDashboardPage() {
  const navigate = useNavigate();
  const { role } = useAuth();
  const isSecretary = role === 'secretary';

  const { data: analytics } = useQuery({
    queryKey: ['admin-dashboard-analytics'],
    queryFn: () => api.get<Analytics>('/api/reports/analytics'),
    refetchInterval: 30000,
  });

  const { data: reports = [] } = useQuery({
    queryKey: ['admin-dashboard-reports'],
    queryFn: () => api.get<Report[]>('/api/reports'),
    refetchInterval: 30000,
  });

  const { data: notificationFeed } = useNotificationFeed();

  const { data: inactivityMonitor } = useQuery({
    queryKey: ['captain-inactive-reports'],
    queryFn: () =>
      api.get<{ thresholdHours: number; reports: (Report & { inactiveHours: number })[] }>(
        '/api/reports/captain/inactive'
      ),
    enabled: role === 'captain',
    refetchInterval: 30000,
  });

  const openReports = reports.filter((report) => report.status !== 'resolved').length;
  const openCriticalReports = reports.filter(
    (report) => report.status !== 'resolved' && report.severity === 'Critical'
  ).length;
  const openHighReports = reports.filter(
    (report) => report.status !== 'resolved' && report.severity === 'High'
  ).length;
  const pendingResolutionReviews = reports.filter(
    (report) => report.status === 'resolved' && report.resolution?.verificationStatus === 'pending'
  );
  const currentMonthStart = new Date();
  currentMonthStart.setHours(0, 0, 0, 0);
  currentMonthStart.setDate(1);

  const reportsThisMonth = reports.filter(
    (report) => new Date(report.createdAt).getTime() >= currentMonthStart.getTime()
  );
  const resolvedThisMonth = reports.filter(
    (report) =>
      report.resolution?.resolvedAt &&
      new Date(report.resolution.resolvedAt).getTime() >= currentMonthStart.getTime()
  ).length;

  const secretaryQueue = useMemo(
    () =>
      [...reports]
        .filter((report) => report.status === 'pending')
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
    [reports]
  );

  const recentActivity = useMemo(
    () =>
      [...reports]
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .slice(0, 4),
    [reports]
  );

  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();

    reportsThisMonth.forEach((report) => {
      const category = report.category || 'Other';
      counts.set(category, (counts.get(category) ?? 0) + 1);
    });

    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([category, count]) => ({ category, count }));
  }, [reportsThisMonth]);

  const maxCategoryCount = Math.max(...categoryCounts.map((item) => item.count), 1);

  const staleCount = reports.filter((report) => {
    const ageDays = (Date.now() - new Date(report.updatedAt).getTime()) / (1000 * 60 * 60 * 24);
    return report.status !== 'resolved' && ageDays >= 7;
  }).length;

  const resolvedPercent =
    reportsThisMonth.length > 0
      ? Math.round((resolvedThisMonth / reportsThisMonth.length) * 100)
      : 0;

  if (isSecretary) {
    return (
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} xl={6}>
            <KpiCard
              label="Pending intake"
              value={secretaryQueue.length}
              icon={<InboxOutlined />}
              tone="accent"
              helper="Waiting to be reviewed"
              link={{ text: 'Review queue', href: '/admin/intake' }}
            />
          </Col>
          <Col xs={24} sm={12} xl={6}>
            <KpiCard
              label="Open incidents"
              value={openReports}
              icon={<AlertOutlined />}
              tone={
                openCriticalReports > 0 ? 'danger' : openHighReports > 0 ? 'warning' : 'neutral'
              }
              badges={[
                ...(openCriticalReports > 0
                  ? [
                      {
                        text: `${openCriticalReports} critical`,
                        tone: 'danger' as const,
                        color: 'var(--severity-critical-tag)',
                        background:
                          'color-mix(in srgb, var(--severity-critical-tag) 14%, transparent)',
                      },
                    ]
                  : []),
                ...(openHighReports > 0
                  ? [
                      {
                        text: `${openHighReports} high`,
                        tone: 'warning' as const,
                        color: 'var(--severity-high-tag)',
                        background: 'color-mix(in srgb, var(--severity-high-tag) 14%, transparent)',
                      },
                    ]
                  : []),
              ]}
              link={{ text: 'View by severity', href: '/admin/incidents?severity=Critical' }}
            />
          </Col>
          <Col xs={24} sm={12} xl={6}>
            <KpiCard
              label="Stale cases"
              value={staleCount}
              icon={<ClockCircleOutlined />}
              tone={staleCount > 0 ? 'medium' : 'neutral'}
              helper="No update in 7+ days"
              link={{ text: 'Check these cases', href: '/admin/incidents?stale=true' }}
            />
          </Col>
          <Col xs={24} sm={12} xl={6}>
            <KpiCard
              label="Resolved this month"
              value={resolvedThisMonth}
              suffix={`/ ${reportsThisMonth.length}`}
              icon={<CheckCircleOutlined />}
              tone="success"
              progress={{ value: resolvedPercent }}
              helper={`${resolvedPercent}% of reports filed this month`}
            />
          </Col>
        </Row>

        <Row gutter={[16, 16]} align="top">
          <Col xs={24} xl={16}>
            <Card
              className="soft-card"
              title="Pending Intake"
              extra={
                <Button type="primary" variant="outlined" onClick={() => navigate('/admin/intake')}>
                  Open Intake Queue
                </Button>
              }
            >
              {secretaryQueue.length === 0 ? (
                <Text type="secondary">No open cases need action.</Text>
              ) : (
                <Space direction="vertical" size={20} style={{ width: '100%' }}>
                  {secretaryQueue.slice(0, 5).map((report) => (
                    <IncidentCard
                      key={report._id}
                      report={report}
                      onClick={() => navigate(`/admin/incidents/${report._id}`)}
                      dateFormat="relative"
                    />
                  ))}
                </Space>
              )}
            </Card>
          </Col>

          <Col xs={24} xl={8}>
            <Card
              className="soft-card"
              title="Monthly Report Categories"
              extra={
                <Button
                  variant="outlined"
                  color="primary"
                  onClick={() => navigate('/admin/analytics')}
                >
                  View Analytics
                </Button>
              }
            >
              {categoryCounts.map(({ category, count }) => (
                <div key={category} style={{ marginBottom: 14 }}>
                  <div
                    style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}
                  >
                    <Text strong>{category}</Text>
                    <Text type="secondary">{count}</Text>
                  </div>
                  <div
                    style={{
                      width: '100%',
                      height: 8,
                      borderRadius: 999,
                      background: 'var(--bg-secondary)',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        width: `${(count / maxCategoryCount) * 100}%`,
                        height: '100%',
                        borderRadius: 999,
                        background: 'var(--brand-primary)',
                      }}
                    />
                  </div>
                </div>
              ))}
            </Card>

            <Card
              className="soft-card"
              title="Recently Updated Reports"
              style={{ marginTop: 16 }}
              extra={
                <Button
                  variant="outlined"
                  color="primary"
                  onClick={() => navigate('/admin/incidents')}
                >
                  View All
                </Button>
              }
            >
              <List
                dataSource={recentActivity}
                split={false}
                renderItem={(report) => (
                  <List.Item style={{ paddingLeft: 0, paddingRight: 0 }}>
                    <div
                      style={{ display: 'flex', alignItems: 'flex-start', width: '100%', gap: 8 }}
                    >
                      <Text style={{ marginTop: 3, color: 'var(--text-secondary)' }}>
                        {report.status === 'resolved' ? '○' : '◌'}
                      </Text>
                      <div style={{ flex: 1 }}>
                        <Text strong>{report.category}</Text>
                        {' · '}
                        <Text type="secondary">{report.status}</Text>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                          {report.referenceNumber || report._id.slice(-6).toUpperCase()} ·{' '}
                          {new Date(report.updatedAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  </List.Item>
                )}
              />
            </Card>
          </Col>
        </Row>
      </Space>
    );
  }

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Row gutter={[16, 16]}>
        <Col xs={24} md={6}>
          <KpiCard
            label="Open incidents"
            value={openReports}
            icon={<AlertOutlined />}
            tone={openCriticalReports > 0 ? 'danger' : openHighReports > 0 ? 'warning' : 'neutral'}
            badges={[
              ...(openCriticalReports > 0
                ? [
                    {
                      text: `${openCriticalReports} critical`,
                      tone: 'danger' as const,
                      color: 'var(--severity-critical-tag)',
                      background:
                        'color-mix(in srgb, var(--severity-critical-tag) 14%, transparent)',
                    },
                  ]
                : []),
              ...(openHighReports > 0
                ? [
                    {
                      text: `${openHighReports} high`,
                      tone: 'warning' as const,
                      color: 'var(--severity-high-tag)',
                      background: 'color-mix(in srgb, var(--severity-high-tag) 14%, transparent)',
                    },
                  ]
                : []),
            ]}
            link={{ text: 'View incidents', href: '/admin/incidents' }}
          />
        </Col>
        <Col xs={24} md={6}>
          <KpiCard
            label="Total reports"
            value={analytics?.total ?? reports.length}
            icon={<FileSearchOutlined />}
            tone="accent"
            link={{ text: 'View analytics', href: '/admin/analytics' }}
          />
        </Col>
        <Col xs={24} md={6}>
          <KpiCard
            label="Unread notifications"
            value={notificationFeed?.pages[0]?.unreadCount ?? 0}
            icon={<BellOutlined />}
            tone={(notificationFeed?.pages[0]?.unreadCount ?? 0) > 0 ? 'accent' : 'neutral'}
            link={{ text: 'View notifications', href: '/admin/notifications' }}
          />
        </Col>
        <Col xs={24} md={6}>
          <KpiCard
            label="Pending resolution review"
            value={pendingResolutionReviews.length}
            icon={<CheckCircleOutlined />}
            tone={pendingResolutionReviews.length > 0 ? 'warning' : 'neutral'}
            link={{ text: 'Review resolutions', href: '/admin/incidents?status=resolved' }}
          />
        </Col>
      </Row>

      {role === 'captain' && (
        <Card
          className="soft-card"
          title={`Open incidents inactive for ${inactivityMonitor?.thresholdHours ?? 4}+ hours`}
        >
          <List
            dataSource={inactivityMonitor?.reports ?? []}
            pagination={{ pageSize: 5, hideOnSinglePage: true }}
            locale={{ emptyText: 'No open incidents have exceeded the inactivity threshold.' }}
            renderItem={(report) => (
              <IncidentCard
                report={report}
                onClick={() => navigate(`/admin/incidents/${report._id}`)}
                extra={<Text type="secondary">{report.inactiveHours}h inactive</Text>}
              />
            )}
          />
        </Card>
      )}

      <Row gutter={[24, 16]}>
        <Col xs={24} lg={12}>
          <Card
            className="soft-card"
            title="Pending resolution review"
            extra={
              <Button
                color="primary"
                variant="outlined"
                onClick={() => navigate('/admin/incidents?status=resolved')}
              >
                View all
              </Button>
            }
          >
            <List
              dataSource={pendingResolutionReviews.slice(0, 5)}
              pagination={{ pageSize: 5, hideOnSinglePage: true }}
              locale={{ emptyText: 'No resolutions are awaiting review.' }}
              renderItem={(report) => (
                <IncidentCard
                  report={report}
                  onClick={() => navigate(`/admin/incidents/${report._id}`)}
                  extra={<Text type="warning">Pending verification</Text>}
                />
              )}
            />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card
            className="soft-card"
            title="Latest incidents"
            extra={
              <Button
                color="primary"
                variant="outlined"
                onClick={() => navigate('/admin/incidents')}
              >
                View all
              </Button>
            }
          >
            {reports.length === 0 ? (
              <Text type="secondary">No incidents yet</Text>
            ) : (
              <Space direction="vertical" size={8} style={{ width: '100%' }}>
                {reports.slice(0, 5).map((report) => (
                  <IncidentCard
                    key={report._id}
                    report={report}
                    onClick={() => navigate(`/admin/incidents/${report._id}`)}
                    showSubmitter
                    showDescription
                    descriptionMaxLength={160}
                  />
                ))}
              </Space>
            )}
          </Card>
        </Col>
      </Row>
    </Space>
  );
}
