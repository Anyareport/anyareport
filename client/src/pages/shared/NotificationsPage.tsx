import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge, Button, Card, Empty, Grid, List, Space, Typography, message } from 'antd';
import { CheckOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { api, type Notification } from '../../lib/api';
import { getSocket } from '../../lib/socket';
import PageHero from '../../components/PageHero';

const { Text } = Typography;

interface NotificationsPageProps {
  title: string;
}

export default function NotificationsPage({ title }: NotificationsPageProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
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
                onClick={() => {
                  if (notification.type !== 'backup_requested' || !notification.reportId) return;
                  if (!notification.read) markRead.mutate(notification._id);
                  navigate(`/responder/incidents/${notification.reportId}`);
                }}
                style={{
                  ...(notification.type === 'backup_requested' && notification.reportId
                    ? { cursor: 'pointer' }
                    : {}),
                  flexDirection: isMobile ? 'column' : 'row',
                  alignItems: isMobile ? 'stretch' : 'center',
                  gap: 12,
                  width: '100%',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                    width: '100%',
                    minWidth: 0,
                  }}
                >
                  <List.Item.Meta
                    style={{ width: '100%', minWidth: 0 }}
                    title={
                      <Space
                        wrap
                        size={[8, 4]}
                        style={{ width: '100%', minWidth: 0 }}
                      >
                        <Text
                          strong
                          style={{
                            minWidth: 0,
                            maxWidth: '100%',
                            flex: '1 1 auto',
                            whiteSpace: 'normal',
                            overflowWrap: 'anywhere',
                          }}
                        >
                          {notification.message}
                        </Text>
                        {notification.urgent && <Badge status="error" text="Urgent" />}
                      </Space>
                    }
                    description={
                      <Space direction="vertical" size={2} style={{ width: '100%' }}>
                        <Text type="secondary">{notification.type.replace(/_/g, ' ')}</Text>
                        <Text type="secondary">
                          {new Date(notification.createdAt).toLocaleString()}
                        </Text>
                      </Space>
                    }
                  />
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'flex-start',
                      width: '100%',
                      marginTop: 0,
                    }}
                  >
                    <Button
                      type={notification.read ? 'default' : 'primary'}
                      icon={<CheckOutlined />}
                      onClick={(event) => {
                        event.stopPropagation();
                        markRead.mutate(notification._id);
                      }}
                      disabled={notification.read}
                      style={{
                        minHeight: 44,
                        padding: '0 16px',
                        borderRadius: 8,
                        width: isMobile ? '100%' : undefined,
                        opacity: notification.read ? 0.6 : 1,
                        cursor: notification.read ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {notification.read ? 'Read ✓' : 'Mark read'}
                    </Button>
                  </div>
                </div>
              </List.Item>
            )}
          />
        )}
      </Card>
    </Space>
  );
}
