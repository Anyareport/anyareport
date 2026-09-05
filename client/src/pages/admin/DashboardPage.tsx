import { useQuery } from '@tanstack/react-query';
import { Card, Col, Row, Statistic, Space, Typography } from 'antd';
import { api, type Analytics, type Notification, type Report } from '../../lib/api';
import { adminDashboardRoles } from '../../lib/roles';

const { Title, Paragraph, Text } = Typography;

export default function AdminDashboardPage() {
  const { data: analytics } = useQuery({
    queryKey: ['admin-dashboard-analytics'],
    queryFn: () => api.get<Analytics>('/api/reports/analytics'),
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

  const openReports = reports.filter((report) => report.status !== 'resolved').length;

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Card className="soft-card page-hero">
        <Title level={2} style={{ color: '#fff', marginTop: 0 }}>Administrative dashboard</Title>
        <Paragraph style={{ color: 'rgba(255,255,255,0.82)' }}>
          Shared oversight for {adminDashboardRoles.length} roles, with committee scoping enforced server-side.
        </Paragraph>
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24} md={8}>
          <Card className="soft-card"><Statistic title="Open incidents" value={openReports} /></Card>
        </Col>
        <Col xs={24} md={8}>
          <Card className="soft-card"><Statistic title="Total reports" value={analytics?.total ?? reports.length} /></Card>
        </Col>
        <Col xs={24} md={8}>
          <Card className="soft-card"><Statistic title="Unread notifications" value={notifications.filter((n) => !n.read).length} /></Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={16}>
          <Card className="soft-card" title="Latest incidents">
            <Text type="secondary">Use the incidents section for the full table/card view.</Text>
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