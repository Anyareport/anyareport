import { useQuery } from '@tanstack/react-query';
import { Card, Col, Row, Space, Statistic, Typography } from 'antd';
import { Pie, PieChart, ResponsiveContainer, Cell, XAxis, YAxis, Tooltip, BarChart, Bar, CartesianGrid, LineChart, Line } from 'recharts';
import { api, type Analytics } from '../../lib/api';

const { Title, Paragraph } = Typography;
const COLORS = ['#E63333', '#282F49', '#5b6b9a', '#ff9f43', '#2ecc71', '#8e44ad'];

export default function AdminAnalyticsPage() {
  const { data: analytics } = useQuery({
    queryKey: ['admin-analytics'],
    queryFn: () => api.get<Analytics>('/api/reports/analytics'),
    refetchInterval: 30000,
  });

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Card className="soft-card page-hero">
        <Title level={2} style={{ color: '#fff', marginTop: 0 }}>Analytics</Title>
        <Paragraph style={{ color: 'rgba(255,255,255,0.82)' }}>
          Operational metrics for barangay-wide or committee-scoped oversight.
        </Paragraph>
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24} md={8}><Card className="soft-card"><Statistic title="Total" value={analytics?.total || 0} /></Card></Col>
        <Col xs={24} md={8}><Card className="soft-card"><Statistic title="Resolved" value={analytics?.resolved || 0} /></Card></Col>
        <Col xs={24} md={8}><Card className="soft-card"><Statistic title="Resolution rate" value={analytics?.resolutionRate || 0} suffix="%" /></Card></Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={12}>
          <Card className="soft-card" title="Category distribution">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={analytics?.byCategory || []} dataKey="count" nameKey="_id" outerRadius={100} label>
                  {(analytics?.byCategory || []).map((entry, index) => (
                    <Cell key={entry._id} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </Col>
        <Col xs={24} xl={12}>
          <Card className="soft-card" title="Status mix">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={analytics?.byStatus || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="_id" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#E63333" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>

      <Card className="soft-card" title="Last 30 days">
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={analytics?.last30Days || []}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="_id" />
            <YAxis />
            <Tooltip />
            <Line type="monotone" dataKey="count" stroke="#282F49" strokeWidth={3} />
          </LineChart>
        </ResponsiveContainer>
      </Card>
    </Space>
  );
}