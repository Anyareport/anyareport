import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { Alert, Card, Empty, Image, Space, Tag, Typography } from 'antd';
import {NotificationOutlined } from '@ant-design/icons';
import { useParams } from 'react-router-dom';
import { api, type BarangayAnnouncement } from '../../lib/api';
import LoadingState from '../../components/LoadingState';
import { useAntdMessage } from '../../lib/useAntdMessage';
import './AnnouncementsPage.css';

const dateFormatter = new Intl.DateTimeFormat('en-PH', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

const formatDate = (value: string) => dateFormatter.format(new Date(value));

export default function AnnouncementDetailPage() {
  const { id } = useParams<{ id: string }>();
  const message = useAntdMessage();
  const queryClient = useQueryClient();

  const announcements = useQuery({
    queryKey: ['resident-announcements'],
    queryFn: () => api.get<BarangayAnnouncement[]>('/api/notifications/announcements'),
  });

  const { mutate: markReadAnnouncement } = useMutation({
    mutationFn: (announcementId: string) =>
      api.patch(`/api/notifications/${announcementId}/read`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['resident-announcements'] }),
    onError: (error: Error) => message.error(error.message),
  });

  const announcement = announcements.data?.find((item) => item.id === id);

  useEffect(() => {
    if (announcement && !announcement.read) markReadAnnouncement(announcement.id);
  }, [announcement, markReadAnnouncement]);

  if (announcements.isLoading) return <LoadingState />;
  if (announcements.isError) {
    return <Alert type="error" showIcon message="Announcement could not be loaded." />;
  }

  if (!announcement) {
    return (
      <Card className="soft-card">
        <Empty description="Announcement not found"/>
          
       
      </Card>
    );
  }

  return (
    <div className="announcement-feed">
     
      <Card
        className="soft-card announcement-feed__card"
        styles={{ header: { minHeight: 56 }, body: { padding: 24 } }}
        title={
          <Space size={10} className="announcement-feed__card-title">
            <NotificationOutlined />
            <Typography.Text strong>{announcement.title}</Typography.Text>
          </Space>
        }
        extra={
          <Tag className="app-tag" style={{ marginInlineEnd: 0 }}>
            {announcement.category}
          </Tag>
        }
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
    </div>
  );
}
