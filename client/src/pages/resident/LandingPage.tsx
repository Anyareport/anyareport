import { Button, Card, Typography, Row, Col, Alert } from "antd";
import { FileAddOutlined, SafetyOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

const { Title, Paragraph } = Typography;

export default function ResidentLanding() {
  const navigate = useNavigate();
  const { profile } = useAuth();

  return (
    <div>
      <Card
        className="motion-fade-up motion-delay-1"
        style={{
          marginBottom: 16,
          background: "linear-gradient(135deg, #282F49 0%, #3d4666 100%)",
          border: "none",
        }}
      >
        <Title
          level={2}
          style={{
            color: "#fff",
            fontFamily: "'Bebas Neue', sans-serif",
            letterSpacing: 2,
            margin: 0,
          }}
        >
          REPORT AN INCIDENT
        </Title>
        <Paragraph style={{ color: "#ccc", marginBottom: 16 }}>
          Help keep Barangay Don Mariano Marcos safe. Report concerns,
          emergencies, and infrastructure issues directly from your phone.
        </Paragraph>
        <Button
          type="primary"
          size="large"
          icon={<FileAddOutlined />}
          onClick={() => navigate("/resident/submit")}
          disabled={profile?.status === "suspended"}
        >
          Submit Report
        </Button>
      </Card>

      {!profile?.emailVerified && (
        <Alert
          type="warning"
          message="Please verify your email to submit reports."
          description="Check your inbox for a verification link from Firebase."
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      {profile?.status === "suspended" && (
        <Alert
          type="error"
          message="Your account has been suspended."
          description="Contact the Barangay Secretary for assistance."
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12}>
          <Card className="motion-fade-up motion-delay-2">
            <SafetyOutlined style={{ fontSize: 32, color: "#E63333" }} />
            <Title
              level={5}
              style={{
                fontFamily: "'Bebas Neue', sans-serif",
                letterSpacing: 1,
                marginTop: 8,
              }}
            >
              QUICK REPORTING
            </Title>
            <Paragraph type="secondary">
              Use GPS and photos to report incidents on the spot. Our team
              responds quickly to verified reports.
            </Paragraph>
          </Card>
        </Col>
        <Col xs={24} sm={12}>
          <Card className="motion-fade-up motion-delay-3">
            <FileAddOutlined style={{ fontSize: 32, color: "#282F49" }} />
            <Title
              level={5}
              style={{
                fontFamily: "'Bebas Neue', sans-serif",
                letterSpacing: 1,
                marginTop: 8,
              }}
            >
              TRACK YOUR REPORTS
            </Title>
            <Paragraph type="secondary">
              Monitor the status of your submissions from pending verification
              through resolution.
            </Paragraph>
            <Button
              type="link"
              onClick={() => navigate("/resident/reports")}
              style={{ padding: 0 }}
            >
              View My Reports →
            </Button>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
