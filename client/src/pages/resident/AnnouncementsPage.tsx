import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Alert, Card, Empty, Image, Space, Tag, Typography } from 'antd';
import { NotificationOutlined } from '@ant-design/icons';
import { api, type BarangayAnnouncement } from '../../lib/api';
import LoadingState from '../../components/LoadingState';
import { useAntdMessage } from '../../lib/useAntdMessage';
import './AnnouncementsPage.css';

const dateFormatter = new Intl.DateTimeFormat('en-PH', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

const formatDate = (value: string) => dateFormatter.format(new Date(value));

export default function AnnouncementsPage() {
  const { id: targetId } = useParams<{ id?: string }>();
  const message = useAntdMessage();
  const queryClient = useQueryClient();

  const {
    data: announcements = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['resident-announcements'],
    queryFn: () => api.get<BarangayAnnouncement[]>('/api/notifications/announcements'),
  });

  const markRead = useMutation({
    mutationFn: (announcementId: string) =>
      api.patch(`/api/notifications/${announcementId}/read`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['resident-announcements'] }),
    onError: (error: Error) => message.error(error.message),
  });

  useEffect(() => {
    if (!targetId || isLoading || isError) return;
    document
      .getElementById(`announcement-${targetId}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [targetId, isLoading, isError, announcements.length]);

  if (isLoading) return <LoadingState />;
  if (isError) return <Alert type="error" showIcon message="Announcements could not be loaded." />;



  return (
    <div className="announcement-feed">
      {!announcements.length ? (
        <Card className="soft-card">
          <Empty description="No announcements yet" />
        </Card>
      ) : (
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          {announcements.map((announcement) => {
            const unread = !announcement.read;
            const classes = [
              'soft-card',
              'announcement-feed__card',
              unread ? 'announcement-feed__card--unread' : '',
              announcement.id === targetId ? 'announcement-feed__card--target' : '',
            ]
              .filter(Boolean)
              .join(' ');

            const handleMarkRead = () => {
              if (unread && !markRead.isPending) markRead.mutate(announcement.id);
            };

            return (
              <Card
                key={announcement.id}
                id={`announcement-${announcement.id}`}
                className={classes}
                styles={{ header: { minHeight: 56 }, body: { padding: 24 } }}
                title={
                  <Space size={10} className="announcement-feed__card-title">
                    <NotificationOutlined />
                    <Typography.Text strong ellipsis={{ tooltip: announcement.title }}>
                      {announcement.title}
                    </Typography.Text>
                    {unread && <Tag color="blue">New</Tag>}
                  </Space>
                }
                extra={
                  <Tag className="app-tag" style={{ marginInlineEnd: 0 }}>
                    {announcement.category}
                  </Tag>
                }
                onClick={handleMarkRead}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleMarkRead();
                  }
                }}
                role={unread ? 'button' : undefined}
                tabIndex={unread ? 0 : undefined}
              >
                <Typography.Paragraph
                  className="announcement-feed__message"
                  style={{ whiteSpace: 'pre-wrap' }}
                >
                  {announcement.message}
                </Typography.Paragraph>

                {announcement.images.length > 0 && (
                  <div className="announcement-feed__images">
                    <Image.PreviewGroup>
                      <Space wrap size={8}>
                        {announcement.images.map((image) => (
                          <Image
                            key={image}
                            src={image}
                            width={120}
                            height={90}
                            style={{ objectFit: 'cover', borderRadius: 8 }}
                          />
                        ))}
                      </Space>
                    </Image.PreviewGroup>
                  </div>
                )}

                <Typography.Text className="announcement-feed__meta">
                  Posted by {announcement.actorName} · {formatDate(announcement.createdAt)}
                </Typography.Text>
              </Card>
            );
          })}
        </Space>
      )}
    </div>
  );
}