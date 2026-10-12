import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button, Card, Col, Form, Input, Row, Space, Tag, Typography, message } from 'antd';
import { api } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { useLang } from '../../contexts/LanguageContext';
import { getRoleLabel } from '../../lib/roles';

const { Text, Paragraph } = Typography;

interface ProfilePageProps {
  title: string;
}

export default function ProfilePage({ title }: ProfilePageProps) {
  const { profile, refreshProfile, role } = useAuth();
  const { lang, t } = useLang();
  const translate = lang === 'fil' && ['tanod', 'responder'].includes(role || '');
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
      message.success(translate ? t('profileUpdated') : 'Profile updated');
      await refreshProfile();
      setEditing(false);
    },
    onError: (error: Error) => message.error(error.message),
  });

  if (!profile) {
    return (
      <Card className="soft-card">
        <Text>{translate ? t('profileNotLoaded') : 'Profile not loaded.'}</Text>
      </Card>
    );
  }

  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} lg={16}>
        <Card
          className="soft-card"
          title={translate ? t('profilePageHeading') : title}
          extra={
            <Tag color={profile.status === 'active' ? 'green' : 'red'}>
              {translate && profile.status === 'active' ? t('active') : profile.status}
            </Tag>
          }
        >
          <Paragraph type="secondary" style={{ marginTop: -4 }}>
            {translate
              ? t('accountDetails')
              : `Account details and contact information for ${getRoleLabel(profile.role)}.`}
          </Paragraph>

          <Form
            form={form}
            layout="vertical"
            onFinish={(values) => {
              if (!editing) return;
              updateMutation.mutate(values);
            }}
          >
            <Form.Item
              name="name"
              label={translate ? t('fullName') : 'Full name'}
              rules={[{ required: true, message: translate ? t('nameRequired') : undefined }]}
            >
              <Input disabled={!editing} />
            </Form.Item>
            <Form.Item
              name="phone"
              label={translate ? t('phoneNumber') : 'Phone number'}
              rules={[{ required: true, message: translate ? t('phoneRequired') : undefined }]}
            >
              <Input disabled={!editing} />
            </Form.Item>
            <Form.Item name="address" label={translate ? t('address') : 'Address'}>
              <Input.TextArea disabled={!editing} rows={3} />
            </Form.Item>
            <Space>
              {editing ? (
                <>
                  <Button type="primary" htmlType="submit" loading={updateMutation.isPending}>
                    {translate ? t('saveChanges') : 'Save changes'}
                  </Button>
                  <Button htmlType="button" onClick={() => setEditing(false)}>
                    {translate ? t('cancel') : 'Cancel'}
                  </Button>
                </>
              ) : (
                <Button
                  type="primary"
                  htmlType="button"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setEditing(true);
                  }}
                >
                  {translate ? t('editProfile') : 'Edit profile'}
                </Button>
              )}
            </Space>
          </Form>
        </Card>
      </Col>

      <Col xs={24} lg={8}>
        <Card className="soft-card" title={translate ? t('accountSummary') : 'Account summary'}>
          <Space direction="vertical" size={8}>
            <Text strong>{profile.email}</Text>
            <Text type="secondary">
              {translate ? t('role') : 'Role'}: {getRoleLabel(profile.role)}
            </Text>
            <Text type="secondary">
              {translate ? t('emailVerified') : 'Email verified'}:{' '}
              {translate
                ? t(profile.emailVerified ? 'yes' : 'no')
                : profile.emailVerified
                  ? 'Yes'
                  : 'No'}
            </Text>
            <Text type="secondary">
              {translate ? t('flaggedReports') : 'Flagged reports'}: {profile.flaggedReportCount}
            </Text>
          </Space>
        </Card>
      </Col>
    </Row>
  );
}
