import { useQuery } from '@tanstack/react-query';
import { Card, List, Space, Tag, Typography } from 'antd';
import { api, type AuditLog } from '../../lib/api';

const { Title, Paragraph, Text } = Typography;

export default function AdminAuditLogPage() {
  const { data: logs = [] } = useQuery({
    queryKey: ['admin-audit-logs'],
    queryFn: () => api.get<AuditLog[]>('/api/audit-logs'),
    refetchInterval: 30000,
  });

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Card className="soft-card page-hero">
        <Title level={2} style={{ color: '#fff', marginTop: 0 }}>
          Audit log
        </Title>
        <Paragraph style={{ color: 'rgba(255,255,255,0.82)' }}>
          Read-only access is enforced server-side according to the role matrix.
        </Paragraph>
      </Card>

      <Card className="soft-card">
        <List
          dataSource={logs}
          renderItem={(log) => (
            <List.Item>
              <List.Item.Meta
                title={
                  <Space>
                    <Text strong>{log.action}</Text>
                    <Tag>{log.actorName || log.actorUid || 'system'}</Tag>
                  </Space>
                }
                description={
                  <Space direction="vertical" size={2}>
                    <Text type="secondary">{new Date(log.timestamp).toLocaleString()}</Text>
                    <Text type="secondary">{log.userAgent || 'No user agent'}</Text>
                  </Space>
                }
              />
            </List.Item>
          )}
        />
      </Card>
    </Space>
  );
}
