import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Card, Form, Input, Modal, Select, Space, Tag, Typography } from 'antd';
import { DeleteOutlined, EditOutlined, SendOutlined } from '@ant-design/icons';
import { api, type AnnouncementCategory, type SecretaryAnnouncement } from '../../lib/api';
import { useAntdMessage } from '../../lib/useAntdMessage';
import { useState } from 'react';

interface AnnouncementValues {
  category: AnnouncementCategory;
  title: string;
  message: string;
}

export default function AnnouncementPage() {
  const message = useAntdMessage();
  const queryClient = useQueryClient();
  const [form] = Form.useForm<AnnouncementValues>();
  const [editing, setEditing] = useState<SecretaryAnnouncement | null>(null);
  const announcements = useQuery({
    queryKey: ['secretary-announcements'],
    queryFn: () => api.get<SecretaryAnnouncement[]>('/api/notifications/announcements/manage'),
  });
  const announcement = useMutation({
    mutationFn: (values: AnnouncementValues) =>
      api.post<{ recipientCount: number }>('/api/notifications/announcements', values),
    onSuccess: (result) => {
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: ['secretary-announcements'] });
      message.success(`Announcement sent to ${result.recipientCount} active residents.`);
    },
    onError: (error: Error) => message.error(error.message),
  });
  const update = useMutation({
    mutationFn: (values: AnnouncementValues) =>
      api.patch(`/api/notifications/announcements/${editing?.id}`, values),
    onSuccess: () => {
      setEditing(null);
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: ['secretary-announcements'] });
      message.success('Announcement updated.');
    },
    onError: (error: Error) => message.error(error.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/api/notifications/announcements/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['secretary-announcements'] });
      message.success('Announcement deleted.');
    },
    onError: (error: Error) => message.error(error.message),
  });

  const openEdit = (announcementToEdit: SecretaryAnnouncement) => {
    setEditing(announcementToEdit);
    form.setFieldsValue(announcementToEdit);
  };

  return (
    <Space direction="vertical" size="large" style={{ display: 'flex', maxWidth: 760 }}>
      <div>
        <Typography.Title level={2}>Barangay announcements</Typography.Title>
        <Typography.Paragraph type="secondary">
          Share public updates such as SK programs, TUPAD payout schedules, and other barangay
          activities with all active residents.
        </Typography.Paragraph>
      </div>
      <Alert
        type="info"
        showIcon
        message="Announcements are sent to all active resident accounts."
      />
      <Card className="soft-card">
        <Form
          form={form}
          layout="vertical"
          onFinish={(values) => (editing ? update.mutate(values) : announcement.mutate(values))}
        >
          <Form.Item
            name="category"
            label="Announcement type"
            rules={[{ required: true, message: 'Select an announcement type.' }]}
          >
            <Select
              placeholder="Select announcement type"
              options={[
                { value: 'SK Programs', label: 'SK Programs' },
                { value: 'TUPAD Payout', label: 'TUPAD Payout' },
                { value: 'Other', label: 'Other barangay update' },
              ]}
            />
          </Form.Item>
          <Form.Item
            name="title"
            label="Title"
            rules={[{ required: true, whitespace: true, min: 3, max: 120 }]}
          >
            <Input placeholder="Example: TUPAD payout schedule" maxLength={120} showCount />
          </Form.Item>
          <Form.Item
            name="message"
            label="Announcement details"
            rules={[{ required: true, whitespace: true, min: 10, max: 2000 }]}
          >
            <Input.TextArea
              rows={7}
              maxLength={2000}
              showCount
              placeholder="Include the date, time, venue, eligibility, or other important details."
            />
          </Form.Item>
          <Button
            type="primary"
            htmlType="submit"
            icon={editing ? <EditOutlined /> : <SendOutlined />}
            loading={announcement.isPending || update.isPending}
          >
            {editing ? 'Save changes' : 'Send announcement'}
          </Button>
          {editing && (
            <Button
              onClick={() => {
                setEditing(null);
                form.resetFields();
              }}
            >
              Cancel editing
            </Button>
          )}
        </Form>
      </Card>
      <div>
        <Typography.Title level={3}>Previous announcements</Typography.Title>
        {announcements.isLoading ? (
          <Typography.Text type="secondary">Loading announcements...</Typography.Text>
        ) : announcements.isError ? (
          <Alert type="error" message="Previous announcements could not be loaded." />
        ) : !announcements.data?.length ? (
          <Typography.Text type="secondary">No previous announcements.</Typography.Text>
        ) : (
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            {announcements.data.map((item) => (
              <Card
                key={item.id}
                className="soft-card"
                title={item.title}
                extra={<Tag>{item.category}</Tag>}
                actions={[
                  <Button type="link" icon={<EditOutlined />} onClick={() => openEdit(item)}>
                    Edit
                  </Button>,
                  <Button
                    type="link"
                    danger
                    icon={<DeleteOutlined />}
                    loading={remove.isPending}
                    onClick={() =>
                      Modal.confirm({
                        title: 'Delete this announcement?',
                        content: 'It will be removed from residents’ announcement feeds.',
                        okText: 'Delete',
                        okButtonProps: { danger: true },
                        onOk: () => remove.mutate(item.id),
                      })
                    }
                  >
                    Delete
                  </Button>,
                ]}
              >
                <Typography.Paragraph style={{ whiteSpace: 'pre-wrap' }}>
                  {item.message}
                </Typography.Paragraph>
                <Typography.Text type="secondary">
                  {new Date(item.createdAt).toLocaleString()} · {item.recipientCount} residents
                </Typography.Text>
              </Card>
            ))}
          </Space>
        )}
      </div>
    </Space>
  );
}
