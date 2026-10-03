import { useQuery } from '@tanstack/react-query';
import { Card, Col, Row, Statistic, Space, Typography, List, Button } from 'antd';
import { useNavigate } from 'react-router-dom';
import { api, type Analytics, type Notification, type Report } from '../../lib/api';
import { adminDashboardRoles } from '../../lib/roles';
import IncidentCard from '../../components/IncidentCard';
import PageHero from '../../components/PageHero';
import { useAuth } from '../../contexts/AuthContext';

const { Text } = Typography;

export default function AdminDashboardPage() {
  const navigate = useNavigate();
  const { role } = useAuth();
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

  const { data: notifications = [] } = useQuery({
    queryKey: ['admin-dashboard-notifications'],
    queryFn: () => api.get<Notification[]>('/api/notifications'),
    refetchInterval: 30000,
  });

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

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <PageHero
        title="Administrative dashboard"
        description={`Shared oversight for ${adminDashboardRoles.length} roles, with committee scoping enforced server-side.`}
      />

      <Row gutter={[16, 16]}>
        <Col xs={24} md={8}>
          <Card className="soft-card">
            <Statistic title="Open incidents" value={openReports} />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card className="soft-card">
            <Statistic title="Total reports" value={analytics?.total ?? reports.length} />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card className="soft-card">
            <Statistic
              title="Unread notifications"
              value={notifications.filter((n) => !n.read).length}
            />
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

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={16}>
          <Card
            className="soft-card"
            title="Latest incidents"
            extra={
              <Button
                style={{ margin: 0, padding: 0 }}
                type="link"
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
        <Col xs={24} xl={8}>
          <Card className="soft-card" title="Quick status">
            <Space direction="vertical" size={8}>
              <Text type="secondary">Resolved: {analytics?.resolved ?? 0}</Text>
              <Text type="secondary">Pending: {analytics?.pending ?? 0}</Text>
              <Text type="secondary">Resolution rate: {analytics?.resolutionRate ?? 0}%</Text>
            </Space>
          </Card>
        </Col>
      </Row>
    </Space>
  );
}
