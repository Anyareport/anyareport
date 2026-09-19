import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge, Button, Card, Empty, List, Space, Typography, message } from 'antd';
import { BellOutlined, CheckOutlined } from '@ant-design/icons';
import { api, type Notification } from '../../lib/api';
import { getSocket } from '../../lib/socket';
import PageHero from '../../components/PageHero';

const { Text } = Typography;

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

  useEffect(() => {
    const socket = getSocket();
    const handleNotification = () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    };

    socket.on('notification', handleNotification);
    return () => {
      socket.off('notification', handleNotification);
    };
  }, [queryClient]);

  const markRead = useMutation({
    mutationFn: (id: string) => api.patch(`/api/notifications/${id}/read`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
    onError: (error: Error) => message.error(error.message),
  });

  const unreadCount = notifications.filter((notification) => !notification.read).length;

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <PageHero
        title={title}
        description="Incident updates, urgent alerts, and system messages appear here."
        // icon={<BellOutlined style={{ fontSize: 32 }} />}
        badgeCount={unreadCount}
      />

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
                      <Text type="secondary">
                        {new Date(notification.createdAt).toLocaleString()}
                      </Text>
                    </Space>
                  }
                />
              </List.Item>
            )}
          />
        )}
      </Card>
    </Space>
  );
}
