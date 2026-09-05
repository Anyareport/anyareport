import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge, Button, Card, Empty, List, Space, Typography, message } from 'antd';
import { BellOutlined, CheckOutlined } from '@ant-design/icons';
import { api, type Notification } from '../../lib/api';

const { Title, Text, Paragraph } = Typography;

interface NotificationsPageProps {
  title: string;
}

export default function NotificationsPage({ title }: NotificationsPageProps) {
  const queryClient = useQueryClient();
  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get<Notification[]>('/api/notifications'),
    refetchInterval: 30000,
  });

  const markRead = useMutation({
    mutationFn: (id: string) => api.patch(`/api/notifications/${id}/read`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
    onError: (error: Error) => message.error(error.message),
  });

  const unreadCount = notifications.filter((notification) => !notification.read).length;

  return (
    <div className="page-shell">
      <Card className="soft-card page-hero" style={{ marginBottom: 16 }}>
        <Space direction="vertical" size={8} style={{ width: '100%' }}>
          <Badge count={unreadCount} offset={[14, 0]}>
            <BellOutlined style={{ fontSize: 32, color: '#fff' }} />
          </Badge>
          <Title level={2} style={{ color: '#fff', margin: 0 }}>{title}</Title>
          <Paragraph style={{ color: 'rgba(255,255,255,0.82)', margin: 0 }}>
            Incident updates, urgent alerts, and system messages appear here.
          </Paragraph>
        </Space>
      </Card>

      <Card className="soft-card">
        {notifications.length === 0 ? (
          <Empty description="No notifications yet" />
        ) : (
          <List
            loading={isLoading}
            dataSource={notifications}
            renderItem={(notification) => (
              <List.Item
                actions={[
                  <Button
                    key="read"
                    type={notification.read ? 'default' : 'primary'}
                    icon={<CheckOutlined />}
                    onClick={() => markRead.mutate(notification._id)}
                    disabled={notification.read}
                  >
                    {notification.read ? 'Read' : 'Mark read'}
                  </Button>,
                ]}
              >
                <List.Item.Meta
                  title={
                    <Space>
                      <Text strong>{notification.message}</Text>
                      {notification.urgent && <Badge status="error" text="Urgent" />}
                    </Space>
                  }
                  description={
                    <Space direction="vertical" size={2}>
                      <Text type="secondary">{notification.type.replace(/_/g, ' ')}</Text>
                      <Text type="secondary">{new Date(notification.createdAt).toLocaleString()}</Text>
                    </Space>
                  }
                />
              </List.Item>
            )}
          />
        )}
      </Card>
    </div>
  );
}