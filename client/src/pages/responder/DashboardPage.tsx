import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button, Card, Col, Row, Space, Statistic, Typography } from 'antd';
import {
  AlertOutlined,
  ArrowRightOutlined,
  EnvironmentOutlined,
  FireOutlined,
} from '@ant-design/icons';
import { Link } from 'react-router-dom';
import { api, type Report } from '../../lib/api';
import IncidentList from '../../components/IncidentList';
import { compareIncidentPriority } from '../../lib/sortUtils';
import { useAuth } from '../../contexts/AuthContext';

const { Title, Paragraph } = Typography;

export default function ResponderDashboardPage() {
  const { profile } = useAuth();

  const { data: reports = [], isLoading: reportsLoading } = useQuery({
    queryKey: ['responder-reports'],
    queryFn: () => api.get<Report[]>('/api/reports'),
    refetchInterval: 30000,
  });

  const { data: handledReports = [], isLoading: handledReportsLoading } = useQuery({
    queryKey: ['responder-handled-reports'],
    queryFn: () => api.get<Report[]>('/api/reports?handledByMe=true'),
    refetchInterval: 30000,
  });

  const myActiveReports = useMemo(
    () =>
      handledReports.filter(
        (report) => report.status !== 'resolved'
      ),
    [handledReports]
  );

  

  const activeReports = useMemo(
    () =>
      reports
        .filter(
          (report) =>
            report.status === 'pending' &&
            ['Emergency Situations', 'Public Concerns'].includes(report.category)
        )
        .sort(compareIncidentPriority),
    [reports]
  );
  const otherIncidents = useMemo(
    () =>
      reports
        .filter(
          (report) =>
            report.acknowledgedBy &&
            report.acknowledgedBy !== profile?.firebaseUid &&
            report.status !== 'resolved' &&
            (report.backupRequests || []).some((request) => request.status === 'pending')
        )
        .sort(compareIncidentPriority),
    [profile?.firebaseUid, reports]
  );

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Card className="soft-card page-hero">
        <Title level={2} style={{ marginTop: 0 }}>
          Responder Command
        </Title>
        <Paragraph>
          Field responders monitor verified incidents, route to active scenes, and close reports in
          the field.
        </Paragraph>
        <Button type="primary" icon={<ArrowRightOutlined />}>
          <Link to="/responder/alerts" style={{ color: 'inherit' }}>
            View alerts
          </Link>
        </Button>
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24} md={8}>
          <Card className="soft-card">
            <Statistic
              title="Active incidents"
              value={activeReports.length}
              prefix={<AlertOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card className="soft-card">
            <Statistic
              title="Backup requests"
              value={otherIncidents.length}
              prefix={<FireOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card className="soft-card">
            <Statistic
              title="Scene-ready"
              value={myActiveReports.filter((report) => report.status === 'on_scene').length}
              prefix={<EnvironmentOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Card className="soft-card" title="My handled incidents">
        <IncidentList
          reports={myActiveReports.slice(0, 5)}
          loading={handledReportsLoading}
          basePath="/responder/incidents"
        />
      </Card>
      <Card className="soft-card" title="Backup requests">
        <IncidentList
          reports={otherIncidents.slice(0, 5)}
          loading={reportsLoading}
          basePath="/responder/incidents"
        />
      </Card>
    </Space>
  );
}
