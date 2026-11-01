import { useEffect, useState } from 'react';
import { Form, Input, Button, Typography, Divider, Checkbox } from 'antd';
import { GoogleOutlined } from '@ant-design/icons';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  getAuthErrorMessage,
  getGoogleAuthErrorMessage,
  registerWithEmail,
  loginWithGoogle,
} from '../../lib/firebase';
import { api } from '../../lib/api';
import { PH_MOBILE_REGEX } from '../../lib/phone';
import { getRedirectPath, useAuth } from '../../contexts/AuthContext';
import AuthLayout from './AuthLayout';
import { useAntdMessage } from '../../lib/useAntdMessage';

const { Text } = Typography;

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
  const message = useAntdMessage();
  const location = useLocation();
  const navigate = useNavigate();
  const { firebaseUser, profile, loading: authLoading, refreshProfile } = useAuth();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [privacyAcknowledged, setPrivacyAcknowledged] = useState(false);
  const routeState = location.state as { completeGoogleProfile?: boolean } | null;
  const isGoogleUser = Boolean(
    firebaseUser?.providerData.some(({ providerId }) => providerId === 'google.com')
  );
  const completingProfile = Boolean(
    firebaseUser &&
      !profile &&
      !authLoading &&
      (routeState?.completeGoogleProfile || isGoogleUser)
  );

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
    if (!privacyAcknowledged) {
      message.warning('Please accept the privacy notice before continuing.');
      return;
    }

    setLoading(true);
    try {
      const email = (completingProfile ? firebaseUser?.email : values.email)?.trim().toLowerCase();
      const firstName = values.firstName.trim();
      const lastName = values.lastName.trim();
      const name = [firstName, lastName].filter(Boolean).join(' ');

      if (!completingProfile) {
        await registerWithEmail(email || '', values.password);
      }
      const captchaToken = await getCaptchaToken();
      await api.post('/api/auth/register', {
        name,
        email,
        phone: values.phone.trim(),
        address: typeof values.address === 'string' ? values.address.trim() : '',
        consent: privacyAcknowledged,
        captchaToken,
      });
      await refreshProfile();
      message.success(
        completingProfile ? 'Profile completed.' : 'Account created! Please verify your email.'
      );
      navigate('/resident');
    } catch (err: unknown) {
      message.error(getAuthErrorMessage(err, 'Could not create your account. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    if (!privacyAcknowledged) {
      message.warning('Please accept the privacy notice before continuing.');
      return;
    }

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
    <AuthLayout page="register">
      <div className="auth-form-heading">
        <h1>Create your account</h1>
        <p>For residents of Barangay Don Mariano Marcos.</p>
      </div>

      <Form className="auth-form" form={form} layout="vertical" onFinish={handleRegister}>
        <div className="auth-fields-row">
          <Form.Item
            name="firstName"
            label="First name"
            rules={[{ required: true, whitespace: true, message: 'Please enter your first name.' }]}
          >
            <Input size="large" autoComplete="given-name" />
          </Form.Item>
          <Form.Item
            name="lastName"
            label="Last name"
            rules={[{ required: true, whitespace: true, message: 'Please enter your last name.' }]}
          >
            <Input size="large" autoComplete="family-name" />
          </Form.Item>
        </div>

        <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email' }]}>
          <Input size="large" disabled={completingProfile} autoComplete="email" />
        </Form.Item>
        {!completingProfile && (
          <div className="auth-fields-row">
            <Form.Item
              name="password"
              label="Password"
              extra="At least 8 characters"
              rules={[
                { required: true, message: 'Please enter a password.' },
                { min: 8, message: 'Password must be at least 8 characters.' },
              ]}
            >
              <Input.Password size="large" autoComplete="new-password" />
            </Form.Item>
            <Form.Item
              name="confirmPassword"
              label="Confirm password"
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
              <Input.Password size="large" autoComplete="new-password" />
            </Form.Item>
          </div>
        )}

        <Form.Item
          name="phone"
          label="Phone number"
          extra="For contact only. Not used to sign in."
          rules={[
            { required: true, whitespace: true, message: 'Please enter your phone number.' },
            { pattern: PH_MOBILE_REGEX, message: 'Enter a valid PH mobile number (09XXXXXXXXX).' },
          ]}
        >
          <Input size="large" placeholder="09XXXXXXXXX" autoComplete="tel" />
        </Form.Item>
        <Form.Item name="address" label="Street or purok (optional)">
          <Input size="large" placeholder="e.g. Purok 3, Ponce St." autoComplete="street-address" />
        </Form.Item>

        <div className="auth-consent">
          <Checkbox
            className="report-ai-processing-checkbox"
            checked={privacyAcknowledged}
            onChange={(event) => setPrivacyAcknowledged(event.target.checked)}
          >
            I agree that my details are used to create my account. If I submit a report, its text and
            photos are sent to Google Gemini for AI classification. I will be asked to confirm before
            anything is sent.
          </Checkbox>
        </div>
        <Form.Item>
          <Button
            type="primary"
            htmlType="submit"
            block
            size="large"
            loading={loading}
            disabled={!privacyAcknowledged}
          >
            Create account
          </Button>
        </Form.Item>
      </Form>

      {!completingProfile && <Divider>or</Divider>}

      {!completingProfile && (
        <Button
          className="auth-google-button"
          icon={<GoogleOutlined aria-hidden="true" />}
          block
          size="large"
          onClick={handleGoogle}
          loading={loading}
          disabled={!privacyAcknowledged}
        >
          Sign up with Google
        </Button>
      )}

      <p className="auth-switch-account">
        <Text type="secondary">Already have an account? </Text>
        <Link to="/login">Sign in</Link>
      </p>
    </AuthLayout>
  );
}
