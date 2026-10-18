import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button, Card, Col, List, Row, Space, Tag, Typography } from 'antd';

import Icon, {
  AlertOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  InboxOutlined,
  StopOutlined,
  TeamOutlined,
  FileSearchOutlined,

} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { api, type Analytics, type AuditLog, type Report } from '../../lib/api';
import IncidentCard from '../../components/IncidentCard';
import IncidentList from '../../components/IncidentList';
import KpiCard from '../../components/KpiCard';
import PurokBreakdownCard from '../../components/PurokBreakdownCard';
import RecentActivityPanel from '../../components/RecentActivityPanel';
import { useAuth } from '../../contexts/AuthContext';
import { useNotificationFeed } from '../../lib/notificationFeed';

const { Text } = Typography;

interface UserSummary {
  total: number;
  active: number;
  suspended: number;
}

// @ant-design/icons has no "user-check" glyph, so this is a small inline SVG
// (Lucide "user-check", ISC) wrapped in antd's <Icon> so it matches the other icons.
const UserCheckSvg = () => (
  <svg
    viewBox="0 0 24 24"
    width="1em"
    height="1em"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="m16 11 2 2 4-4" />
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
  </svg>
);

const UserCheckIcon = () => <Icon component={UserCheckSvg} />;

const ACTION_LABELS: Record<string, string> = {
  official_created: 'Official created',
  user_role_changed: 'Role changed',
  user_status_changed: 'Account status changed',
  report_submitted: 'Report submitted',
  report_classified: 'Report classified',
  report_flagged: 'Report flagged',
  report_recipients_notified: 'Responders notified',
  resolution_submitted: 'Resolution submitted',
  hotline_opened: 'Hotline opened',
};

