import { useState } from 'react';
import { Form, Input, Button, Card, Typography, message } from 'antd';
import { Link } from 'react-router-dom';
import { resetPassword } from '../../lib/firebase';
import Logo from '../../components/Logo';

const { Title, Text } = Typography;

export default function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleReset = async (values: { email: string }) => {
    setLoading(true);
    try {
      await resetPassword(values.email);
      setSent(true);
      message.success('Password reset email sent!');
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : 'Failed to send reset email');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f5', padding: 16 }}>
      <Card style={{ width: '100%', maxWidth: 420 }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Logo size="lg" />
          <Title level={4} style={{ marginTop: 16, fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 1 }}>
            RESET PASSWORD
          </Title>
        </div>

        {sent ? (
          <Text>Check your email for a password reset link.</Text>
        ) : (
          <Form layout="vertical" onFinish={handleReset}>
            <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email' }]}>
              <Input size="large" />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit" block size="large" loading={loading}>
                Send Reset Link
              </Button>
            </Form.Item>
          </Form>
        )}

        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <Link to="/login">Back to sign in</Link>
        </div>
      </Card>
    </div>
  );
}
