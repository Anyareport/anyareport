import { useState } from 'react';
import { Form, Input, Button, Card, Typography, message, Divider, Alert } from 'antd';
import { GoogleOutlined } from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import { registerWithEmail, loginWithGoogle } from '../../lib/firebase';
import { api } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import Logo from '../../components/Logo';

const { Title, Text } = Typography;

declare global {
  interface Window {
    grecaptcha?: {
      ready: (cb: () => void) => void;
      execute: (siteKey: string, opts: { action: string }) => Promise<string>;
    };
  }
}

async function getCaptchaToken(): Promise<string | null> {
  const siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;
  if (!siteKey || siteKey.includes('your-recaptcha')) return null;

  return new Promise((resolve) => {
    if (!window.grecaptcha) {
      const script = document.createElement('script');
      script.src = `https://www.google.com/recaptcha/api.js?render=${siteKey}`;
      script.onload = () => {
        window.grecaptcha!.ready(async () => {
          const token = await window.grecaptcha!.execute(siteKey, { action: 'register' });
          resolve(token);
        });
      };
      document.head.appendChild(script);
    } else {
      window.grecaptcha.ready(async () => {
        const token = await window.grecaptcha!.execute(siteKey, { action: 'register' });
        resolve(token);
      });
    }
  });
}

export default function RegisterPage() {
  const navigate = useNavigate();
  const { refreshProfile } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleRegister = async (values: {
    name: string;
    email: string;
    password: string;
    phone: string;
    address: string;
  }) => {
    setLoading(true);
    try {
      await registerWithEmail(values.email, values.password);
      const captchaToken = await getCaptchaToken();
      await api.post('/api/auth/register', {
        ...values,
        captchaToken,
      });
      await refreshProfile();
      message.success('Account created! Please verify your email.');
      navigate('/resident');
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setLoading(true);
    try {
      await loginWithGoogle();
      message.info('Please complete your profile with phone number.');
      navigate('/resident/profile');
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : 'Google sign-in failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f5', padding: 16 }}>
      <Card style={{ width: '100%', maxWidth: 480 }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Logo size="lg" />
          <Title level={4} style={{ marginTop: 16, fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 1 }}>
            RESIDENT REGISTRATION
          </Title>
        </div>

        <Alert
          type="info"
          message="Phone number is for contact purposes only — not used for login or OTP verification."
          style={{ marginBottom: 16 }}
          showIcon
        />

        <Form layout="vertical" onFinish={handleRegister}>
          <Form.Item name="name" label="Full Name" rules={[{ required: true }]}>
            <Input size="large" />
          </Form.Item>
          <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email' }]}>
            <Input size="large" />
          </Form.Item>
          <Form.Item name="password" label="Password" rules={[{ required: true, min: 6 }]}>
            <Input.Password size="large" />
          </Form.Item>
          <Form.Item name="phone" label="Phone Number" rules={[{ required: true, pattern: /^09\d{9}$/, message: 'Enter valid PH mobile (09XXXXXXXXX)' }]}>
            <Input size="large" placeholder="09XXXXXXXXX" />
          </Form.Item>
          <Form.Item name="address" label="Address">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block size="large" loading={loading}>
              Create Account
            </Button>
          </Form.Item>
        </Form>

        <Divider>or</Divider>

        <Button icon={<GoogleOutlined />} block size="large" onClick={handleGoogle} loading={loading}>
          Sign up with Google
        </Button>

        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <Text type="secondary">Already have an account? </Text>
          <Link to="/login">Sign in</Link>
        </div>
      </Card>
    </div>
  );
}
