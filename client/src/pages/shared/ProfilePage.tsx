import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button, Card, Col, Form, Input, Row, Space, Tag, Typography, message } from 'antd';
import { api } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { getRoleLabel } from '../../lib/roles';

const { Text, Paragraph } = Typography;

interface ProfilePageProps {
  title: string;
}

export default function ProfilePage({ title }: ProfilePageProps) {
  const { profile, refreshProfile } = useAuth();
  const [form] = Form.useForm();
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (profile) {
      form.setFieldsValue({
        name: profile.name,
        phone: profile.phone,
        address: profile.address,
      });
    }
  }, [form, profile]);

  const updateMutation = useMutation({
    mutationFn: (values: { name: string; phone: string; address?: string }) =>
      api.patch('/api/auth/profile', values),
    onSuccess: async () => {
      message.success('Profile updated');
      await refreshProfile();
      setEditing(false);
    },
    onError: (error: Error) => message.error(error.message),
  });

  if (!profile) {
    return (
      <Card className="soft-card">
        <Text>Profile not loaded.</Text>
      </Card>
    );
  }

  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} lg={16}>
        <Card className="soft-card" title={title} extra={<Tag color={profile.status === 'active' ? 'green' : 'red'}>{profile.status}</Tag>}>
          <Paragraph type="secondary" style={{ marginTop: -4 }}>
            Account details and contact information for {getRoleLabel(profile.role)}.
          </Paragraph>

          <Form form={form} layout="vertical" onFinish={(values) => updateMutation.mutate(values)}>
            <Form.Item name="name" label="Full name" rules={[{ required: true }]}>
              <Input disabled={!editing} />
            </Form.Item>
            <Form.Item name="phone" label="Phone number" rules={[{ required: true }]}>
              <Input disabled={!editing} />
            </Form.Item>
            <Form.Item name="address" label="Address">
              <Input.TextArea disabled={!editing} rows={3} />
            </Form.Item>
            <Space>
              {editing ? (
                <>
                  <Button type="primary" htmlType="submit" loading={updateMutation.isPending}>
                    Save changes
                  </Button>
                  <Button onClick={() => setEditing(false)}>Cancel</Button>
                </>
              ) : (
                <Button type="primary" onClick={() => setEditing(true)}>
                  Edit profile
                </Button>
              )}
            </Space>
          </Form>
        </Card>
      </Col>

      <Col xs={24} lg={8}>
        <Card className="soft-card" title="Account summary">
          <Space direction="vertical" size={8}>
            <Text strong>{profile.email}</Text>
            <Text type="secondary">Role: {getRoleLabel(profile.role)}</Text>
            <Text type="secondary">Committee: {profile.committee || 'N/A'}</Text>
            <Text type="secondary">Email verified: {profile.emailVerified ? 'Yes' : 'No'}</Text>
            <Text type="secondary">Flagged reports: {profile.flaggedReportCount}</Text>
          </Space>
        </Card>
      </Col>
    </Row>
  );
}