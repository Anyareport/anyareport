import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, Col, Progress, Row, Space, Typography } from 'antd';
import { api, type Report } from '../../lib/api';

const { Title, Paragraph, Text } = Typography;

export default function AdminHeatmapPage() {
  const { data: reports = [] } = useQuery({
    queryKey: ['admin-heatmap-reports'],
    queryFn: () => api.get<Report[]>('/api/reports'),
    refetchInterval: 30000,
  });

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    reports.forEach((report) => map.set(report.category, (map.get(report.category) || 0) + 1));
    return Array.from(map.entries()).sort((left, right) => right[1] - left[1]);
  }, [reports]);

  const top = counts[0]?.[1] || 1;

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Card className="soft-card page-hero">
        <Title level={2} style={{ color: '#fff', marginTop: 0 }}>Heatmap</Title>
        <Paragraph style={{ color: 'rgba(255,255,255,0.82)' }}>
          Category concentration visualized as a responsive intensity map.
        </Paragraph>
      </Card>

      <Row gutter={[16, 16]}>
        {counts.map(([category, count]) => (
          <Col xs={24} md={12} key={category}>
            <Card className="soft-card">
              <Space direction="vertical" size={8} style={{ width: '100%' }}>
                <Text strong>{category}</Text>
                <Progress percent={Math.round((count / top) * 100)} strokeColor="#E63333" />
                <Text type="secondary">{count} reports</Text>
              </Space>
            </Card>
          </Col>
        ))}
      </Row>
    </Space>
  );
}