function getActionLabel(action: string) {
  if (ACTION_LABELS[action]) return ACTION_LABELS[action];
  const text = action.replace(/_/g, ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function getActionColor(action: string) {
  if (['official_created', 'user_role_changed', 'user_status_changed'].includes(action)) {
    return 'geekblue';
  }
  if (action === 'report_flagged') return 'red';
  if (action === 'report_submitted') return 'green';
  return undefined;
}

// What the entry was about: the affected account, or the report reference.
function getAuditSubject(log: AuditLog) {
  const meta = log.metadata || {};
  const target = typeof meta.targetName === 'string' ? meta.targetName : '';
  if (!target) return log.reportReferenceNumber || '';
  const from = typeof meta.from === 'string' ? meta.from : '';
  const to = typeof meta.to === 'string' ? meta.to : '';
  return from && to ? `${target}: ${from} → ${to}` : target;
}

function formatAuditTime(timestamp: string, now: number) {
  const elapsed = now - new Date(timestamp).getTime();
  if (!Number.isFinite(elapsed) || elapsed < 60_000) return 'Just now';
  if (elapsed < 3_600_000) return `${Math.floor(elapsed / 60_000)} min ago`;
  if (elapsed < 86_400_000) return `${Math.floor(elapsed / 3_600_000)} h ago`;
  if (elapsed < 7 * 86_400_000) return `${Math.floor(elapsed / 86_400_000)} d ago`;
  return new Date(timestamp).toLocaleDateString();
}

const isOpenReport = (report: Report) => !['resolved', 'flagged'].includes(report.status);

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

  const isAdmin = role === 'admin';
  const { data: userSummary, isLoading: userSummaryLoading } = useQuery({
    queryKey: ['admin-dashboard-user-summary'],
    queryFn: () => api.get<UserSummary>('/api/admin/users/summary'),
    enabled: isAdmin,
    refetchInterval: 30000,
  });

  const { data: auditLogs = [], dataUpdatedAt: auditUpdatedAt } = useQuery({
    queryKey: ['admin-audit-logs'],
    queryFn: () => api.get<AuditLog[]>('/api/audit-logs'),
    enabled: isAdmin,
    refetchInterval: 30000,
  });

  const openReports = reports.filter(isOpenReport).length;
  const openCriticalReports = reports.filter(
    (report) => isOpenReport(report) && report.severity === 'Critical'
  ).length;
  const openHighReports = reports.filter(
    (report) => isOpenReport(report) && report.severity === 'High'
  ).length;

  const pendingResolutionReviews = useMemo(
    () =>
      reports.filter(
        (report) =>
          report.status === 'resolved' && report.resolution?.verificationStatus === 'pending'
      ),
    [reports]
  );


  const reportsThisMonth = useMemo(() => {
    const monthStart = new Date();
    monthStart.setHours(0, 0, 0, 0);
    monthStart.setDate(1);
    return reports.filter((report) => new Date(report.createdAt).getTime() >= monthStart.getTime());
  }, [reports]);

  
  const resolvedThisMonth = useMemo(
    () =>
      reportsThisMonth.filter(
        (report) => report.status === 'resolved' && report.resolution?.resolvedAt
      ).length,
    [reportsThisMonth]
  );

  const secretaryQueue = useMemo(
    () =>
      [...reports]
        .filter((report) => report.status === 'pending')
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
    [reports]
  );

  const captainAttention = useMemo(
    () =>
      [...(inactivityMonitor?.reports ?? [])]
        .sort((left, right) => {
          const leftCritical = left.severity === 'Critical' ? 0 : 1;
          const rightCritical = right.severity === 'Critical' ? 0 : 1;
          if (leftCritical !== rightCritical) return leftCritical - rightCritical;
          return right.inactiveHours - left.inactiveHours;
        })
        .slice(0, 6),
    [inactivityMonitor?.reports]
  );

  const sortedPendingReviews = useMemo(
    () =>
      [...pendingResolutionReviews].sort((left, right) => {
        const leftCritical = left.severity === 'Critical' ? 0 : 1;
        const rightCritical = right.severity === 'Critical' ? 0 : 1;
        if (leftCritical !== rightCritical) return leftCritical - rightCritical;
        return (
          new Date(left.resolution?.resolvedAt ?? left.updatedAt).getTime() -
          new Date(right.resolution?.resolvedAt ?? right.updatedAt).getTime()
        );
      }),
    [pendingResolutionReviews]
  );

  const recentNotifications = (notificationFeed?.pages.flatMap((page) => page.items) ?? []).slice(
    0,
    4
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
    return isOpenReport(report) && ageDays >= 7;
  }).length;

  const resolvedPercent =
    reportsThisMonth.length > 0
      ? Math.round((resolvedThisMonth / reportsThisMonth.length) * 100)
      : 0;

  const severityBadges = [
    ...(openCriticalReports > 0
      ? [{ text: `${openCriticalReports} critical`, tone: 'danger' as const }]
      : []),
    ...(openHighReports > 0 ? [{ text: `${openHighReports} high`, tone: 'warning' as const }] : []),
  ];
  const openTone = openCriticalReports > 0 ? 'danger' : openHighReports > 0 ? 'warning' : 'neutral';

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
              tone={openTone}
              badges={severityBadges}
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
                <Button color="primary" variant="outlined" onClick={() => navigate('/admin/intake')}>
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
              {/* FIX: empty state (card used to render blank) */}
              {categoryCounts.length === 0 ? (
                <Text type="secondary">No reports filed this month.</Text>
              ) : (
                categoryCounts.map(({ category, count }) => (
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
                ))
              )}
            </Card>

            <div style={{ marginTop: 16 }}>
              <RecentActivityPanel
                items={recentNotifications}
                role={role}
                onOpenReport={(reportId) => navigate(`/admin/incidents/${reportId}`)}
                onViewAll={() => navigate('/admin/notifications')}
              />
            </div>
          </Col>
        </Row>
      </Space>
    );
  }

  if (role === 'captain') {
    const captainPuroks = [...(analytics?.byPurok ?? [])]
      .sort((left, right) => right.count - left.count)
      .slice(0, 4);
    const inactiveCriticalCount = (inactivityMonitor?.reports ?? []).filter(
      (report) => report.severity === 'Critical'
    ).length;
    const weekStart = new Date();
    weekStart.setHours(0, 0, 0, 0);
    weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
    const resolvedThisWeek = reports.filter(
      (report) =>
        report.resolution?.verificationStatus === 'verified' &&
        report.resolution.verifiedAt &&
        new Date(report.resolution.verifiedAt).getTime() >= weekStart.getTime()
    ).length;

    return (
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} xl={6}>
            <KpiCard
              label="Open incidents"
              value={openReports}
              icon={<AlertOutlined />}
              tone={openTone}
              badges={severityBadges}
              link={{ text: 'View incidents', href: '/admin/incidents?scope=open' }}
            />
          </Col>
          <Col xs={24} sm={12} xl={6}>
            <KpiCard
              label="Awaiting your review"
              value={pendingResolutionReviews.length}
              icon={<CheckCircleOutlined />}
              tone={pendingResolutionReviews.length > 0 ? 'warning' : 'neutral'}
              helper="Pending resolution verification"
              link={{
                text: 'Review resolutions',
                href: '/admin/incidents?status=resolved&verification=pending',
              }}
            />
          </Col>
          <Col xs={24} sm={12} xl={6}>
            <KpiCard
              label={`Inactive ${inactivityMonitor?.thresholdHours ?? 4}+ hours`}
              value={inactivityMonitor?.reports.length ?? 0}
              icon={<ClockCircleOutlined />}
              tone={(inactivityMonitor?.reports.length ?? 0) > 0 ? 'medium' : 'neutral'}
              helper={
                inactiveCriticalCount > 0
                  ? `${inactiveCriticalCount} are critical`
                  : 'No critical inactive cases'
              }
              link={{ text: 'Check inactive cases', href: '/admin/incidents?scope=inactive' }}
            />
          </Col>
          <Col xs={24} sm={12} xl={6}>
            <KpiCard
              label="Verified resolutions this week"
              value={resolvedThisWeek}
              icon={<CheckCircleOutlined />}
              tone="success"
              helper="Since Monday"
              link={{
                text: 'View verified',
                href: '/admin/incidents?status=resolved&verification=verified&verifiedPeriod=week',
              }}
            />
          </Col>
        </Row>

        {/* FIX: Cards were direct children of <Row>, so they shrank to content width.
            They're full-width blocks, so they now sit directly in the Space. */}
        <Card
          className="soft-card"
          title="Needs your attention"
          extra={
            <Button variant="outlined" color="primary" onClick={() => navigate('/admin/incidents')}>
              View incidents
            </Button>
          }
        >
          <IncidentList
            reports={captainAttention}
            layout="responsive"
            compact
            showSubmitter={false}
            pagination={{pageSize: 3}}
            onRowClick={(id) => navigate(`/admin/incidents/${id}`)}
            extraColumns={[
              {
                title: 'Waiting',
                key: 'captainWaiting',
                width: 140,
                render: (report) => {
                  const item = captainAttention.find((entry) => entry._id === report._id);
                  if (!item) return null;

                  return (
                    <Text type="secondary" style={{ whiteSpace: 'nowrap' }}>
                      {`${item.inactiveHours}h inactive`}
                    </Text>
                  );
                },
              }
              
            ]}
          />
        </Card>

        <Card
          className="soft-card"
          title="Pending resolution review"
          extra={
            <Button
              color="primary"
              variant="outlined"
              onClick={() => navigate('/admin/incidents?status=resolved&verification=pending')}
            >
              View all
            </Button>
          }
        >
          <IncidentList
            reports={sortedPendingReviews}
            layout="responsive"
            pagination={{pageSize: 3}}
            compact
            showSubmitter={false}
            onRowClick={(id) => navigate(`/admin/incidents/${id}`)}
            extraColumns={[
              {
                title: 'Waiting',
                key: 'reviewWaiting',
                width: 140,
                render: (report) => (
                  <Text type="secondary" style={{ whiteSpace: 'nowrap' }}>
                    {`Since ${new Date(
                      report.resolution?.resolvedAt ?? report.updatedAt
                    ).toLocaleDateString()}`}
                  </Text>
                ),
              },
              {
                title: 'Action',
                key: 'reviewAction',
                width: 110,
                align: 'right',
                render: (report) => (
                  <Button
                    color="primary"
                    variant="solid"
                    size="small"
                    onClick={(event) => {
                      event.stopPropagation();
                      navigate(`/admin/incidents/${report._id}`);
                    }}
                  >
                    Verify
                  </Button>
                ),
              },
            ]}
          />
        </Card>

        <Row gutter={[16, 16]} align="top">
          <Col xs={24} lg={12}>
            <PurokBreakdownCard
              data={captainPuroks}
              title="Reports by purok"
              actionLabel="Open heatmap"
              onViewHeatmap={() => navigate('/admin/heatmap')}
            />
          </Col>
          <Col xs={24} lg={12}>
            <RecentActivityPanel
              items={recentNotifications}
              role={role}
              onOpenReport={(reportId) => navigate(`/admin/incidents/${reportId}`)}
              onViewAll={() => navigate('/admin/notifications')}
            />
          </Col>
        </Row>
      </Space>
    );
  }

  const totalUsers = userSummary?.total ?? 0;
  const activeUsers = userSummary?.active ?? 0;
  const suspendedUsers = userSummary?.suspended ?? 0;

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Row gutter={[16, 16]}>
        <Col xs={24} md={6}>
        <KpiCard
            label="Total reports"
            value={analytics?.total ?? reports.length}
            icon={<FileSearchOutlined />}
            tone="accent"
            link={{ text: 'View analytics', href: '/admin/analytics' }}
            helper="Total reports filed in the system"
          />
        </Col>
        <Col xs={24} md={6}>
          <KpiCard
            label="Total users"
            value={totalUsers}
            icon={<TeamOutlined />}
            tone="accent"
            loading={userSummaryLoading}
            helper="All registered accounts"
            link={{ text: 'Manage users', href: '/admin/users' }}
          />
        </Col>
        <Col xs={24} md={6}>
          <KpiCard
            label="Active accounts"
            value={activeUsers}
            icon={<UserCheckIcon />}
            tone="success"
            loading={userSummaryLoading}
            helper="Enabled accounts, not currently online users"
            link={{ text: 'Manage users', href: '/admin/users' }}
          />
        </Col>
        <Col xs={24} md={6}>
          {/* Account approval isn't implemented (status is only 'active' | 'suspended'),
              so there is no "Pending accounts" card; suspended accounts is shown instead. */}
          <KpiCard
            label="Suspended accounts"
            value={suspendedUsers}
            icon={<StopOutlined />}
            tone={suspendedUsers > 0 ? 'warning' : 'neutral'}
            loading={userSummaryLoading}
            helper="Cannot submit reports or receive alerts"
            link={{ text: 'Review suspended', href: '/admin/users?status=suspended' }}
          />
        </Col>
      </Row>

      <Card
        className="soft-card"
        title="Latest audit trail"
        extra={
          <Button color="primary" variant="outlined" onClick={() => navigate('/admin/audit')}>
            View all
          </Button>
        }
      >
        <List
          dataSource={auditLogs.slice(0, 6)}
          locale={{ emptyText: 'No audit activity yet' }}
          renderItem={(log) => (
            <List.Item>
              <List.Item.Meta
                title={
                  <Space size={8} wrap>
                    <Tag color={getActionColor(log.action)} style={{ marginInlineEnd: 0 }}>
                      {getActionLabel(log.action)}
                    </Tag>
                    <Text>{getAuditSubject(log)}</Text>
                  </Space>
                }
                description={`By ${log.actorName || log.actorUid || 'system'}`}
              />
              <Text type="secondary" title={new Date(log.timestamp).toLocaleString()}>
                {formatAuditTime(log.timestamp, auditUpdatedAt)}
              </Text>
            </List.Item>
          )}
        />
      </Card>
    </Space>
  );
}