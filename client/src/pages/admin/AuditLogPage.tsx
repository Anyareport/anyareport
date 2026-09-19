import { useQuery } from '@tanstack/react-query';
import { Card, List, Space, Tag, Typography } from 'antd';
import { api, type AuditLog } from '../../lib/api';
import PageHero from '../../components/PageHero';

const { Text } = Typography;

export default function AdminAuditLogPage() {
  const { data: logs = [] } = useQuery({
    queryKey: ['admin-audit-logs'],
    queryFn: () => api.get<AuditLog[]>('/api/audit-logs'),
    refetchInterval: 30000,
  });

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <PageHero
        title="Audit log"
        description="Read-only access is enforced server-side according to the role matrix."
      />

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
