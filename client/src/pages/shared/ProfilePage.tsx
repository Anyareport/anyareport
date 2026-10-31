import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  Alert,
  Avatar,
  Button,
  Card,
  Col,
  Form,
  Input,
  Row,
  Space,
  Tag,
  Typography,
  message,
} from 'antd';
import { api } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { sendVerificationEmail } from '../../lib/firebase';
import { useLang } from '../../contexts/LanguageContext';
import { getRoleLabel } from '../../lib/roles';

const { Text, Title } = Typography;

function getInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join('')
    .toUpperCase();
}

export default function ProfilePage() {
  const { profile, refreshProfile, role, firebaseUser } = useAuth();
  const { lang, t } = useLang();
  const translate = lang === 'fil' && ['tanod', 'responder'].includes(role || '');
  const [form] = Form.useForm();
  const [editing, setEditing] = useState(false);
  const [verifyBusy, setVerifyBusy] = useState(false);
  const suspended = profile?.status === 'suspended';
  const isEditing = editing && !suspended;

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

  const resendVerification = async () => {
    if (!firebaseUser) return;
    setVerifyBusy(true);
    try {
      await sendVerificationEmail(firebaseUser);
      message.success(
        translate ? t('verificationSent') : 'Verification email sent. Check your inbox.'
      );
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Could not send the email.');
    } finally {
      setVerifyBusy(false);
    }
  };

  // After clicking the link in the email, reload the account and sync it here.
  const checkVerified = async () => {
    if (!firebaseUser) return;
    setVerifyBusy(true);
    try {
      await firebaseUser.reload();
      await firebaseUser.getIdToken(true);
      await api.post('/api/auth/sync-claims');
      await refreshProfile();
      if (!firebaseUser.emailVerified) {
        message.info(translate ? t('verificationPending') : 'Your email is not verified yet.');
      }
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Could not check verification.');
    } finally {
      setVerifyBusy(false);
    }
  };

  if (!profile) {
    return (
      <Card className="soft-card">
        <Text>{translate ? t('profileNotLoaded') : 'Profile not loaded.'}</Text>
      </Card>
    );
  }

  const addressMissing = !profile.address?.trim();
  const cancelEditing = () => {
    form.setFieldsValue({
      name: profile.name,
      phone: profile.phone,
      address: profile.address,
    });
    setEditing(false);
  };

  return (
    <Row gutter={[16, 16]}>
      <Col span={24}>
        <Card className="soft-card">
          <Row align="middle" gutter={[16, 16]}>
            <Col xs={24} md={16}>
              <Space align="center" size={16}>
                <Avatar
                  size={64}
                  style={{ backgroundColor: 'var(--brand-primary)', flexShrink: 0 }}
                >
                  {getInitials(profile.name)}
                </Avatar>
                <Space direction="vertical" size={4}>
                  <Title level={4} style={{ margin: 0 }}>
                    {profile.name}
                  </Title>
                  <Space size={[4, 4]} wrap>
                    <Tag color="blue">{getRoleLabel(profile.role)}</Tag>
                    <Tag color={profile.status === 'active' ? 'green' : 'red'}>
                      {translate && profile.status === 'active' ? t('active') : profile.status}
                    </Tag>
                    <Text type="secondary">Barangay Don Mariano Marcos</Text>
                  </Space>
                </Space>
              </Space>
            </Col>
            <Col xs={24} md={8}>
              <Space direction="vertical" size={2} style={{ width: '100%', textAlign: 'right' }}>
                <Text type="secondary">{translate ? t('email') : 'Email'}</Text>
                <Text strong style={{ overflowWrap: 'anywhere' }}>
                  {profile.email}
                </Text>
              </Space>
            </Col>
          </Row>
        </Card>
      </Col>

      {suspended && (
        <Col span={24}>
          <Alert
            type="error"
            showIcon
            message="Your account is suspended"
            description="Your access to Anyareport features is restricted because your reports have reached the flagged-report limit. Please visit the Barangay Hall to discuss your account and appeal."
          />
        </Col>
      )}

      {addressMissing && !isEditing && !suspended && (
        <Col span={24}>
          <Alert
            type="warning"
            showIcon
            message={translate ? t('profileAddressPrompt') : 'Add your address'}
            description={
              translate
                ? t('profileAddressPurpose')
                : 'It helps responders find you faster during an emergency.'
            }
            action={
              <Button type="primary" onClick={() => setEditing(true)}>
                {translate ? t('addAddress') : 'Add address'}
              </Button>
            }
          />
        </Col>
      )}

      <Col xs={24} lg={16}>
        <Form
          form={form}
          layout="vertical"
          onFinish={(values) => {
            if (isEditing) updateMutation.mutate(values);
          }}
        >
          <Card
            className="soft-card"
            title={translate ? t('personalInformation') : 'Personal information'}
            extra={
              suspended ? null : isEditing ? (
                <Space>
                  <Button type="primary" htmlType="submit" loading={updateMutation.isPending}>
                    {translate ? t('saveChanges') : 'Save changes'}
                  </Button>
                  <Button htmlType="button" onClick={cancelEditing}>
                    {translate ? t('cancel') : 'Cancel'}
                  </Button>
                </Space>
              ) : (
                <Button htmlType="button" disabled={suspended} onClick={() => setEditing(true)}>
                  {translate ? t('editProfile') : 'Edit profile'}
                </Button>
              )
            }
          >
            {isEditing ? (
              <Row gutter={[16, 0]}>
                <Col xs={24} sm={12}>
                  <Form.Item
                    name="name"
                    label={translate ? t('fullName') : 'Full name'}
                    rules={[
                      {
                        required: true,
                        message: translate ? t('nameRequired') : 'Please enter your full name.',
                      },
                    ]}
                  >
                    <Input />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item
                    name="phone"
                    label={translate ? t('phoneNumber') : 'Phone number'}
                    rules={[
                      {
                        required: true,
                        message: translate ? t('phoneRequired') : 'Please enter your phone number.',
                      },
                    ]}
                  >
                    <Input />
                  </Form.Item>
                </Col>
                <Col span={24}>
                  <Form.Item
                    name="address"
                    label={translate ? t('address') : 'Address'}
                    extra={
                      translate
                        ? t('profileAddressHelper')
                        : 'Include your purok, street, or a nearby landmark.'
                    }
                  >
                    <Input.TextArea rows={3} />
                  </Form.Item>
                </Col>
              </Row>
            ) : (
              <>
                <Row gutter={[16, 20]}>
                  <Col xs={24} sm={12}>
                    <Space direction="vertical" size={2}>
                      <Text type="secondary">{translate ? t('fullName') : 'Full name'}</Text>
                      <Text strong>{profile.name}</Text>
                    </Space>
                  </Col>
                  <Col xs={24} sm={12}>
                    <Space direction="vertical" size={2}>
                      <Text type="secondary">{translate ? t('phoneNumber') : 'Phone number'}</Text>
                      <Text strong>{profile.phone}</Text>
                    </Space>
                  </Col>
                  <Col span={24}>
                    <Space direction="vertical" size={2}>
                      <Text type="secondary">{translate ? t('address') : 'Address'}</Text>
                      <Text strong type={addressMissing ? 'warning' : undefined}>
                        {profile.address?.trim() || (translate ? t('notSet') : 'Not set')}
                      </Text>
                      <Text type="secondary">
                        {translate
                          ? t('profileAddressHelper')
                          : 'Include your purok, street, or a nearby landmark.'}
                      </Text>
                    </Space>
                  </Col>
                </Row>
                <div
                  style={{
                    marginTop: 20,
                    paddingTop: 16,
                    borderTop: '1px solid var(--border-light)',
                  }}
                >
                  <Text type="secondary">
                    {translate
                      ? t('profilePrivacyNote')
                      : 'Your name and contact details may be used with your reports to help verify them and coordinate a response.'}
                  </Text>
                </div>
              </>
            )}
          </Card>
        </Form>
      </Col>

      <Col xs={24} lg={8}>
        <Card className="soft-card" title={translate ? t('accountStanding') : 'Account standing'}>
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <div>
              <Row align="middle" justify="space-between" gutter={[8, 8]}>
                <Col>{translate ? t('emailVerified') : 'Email verified'}</Col>
                <Col>
                  <Tag color={profile.emailVerified ? 'green' : 'default'}>
                    {translate
                      ? t(profile.emailVerified ? 'yes' : 'no')
                      : profile.emailVerified
                        ? 'Yes'
                        : 'No'}
                  </Tag>
                </Col>
              </Row>
              {!suspended && !profile.emailVerified && firebaseUser && (
                <Space wrap size={8} style={{ marginTop: 8 }}>
                  <Button size="small" loading={verifyBusy} onClick={resendVerification}>
                    {translate ? t('resendVerification') : 'Resend verification email'}
                  </Button>
                  <Button size="small" type="primary" loading={verifyBusy} onClick={checkVerified}>
                    {translate ? t('checkVerified') : "I've verified my email"}
                  </Button>
                </Space>
              )}
            </div>
            <div>
              <Row align="middle" justify="space-between" gutter={[8, 8]}>
                <Col>{translate ? t('flaggedReports') : 'Flagged reports'}</Col>
                <Col>
                  <Text strong>{profile.flaggedReportCount}</Text>
                </Col>
              </Row>
              <Text type="secondary">
                {translate
                  ? t('flaggedReportExplanation')
                  : 'This count increases when one of your reports is flagged for review by an official.'}
              </Text>
            </div>
          </Space>
        </Card>
      </Col>
    </Row>
  );
}