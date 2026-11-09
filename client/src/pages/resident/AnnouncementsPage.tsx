import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Alert, Card, Empty, Space, Tag, Typography } from 'antd';
import { NotificationOutlined } from '@ant-design/icons';
import { api, type BarangayAnnouncement } from '../../lib/api';
import LoadingState from '../../components/LoadingState';
import { useAntdMessage } from '../../lib/useAntdMessage';

export default function AnnouncementsPage() {
  const { id } = useParams<{ id?: string }>();
  const message = useAntdMessage();
  const queryClient = useQueryClient();
  const { data: announcements = [], isLoading, isError } = useQuery({
    queryKey: ['resident-announcements'],
    queryFn: () => api.get<BarangayAnnouncement[]>('/api/notifications/announcements'),
  });
  const markRead = useMutation({
    mutationFn: (id: string) => api.patch(`/api/notifications/${id}/read`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['resident-announcements'] }),
    onError: (error: Error) => message.error(error.message),
  });

  useEffect(() => {
    if (!id || isLoading || isError) return;
    const element = document.getElementById(`announcement-${id}`);
    element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [id, isLoading, isError, announcements]);

  if (isLoading) return <LoadingState />;
  if (isError) return <Alert type="error" showIcon message="Announcements could not be loaded." />;

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      
      {!announcements.length ? (
        <Card className="soft-card">
          <Empty description="No announcements yet" />
        </Card>
      ) : (
        announcements.map((announcement) => (
          <Card
            key={announcement.id}
            id={`announcement-${announcement.id}`}
            className="soft-card"
            title={
              <Space>
                <NotificationOutlined />
                <span>{announcement.title}</span>
                {!announcement.read && <Tag color="blue">New</Tag>}
              </Space>
            }
            extra={new Date(announcement.createdAt).toLocaleDateString()}
            onClick={() => {
              if (!announcement.read) markRead.mutate(announcement.id);
            }}
            style={{ cursor: announcement.read ? 'default' : 'pointer' }}
          >
            <Tag>{announcement.category}</Tag>
            <Typography.Paragraph style={{ whiteSpace: 'pre-wrap', marginTop: 12 }}>
              {announcement.message}
            </Typography.Paragraph>
            <Typography.Text type="secondary">
              Posted by {announcement.actorName}
            </Typography.Text>
          </Card>
        ))
      )}
    </Space>
  );
}
