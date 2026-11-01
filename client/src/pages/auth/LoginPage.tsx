import { useState } from 'react';
import { Form, Input, Button, Typography, Divider, Checkbox } from 'antd';
import { GoogleOutlined } from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import {
  getAuthErrorMessage,
  getGoogleAuthErrorMessage,
  loginWithEmail,
  loginWithGoogle,
  setAuthPersistence,
} from '../../lib/firebase';
import { api } from '../../lib/api';
import { useAuth, getRedirectPath } from '../../contexts/AuthContext';
import ServerStatus from '../../components/ServerStatus';
import AuthLayout from './AuthLayout';
import { useAntdMessage } from '../../lib/useAntdMessage';

const { Text } = Typography;

interface LoginFormValues {
  email: string;
  password: string;
  keepSignedIn: boolean;
}

export default function LoginPage() {
  const message = useAntdMessage();
  const navigate = useNavigate();
  const { refreshProfile } = useAuth();
  const [form] = Form.useForm<LoginFormValues>();
  const [loading, setLoading] = useState(false);

  const completeLogin = async () => {
    await api.post('/api/auth/sync-claims');
    const profile = await api.get<{ role: string }>('/api/auth/profile');
    await refreshProfile();
    navigate(getRedirectPath(profile.role));
  };

  const handleLogin = async (values: LoginFormValues) => {
    setLoading(true);
    try {
      await setAuthPersistence(values.keepSignedIn);
      await loginWithEmail(values.email, values.password);
      await completeLogin();
    } catch (err: unknown) {
      message.error(getAuthErrorMessage(err, 'Could not sign in. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setLoading(true);
    try {
      await setAuthPersistence(form.getFieldValue('keepSignedIn') ?? true);
      const user = await loginWithGoogle();
      if (!user) return;
      await completeLogin();
    } catch (err: unknown) {
      if (err instanceof Error && err.message === 'Profile not found') {
        message.info('Please complete your profile to finish Google sign-in.');
        navigate('/register', { state: { completeGoogleProfile: true } });
        return;
      }
      message.error(getGoogleAuthErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout page="login">
      <div className="auth-form-heading">
        <h1>Welcome back</h1>
        <p>Sign in to report or respond to incidents.</p>
      </div>

      <Form
        className="auth-form"
        form={form}
        layout="vertical"
        initialValues={{ keepSignedIn: true }}
        onFinish={handleLogin}
      >
        <Form.Item
          name="email"
          label="Email"
          rules={[
            { required: true, type: 'email', message: 'Enter a valid email address.' },
          ]}
        >
          <Input size="large" placeholder="you@email.com" autoComplete="email" />
        </Form.Item>
        <Form.Item
          name="password"
          label="Password"
          rules={[{ required: true, message: 'Please enter your password.' }]}
        >
          <Input.Password size="large" autoComplete="current-password" />
        </Form.Item>
        <div className="auth-option-row">
          <Form.Item name="keepSignedIn" valuePropName="checked">
            <Checkbox>Keep me signed in</Checkbox>
          </Form.Item>
          <Link to="/forgot-password" className="auth-link-button">
            Forgot password?
          </Link>
        </div>
        <Form.Item>
          <Button type="primary" htmlType="submit" block size="large" loading={loading}>
            Sign in
          </Button>
        </Form.Item>
      </Form>

      <Divider>or</Divider>

      <Button
        className="auth-google-button"
        icon={<GoogleOutlined aria-hidden="true" />}
        block
        size="large"
        onClick={handleGoogle}
        loading={loading}
      >
        Continue with Google
      </Button>

      <p className="auth-switch-account">
        <Text type="secondary">New here? </Text>
        <Link to="/register">Create a resident account</Link>
      </p>

      <div className="auth-officials-note">
        Tanod, responder, secretary or captain? Use the account your barangay admin created for you.
      </div>

      <div className="auth-server-status">
        <ServerStatus />
      </div>
    </AuthLayout>
  );
}
