import { useEffect, useState } from 'react';
import { Form, Input, Button, Card, Typography, message, Divider, Alert } from 'antd';
import { GoogleOutlined } from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import { getGoogleAuthErrorMessage, registerWithEmail, loginWithGoogle } from '../../lib/firebase';
import { api } from '../../lib/api';
import { getRedirectPath, useAuth } from '../../contexts/AuthContext';
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
  const { firebaseUser, profile, refreshProfile } = useAuth();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const completingProfile = Boolean(firebaseUser && !profile);

  const getNameFields = (displayName: string | null | undefined) => {
    const parts = displayName?.trim().split(/\s+/).filter(Boolean) || [];
    if (parts.length < 2) {
      return { firstName: parts[0] || '', lastName: '' };
    }
    return {
      firstName: parts[0],
      lastName: parts.slice(1).join(' '),
    };
  };

  useEffect(() => {
    if (completingProfile) {
      form.setFieldsValue({
        ...getNameFields(firebaseUser?.displayName),
        email: firebaseUser?.email || '',
      });
    }
  }, [completingProfile, firebaseUser, form]);

  const handleRegister = async (values: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    confirmPassword?: string;
    phone: string;
    address: string;
  }) => {
    setLoading(true);
    try {
      if (!completingProfile) {
        await registerWithEmail(values.email, values.password);
      }
      const captchaToken = await getCaptchaToken();
      await api.post('/api/auth/register', {
        ...values,
        name: [values.firstName, values.lastName].filter(Boolean).join(' '),
        email: completingProfile ? firebaseUser?.email : values.email,
        captchaToken,
      });
      await refreshProfile();
      message.success(
        completingProfile ? 'Profile completed.' : 'Account created! Please verify your email.'
      );
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
      const user = await loginWithGoogle();
      try {
        const existingProfile = await api.get<{ role: string }>('/api/auth/profile');
        await refreshProfile();
        navigate(getRedirectPath(existingProfile.role));
      } catch (err: unknown) {
        if (err instanceof Error && err.message === 'Profile not found') {
          form.setFieldsValue({
            ...getNameFields(user.displayName),
            email: user.email || '',
          });
          message.info('Complete your profile to finish Google sign-up.');
          return;
        }
        throw err;
      }
    } catch (err: unknown) {
      message.error(getGoogleAuthErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-secondary)',
        padding: 16,
      }}
    >
      <Card style={{ width: '100%', maxWidth: 480 }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Logo size="lg" />
          <Title
            level={4}
            style={{ marginTop: 16, fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 1 }}
          >
            RESIDENT REGISTRATION
          </Title>
        </div>

        <Alert
          type="info"
          message="Phone number is for contact purposes only — not used for login or OTP verification."
          style={{ marginBottom: 16 }}
          showIcon
        />

        <Form form={form} layout="vertical" onFinish={handleRegister}>
          <Form.Item name="firstName" label="First Name" rules={[{ required: true }]}> 
            <Input size="large" />
          </Form.Item>
          <Form.Item name="lastName" label="Last Name" rules={[{ required: true }]}> 
            <Input size="large" />
          </Form.Item>
          
          <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email' }]}>
            <Input size="large" disabled={completingProfile} />
          </Form.Item>
          {!completingProfile && (
            <Form.Item name="password" label="Password" rules={[{ required: true, min: 6 }]}>
              <Input.Password size="large" />
            </Form.Item>
          )}
          {!completingProfile && (
            <Form.Item
              name="confirmPassword"
              label="Confirm Password"
              dependencies={['password']}
              rules={[
                { required: true, message: 'Please confirm your password.' },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue('password') === value) return Promise.resolve();
                    return Promise.reject(new Error('Passwords do not match.'));
                  },
                }),
              ]}
            >
              <Input.Password size="large" />
            </Form.Item>
          )}
          <Form.Item
            name="phone"
            label="Phone Number"
            rules={[
              {
                required: true,
                pattern: /^09\d{9}$/,
                message: 'Enter valid PH mobile (09XXXXXXXXX)',
              },
            ]}
          >
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

        {!completingProfile && <Divider>or</Divider>}

        {!completingProfile && (
          <Button
            icon={<GoogleOutlined />}
            block
            size="large"
            onClick={handleGoogle}
            loading={loading}
          >
            Sign up with Google
          </Button>
        )}

        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <Text type="secondary">Already have an account? </Text>
          <Link to="/login">Sign in</Link>
        </div>
      </Card>
    </div>
  );
}
