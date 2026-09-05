import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, Col, Row, Statistic, Typography, Button, Space } from 'antd';
import { AlertOutlined, ArrowRightOutlined, EnvironmentOutlined, FireOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';
import { api, type Report } from '../../lib/api';
import IncidentList from '../../components/IncidentList';

const { Title, Paragraph } = Typography;

export default function ResponderDashboardPage() {
  const { data: reports = [] } = useQuery({
    queryKey: ['responder-reports'],
    queryFn: () => api.get<Report[]>('/api/reports'),
    refetchInterval: 30000,
  });

  const activeReports = useMemo(
    () => reports.filter((report) => ['verified', 'en_route', 'on_scene'].includes(report.status)),
    [reports],
  );

  const urgentReports = activeReports.filter((report) => report.category === 'Emergency Situations');

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Card className="soft-card page-hero">
        <Title level={2} style={{ color: '#fff', marginTop: 0 }}>Responder Command</Title>
        <Paragraph style={{ color: 'rgba(255,255,255,0.82)' }}>
          Field responders monitor verified incidents, route to active scenes, and close reports in the field.
        </Paragraph>
        <Button type="primary" icon={<ArrowRightOutlined />}>
          <Link to="/responder/alerts" style={{ color: 'inherit' }}>View alerts</Link>
        </Button>
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24} md={8}>
          <Card className="soft-card">
            <Statistic title="Active incidents" value={activeReports.length} prefix={<AlertOutlined />} />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card className="soft-card">
            <Statistic title="Urgent emergency calls" value={urgentReports.length} prefix={<FireOutlined />} />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card className="soft-card">
            <Statistic title="Scene-ready" value={activeReports.filter((report) => report.status === 'on_scene').length} prefix={<EnvironmentOutlined />} />
          </Card>
        </Col>
      </Row>

      <Card className="soft-card" title="Active incidents">
        <IncidentList reports={activeReports.slice(0, 10)} basePath="/responder/incidents" />
      </Card>
    </Space>
  );
}