import { useQuery } from '@tanstack/react-query';
import { Card, Col, Row, Select, Space, Statistic, theme } from 'antd';
import { useState } from 'react';
import {
  Pie,
  PieChart,
  ResponsiveContainer,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  CartesianGrid,
  LineChart,
  Line,
} from 'recharts';
import { api, type Analytics } from '../../lib/api';

const COLORS = ['#E63333', '#5b6b9a', '#ff9f43', '#2ecc71', '#8e44ad', '#06b6d4'];

export default function AdminAnalyticsPage() {
  const [period, setPeriod] = useState<'all' | 'week' | 'month' | 'year'>('month');
  const { data: analytics } = useQuery({
    queryKey: ['admin-analytics', period],
    queryFn: () => api.get<Analytics>(`/api/reports/analytics?period=${period}`),
    refetchInterval: 30000,
  });

  // Use Ant Design token so chart axis/grid colors adapt to dark mode
  const { token } = theme.useToken();
  const axisColor = token.colorTextTertiary;
  const gridColor = token.colorBorderSecondary;

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Row justify="start">
        <Select
          aria-label="Analytics period"
          value={period}
          style={{ width: 200 }}
          onChange={setPeriod}
          options={[
            { value: 'all', label: 'All' },
            { value: 'week', label: 'Weekly' },
            { value: 'month', label: 'Monthly' },
            { value: 'year', label: 'Yearly' },
          ]}
        />
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} md={8}>
          <Card className="soft-card">
            <Statistic title="Total" value={analytics?.total || 0} />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card className="soft-card">
            <Statistic title="Resolved" value={analytics?.resolved || 0} />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card className="soft-card">
            <Statistic title="Resolution rate" value={analytics?.resolutionRate || 0} suffix="%" />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={12}>
          <Card className="soft-card" title="Category distribution">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={analytics?.byCategory || []}
                  dataKey="count"
                  nameKey="_id"
                  outerRadius={100}
                  label
                >
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
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                <XAxis dataKey="_id" tick={{ fill: axisColor }} />
                <YAxis tick={{ fill: axisColor }} />
                <Tooltip />
                <Bar dataKey="count" fill={COLORS[0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>

      <Card
        className="soft-card"
        title={
          period === 'all'
            ? 'All time'
            : period === 'week'
              ? 'Last 7 days'
              : period === 'year'
                ? 'Last 365 days'
                : 'Last 30 days'
        }
      >
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={analytics?.last30Days || []}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
            <XAxis dataKey="_id" tick={{ fill: axisColor }} />
            <YAxis tick={{ fill: axisColor }} />
            <Tooltip />
            <Line type="monotone" dataKey="count" stroke={COLORS[0]} strokeWidth={3} />
          </LineChart>
        </ResponsiveContainer>
      </Card>
    </Space>
  );
}
