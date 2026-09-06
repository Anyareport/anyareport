import { useState } from "react";
import { Form, Input, Button, Card, Typography, message, Divider } from "antd";
import { GoogleOutlined } from "@ant-design/icons";
import { Link, useNavigate } from "react-router-dom";
import { loginWithEmail, loginWithGoogle } from "../../lib/firebase";
import { api } from "../../lib/api";
import { useAuth, getRedirectPath } from "../../contexts/AuthContext";
import Logo from "../../components/Logo";

const { Title, Text } = Typography;

export default function LoginPage() {
  const navigate = useNavigate();
  const { refreshProfile } = useAuth();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const handleLogin = async (values: { email: string; password: string }) => {
    setLoading(true);
    try {
      await loginWithEmail(values.email, values.password);
      await api.post("/api/auth/sync-claims");
      const profile = await api.get<{ role: string }>("/api/auth/profile");
      await refreshProfile();
      navigate(getRedirectPath(profile.role));
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setLoading(true);
    try {
      await loginWithGoogle();
      await refreshProfile();
      const profile = await api.get<{ role: string }>("/api/auth/profile");
      navigate(getRedirectPath(profile.role));
    } catch (err: unknown) {
      message.error(
        err instanceof Error ? err.message : "Google sign-in failed",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f5f5f5",
        padding: 16,
      }}
    >
      <Card
        className="motion-fade-up motion-delay-1"
        style={{ width: "100%", maxWidth: 420 }}
      >
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div className="motion-fade-up motion-delay-2">
            <Logo size="lg" />
          </div>
          <Title
            className="motion-fade-up motion-delay-3"
            level={4}
            style={{
              marginTop: 16,
              fontFamily: "'Bebas Neue', sans-serif",
              letterSpacing: 1,
            }}
          >
            SIGN IN
          </Title>
        </div>

        <Form
          className="motion-fade-up motion-delay-4"
          form={form}
          layout="vertical"
          onFinish={handleLogin}
        >
          <Form.Item
            name="email"
            label="Email"
            rules={[{ required: true, type: "email" }]}
          >
            <Input size="large" placeholder="your@email.com" />
          </Form.Item>
          <Form.Item
            name="password"
            label="Password"
            rules={[{ required: true }]}
          >
            <Input.Password size="large" />
          </Form.Item>
          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              block
              size="large"
              loading={loading}
            >
              Sign In
            </Button>
          </Form.Item>
        </Form>

        <div className="motion-fade-up motion-delay-5">
          <Divider>or</Divider>

          <Button
            icon={<GoogleOutlined />}
            block
            size="large"
            onClick={handleGoogle}
            loading={loading}
          >
            Sign in with Google
          </Button>

          <div style={{ textAlign: "center", marginTop: 16 }}>
            <Link to="/forgot-password">
              <Text type="secondary">Forgot password?</Text>
            </Link>
            <br />
            <Text type="secondary">No account? </Text>
            <Link to="/register">Register as resident</Link>
          </div>
        </div>
      </Card>
    </div>
  );
}
