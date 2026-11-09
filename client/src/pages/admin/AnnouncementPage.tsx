import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Button,
  Card,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Tag,
  Typography,
  Upload,
} from 'antd';
import { DeleteOutlined, EditOutlined, SendOutlined } from '@ant-design/icons';
import { api, type AnnouncementCategory, type SecretaryAnnouncement } from '../../lib/api';
import { useAntdMessage } from '../../lib/useAntdMessage';
import { useState } from 'react';
import type { UploadFile } from 'antd';
import './AnnouncementPage.css';

interface AnnouncementValues {
  category: AnnouncementCategory;
  title: string;
  message: string;
}

const dateFormatter = new Intl.DateTimeFormat('en-PH', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

const formatDate = (value: string) => dateFormatter.format(new Date(value));

export default function AnnouncementPage() {
  const message = useAntdMessage();
  const queryClient = useQueryClient();
  const [form] = Form.useForm<AnnouncementValues>();
  const [editing, setEditing] = useState<SecretaryAnnouncement | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [imageFiles, setImageFiles] = useState<UploadFile[]>([]);

  const announcements = useQuery({
    queryKey: ['secretary-announcements'],
    queryFn: () => api.get<SecretaryAnnouncement[]>('/api/notifications/announcements/manage'),
  });

  const closeForm = () => {
    setFormOpen(false);
    setEditing(null);
    form.resetFields();
    setImageFiles([]);
  };

  const announcement = useMutation({
    mutationFn: (values: AnnouncementValues) => {
      const body = new FormData();
      body.append('category', values.category);
      body.append('title', values.title);
      body.append('message', values.message);
      imageFiles.forEach((file) => file.originFileObj && body.append('images', file.originFileObj));
      return api.post<{ recipientCount: number }>('/api/notifications/announcements', body);
    },
    onSuccess: (result) => {
      closeForm();
      queryClient.invalidateQueries({ queryKey: ['secretary-announcements'] });
      message.success(`Announcement sent to ${result.recipientCount} active residents.`);
    },
    onError: (error: Error) => message.error(error.message),
  });

  const update = useMutation({
    mutationFn: (values: AnnouncementValues) => {
      const body = new FormData();
      body.append('category', values.category);
      body.append('title', values.title);
      body.append('message', values.message);
      imageFiles.forEach((file) => file.originFileObj && body.append('images', file.originFileObj));
      return api.patch(`/api/notifications/announcements/${editing?.id}`, body);
    },
    onSuccess: () => {
      closeForm();
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

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    setFormOpen(true);
  };

  const openEdit = (announcementToEdit: SecretaryAnnouncement) => {
    setEditing(announcementToEdit);
    form.setFieldsValue({
      category: announcementToEdit.category,
      title: announcementToEdit.title,
      message: announcementToEdit.message,
    });
    setImageFiles([]);
    setFormOpen(true);
  };

  return (
    <div className="announcement-page">
      <div className="announcement-page__header">
        
        
      </div>

      <Modal
        open={formOpen}
        forceRender
        width={760}
        className="announcement-modal"
        title={editing ? 'Edit announcement' : 'Create announcement'}
        okText={editing ? 'Save changes' : 'Send announcement'}
        okButtonProps={{ icon: editing ? <EditOutlined /> : <SendOutlined /> }}
        confirmLoading={announcement.isPending || update.isPending}
        onCancel={closeForm}
        onOk={() => form.submit()}
      >
        <Alert
          type="info"
          showIcon
          message={
            editing
              ? 'Changes are saved to the announcement; residents are not notified again.'
              : 'Announcements are sent to all active resident accounts.'
          }
          style={{ marginBottom: 20 }}
        />
        <Form
          form={form}
          layout="vertical"
          onFinish={(values) => (editing ? update.mutate(values) : announcement.mutate(values))}
        >
          <div className="announcement-page__form-grid">
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
          </div>
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
          <Form.Item label="Announcement images" className="announcement-modal__images">
            <Upload
              accept="image/*"
              listType="picture-card"
              beforeUpload={() => false}
              fileList={imageFiles}
              maxCount={3}
              onChange={({ fileList }) => setImageFiles(fileList)}
              onRemove={(file) =>
                setImageFiles((files) => files.filter((item) => item.uid !== file.uid))
              }
            >
              {imageFiles.length < 3 && '+ Upload'}
            </Upload>
            <Typography.Text type="secondary">
              Optional · Up to 3 images · 5 MB each
            </Typography.Text>
          </Form.Item>
        </Form>
      </Modal>

      <section className="announcement-page__history">
        <div className="announcement-page__history-header">
            <Typography.Title level={3} className="announcement-page__section-title">
          Previous Announcements
        </Typography.Title>
        <Button type="primary" icon={<SendOutlined />} onClick={openCreate}>
          Create announcement
        </Button>
        </div>
        
        {announcements.isLoading ? (
          <Typography.Text type="secondary">Loading announcements...</Typography.Text>
        ) : announcements.isError ? (
          <Alert type="error" message="Previous announcements could not be loaded." />
        ) : !announcements.data?.length ? (
          <Typography.Text type="secondary">No previous announcements.</Typography.Text>
        ) : (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            {announcements.data.map((item) => (
              <Card
                key={item.id}
                className="soft-card announcement-page__history-card"
                styles={{ header: { minHeight: 56 }, body: { padding: 24 } }}
                title={
                  <Typography.Text strong ellipsis={{ tooltip: item.title }}>
                    {item.title}
                  </Typography.Text>
                }
                extra={<Tag className="app-tag">{item.category}</Tag>}
                actions={[
                  <Button
                    key="edit"
                    type="link"
                    icon={<EditOutlined />}
                    onClick={() => openEdit(item)}
                  >
                    Edit
                  </Button>,
                  <Button
                    key="delete"
                    type="link"
                    danger
                    icon={<DeleteOutlined />}
                    loading={remove.isPending && remove.variables === item.id}
                    onClick={() =>
                      Modal.confirm({
                        title: 'Delete this announcement?',
                        content: 'It will be removed from residents’ announcement feeds.',
                        okText: 'Delete',
                        okButtonProps: { danger: true },
                        onOk: () => remove.mutateAsync(item.id),
                      })
                    }
                  >
                    Delete
                  </Button>,
                ]}
              >
                <Typography.Paragraph
                  className="announcement-page__history-message"
                  style={{ whiteSpace: 'pre-wrap' }}
                >
                  {item.message}
                </Typography.Paragraph>
                <Typography.Text className="announcement-page__history-meta">
                  {formatDate(item.createdAt)} · {item.recipientCount} residents
                </Typography.Text>
              </Card>
            ))}
          </Space>
        )}
      </section>
    </div>
  );
}