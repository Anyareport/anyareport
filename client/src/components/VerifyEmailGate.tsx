import { useState } from 'react';
import { Alert, Button, Card, Space, Typography, message } from 'antd';
import { MailOutlined } from '@ant-design/icons';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { logout, sendVerificationEmail } from '../lib/firebase';

const { Paragraph, Text, Title } = Typography;

// Shown instead of the app to a barangay official whose email is not verified yet.
export default function VerifyEmailGate() {
  const { firebaseUser, profile, refreshProfile } = useAuth();
  const [busy, setBusy] = useState(false);

  const resend = async () => {
    if (!firebaseUser) return;
    setBusy(true);
    try {
      await sendVerificationEmail(firebaseUser);
      message.success('Verification email sent. Check your inbox.');
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Could not send the email.');
    } finally {
      setBusy(false);
    }
  };

  // After clicking the link in the email, reload the account and sync it here.
  const checkVerified = async () => {
    if (!firebaseUser) return;
    setBusy(true);
    try {
      await firebaseUser.reload();
      await firebaseUser.getIdToken(true);
      await api.post('/api/auth/sync-claims');
      await refreshProfile();
      if (!firebaseUser.emailVerified) message.info('Your email is not verified yet.');
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Could not check verification.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <Card className="soft-card" style={{ maxWidth: 460, width: '100%' }}>
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <MailOutlined style={{ fontSize: 32 }} aria-hidden="true" />
          <Title level={4} style={{ margin: 0 }}>
            Verify your email to continue
          </Title>
          <Paragraph style={{ margin: 0 }}>
            Barangay officials must confirm their email before they can open reports, alerts or any
            other data. We sent a verification link to{' '}
            <Text strong style={{ overflowWrap: 'anywhere' }}>
              {profile?.email || firebaseUser?.email}
            </Text>
            .
          </Paragraph>
          <Alert
            type="info"
            showIcon
            message="Open the link in that email, then come back and press the button below."
          />
          <Space direction="vertical" size={8} style={{ width: '100%' }}>
            <Button type="primary" block loading={busy} onClick={checkVerified}>
              I've verified my email
            </Button>
            <Button block loading={busy} onClick={resend}>
              Resend verification email
            </Button>
            <Button block type="text" onClick={() => void logout()}>
              Log out
            </Button>
          </Space>
        </Space>
      </Card>
    </div>
  );
}