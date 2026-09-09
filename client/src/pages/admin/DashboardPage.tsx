import { useQuery } from "@tanstack/react-query";
import {
  Card,
  Col,
  Row,
  Statistic,
  Space,
  Typography,
  List,
  Button,
} from "antd";
import { useNavigate } from "react-router-dom";
import {
  api,
  type Analytics,
  type Notification,
  type Report,
} from "../../lib/api";
import { adminDashboardRoles } from "../../lib/roles";
import StatusTag from "../../components/StatusTag";

const { Title, Paragraph, Text } = Typography;

export default function AdminDashboardPage() {
  const navigate = useNavigate();
  const { data: analytics } = useQuery({
    queryKey: ["admin-dashboard-analytics"],
    queryFn: () => api.get<Analytics>("/api/reports/analytics"),
  });

  const { data: reports = [] } = useQuery({
    queryKey: ["admin-dashboard-reports"],
    queryFn: () => api.get<Report[]>("/api/reports"),
    refetchInterval: 30000,
  });

  const { data: notifications = [] } = useQuery({
    queryKey: ["admin-dashboard-notifications"],
    queryFn: () => api.get<Notification[]>("/api/notifications"),
    refetchInterval: 30000,
  });

  const openReports = reports.filter(
    (report) => report.status !== "resolved",
  ).length;

  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <Card className="soft-card page-hero">
        <Title level={2} style={{ color: "#fff", marginTop: 0 }}>
          Administrative dashboard
        </Title>
        <Paragraph style={{ color: "rgba(255,255,255,0.82)" }}>
          Shared oversight for {adminDashboardRoles.length} roles, with
          committee scoping enforced server-side.
        </Paragraph>
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24} md={8}>
          <Card className="soft-card">
            <Statistic title="Open incidents" value={openReports} />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card className="soft-card">
            <Statistic
              title="Total reports"
              value={analytics?.total ?? reports.length}
            />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card className="soft-card">
            <Statistic
              title="Unread notifications"
              value={notifications.filter((n) => !n.read).length}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={16}>
          <Card
            className="soft-card"
            title="Latest incidents"
            extra={
              <Button type="link" onClick={() => navigate("/admin/incidents")}>
                View all
              </Button>
            }
          >
            <List
              dataSource={reports.slice(0, 5)}
              locale={{ emptyText: "No incidents yet" }}
              renderItem={(report) => (
                <List.Item
                  style={{ cursor: "pointer" }}
                  onClick={() => navigate(`/admin/incidents/${report._id}`)}
                  extra={<StatusTag status={report.status} />}
                >
                  <List.Item.Meta
                    title={report.category}
                    description={
                      <Space direction="vertical" size={2}>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {report.description.length > 80
                            ? report.description.slice(0, 80) + "…"
                            : report.description}
                        </Text>
                        <Space size={8}>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {new Date(report.createdAt).toLocaleString()}
                          </Text>
                          {report.location?.address && (
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              · {report.location.address}
                            </Text>
                          )}
                        </Space>
                      </Space>
                    }
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>
        <Col xs={24} xl={8}>
          <Card className="soft-card" title="Quick status">
            <Space direction="vertical" size={8}>
              <Text type="secondary">Resolved: {analytics?.resolved ?? 0}</Text>
              <Text type="secondary">Pending: {analytics?.pending ?? 0}</Text>
              <Text type="secondary">
                Resolution rate: {analytics?.resolutionRate ?? 0}%
              </Text>
            </Space>
          </Card>
        </Col>
      </Row>
    </Space>
  );
}
