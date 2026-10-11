import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, Col, Row, Statistic, Space, Typography, List, Button } from 'antd';
import { useNavigate } from 'react-router-dom';
import { api, type Analytics, type Report } from '../../lib/api';
import IncidentCard from '../../components/IncidentCard';
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

  if (isSecretary) {
    return (
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} xl={6}>
            <Card className="soft-card">
              <Statistic title="Pending intake" value={secretaryQueue.length} />
              <Text type="secondary">Reports waiting to be reviewed</Text>
            </Card>
          </Col>
          <Col xs={24} sm={12} xl={6}>
            <Card className="soft-card">
              <Statistic title="Open incidents" value={openReports} />
              <Text type="secondary">
                {openCriticalReports} critical · {openHighReports} high
              </Text>
            </Card>
          </Col>
          <Col xs={24} sm={12} xl={6}>
            <Card className="soft-card">
              <Statistic
                title="Open reports not updated in 7 days"
                value={
                  reports.filter((report) => {
                    const ageDays =
                      (Date.now() - new Date(report.updatedAt).getTime()) / (1000 * 60 * 60 * 24);
                    return report.status !== 'resolved' && ageDays >= 7;
                  }).length
                }
              />
              <Text type="secondary">Check these cases</Text>
            </Card>
          </Col>
          <Col xs={24} sm={12} xl={6}>
            <Card className="soft-card">
              <Statistic title="Resolved this month" value={resolvedThisMonth} />
              <Text type="secondary">of {reportsThisMonth.length} reports submitted</Text>
            </Card>
          </Col>
        </Row>

        <Row gutter={[16, 16]} align="top">
          <Col xs={24} xl={16}>
            <Card
              className="soft-card"
              title="Pending intake"
              extra={
                <Button type="primary" variant="outlined" onClick={() => navigate('/admin/intake')}>
                  Open Intake Queue
                </Button>
              }
            >
              {secretaryQueue.length === 0 ? (
                <Text type="secondary">No open cases need action.</Text>
              ) : (
                <Space direction="vertical" size={6} style={{ width: '100%' }}>
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
              title="Report categories this month"
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
              title="Recently updated reports"
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
          <Card className="soft-card">
            <Statistic title="Open incidents" value={openReports} />
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card className="soft-card">
            <Statistic title="Total reports" value={analytics?.total ?? reports.length} />
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card className="soft-card">
            <Statistic
              title="Unread notifications"
              value={notificationFeed?.pages[0]?.unreadCount ?? 0}
            />
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card className="soft-card">
            <Statistic title="Pending resolution review" value={pendingResolutionReviews.length} />
          </Card>
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
