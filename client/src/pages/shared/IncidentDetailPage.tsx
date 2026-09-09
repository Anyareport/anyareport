import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Button,
  Card,
  Col,
  Divider,
  Row,
  Space,
  Spin,
  Tag,
  Timeline,
  Typography,
  message,
} from 'antd';
import {
  ArrowLeftOutlined,
  CheckOutlined,
  ExclamationCircleOutlined,
  FlagOutlined,
} from '@ant-design/icons';
import { api, type Report } from '../../lib/api';
import StatusTag from '../../components/StatusTag';
import { StaticMap, RouteMap } from '../../components/MapPicker';
import { useAuth } from '../../contexts/AuthContext';
import { getRoleLabel } from '../../lib/roles';

const { Paragraph, Text } = Typography;

interface IncidentDetailPageProps {
  variant: 'admin' | 'responder';
}

export default function IncidentDetailPage({ variant }: IncidentDetailPageProps) {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { profile, role } = useAuth();

  const { data: report, isLoading } = useQuery({
    queryKey: ['report', id],
    queryFn: () => api.get<Report>(`/api/reports/${id}`),
    enabled: !!id,
  });

  const updateStatus = useMutation({
    mutationFn: (status: 'en_route' | 'on_scene' | 'resolved') =>
      api.patch(`/api/reports/${id}/status`, { status }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['report', id] });
      await queryClient.invalidateQueries({ queryKey: ['admin-reports'] });
      await queryClient.invalidateQueries({ queryKey: ['responder-reports'] });
    },
    onError: (error: Error) => message.error(error.message),
  });

  const verifyMutation = useMutation({
    mutationFn: () => api.post(`/api/reports/${id}/verify`, {}),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['report', id] });
      message.success('Report verified');
    },
    onError: (error: Error) => message.error(error.message),
  });

  const flagMutation = useMutation({
    mutationFn: () => api.post(`/api/reports/${id}/flag`, {}),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['report', id] });
      message.success('Report flagged');
    },
    onError: (error: Error) => message.error(error.message),
  });

  const acknowledgeMutation = useMutation({
    mutationFn: () => api.patch(`/api/reports/${id}/acknowledge`, {}),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['report', id] });
      message.success('Incident acknowledged');
    },
    onError: (error: Error) => message.error(error.message),
  });

  const canManageStatus = useMemo(
    () => ['secretary', 'kagawad', 'tanod', 'responder'].includes(role || ''),
    [role]
  );

  if (isLoading) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', minHeight: 320 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!report) {
    return <Card className="soft-card">Report not found</Card>;
  }

  const [lng, lat] = report.location?.coordinates || [0, 0];

  return (
    <div className="page-shell">
      <Button
        icon={<ArrowLeftOutlined />}
        onClick={() => navigate(-1)}
        style={{ marginBottom: 16 }}
      >
        Back
      </Button>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={16}>
          <Card
            className="soft-card"
            title={report.category}
            extra={<StatusTag status={report.status} />}
          >
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              <Space wrap>
                {report.verifiedBy && <Tag color="blue">Verified</Tag>}
                {report.aiSuggestedCategory && (
                  <Tag color="purple">AI: {report.aiSuggestedCategory}</Tag>
                )}
                <Tag>{report.committee || 'No committee'}</Tag>
                <Tag>{getRoleLabel(profile?.role)}</Tag>
              </Space>

              {((report.subcategory && report.subcategory !== 'undefined') || report.severity) && (
                <Space wrap>
                  {report.subcategory && report.subcategory !== 'undefined' && (
                    <Tag>{report.subcategory}</Tag>
                  )}
                  {report.severity && (
                    <Tag
                      color={
                        report.severity === 'Critical'
                          ? 'red'
                          : report.severity === 'High'
                            ? 'orange'
                            : report.severity === 'Medium'
                              ? 'gold'
                              : 'default'
                      }
                    >
                      Severity: {report.severity}
                    </Tag>
                  )}
                </Space>
              )}

              <Paragraph>{report.description}</Paragraph>

              <Text type="secondary">Submitted: {new Date(report.createdAt).toLocaleString()}</Text>
              {report.submitterName && (
                <Text type="secondary">
                  Reported by: <Text strong>{report.submitterName}</Text>
                </Text>
              )}
              {report.location?.address && (
                <Text type="secondary">Location: {report.location.address}</Text>
              )}

              {variant === 'responder' ? (
                <Card size="small" style={{ background: '#f7f8fb' }}>
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <Text strong>Routing view</Text>
                    <RouteMap incidentLat={lat} incidentLng={lng} />
                  </Space>
                </Card>
              ) : (
                <StaticMap latitude={lat} longitude={lng} />
              )}

              <Divider />

              <Timeline
                items={(report.statusHistory || []).map((entry) => ({
                  children: `${entry.status.replace(/_/g, ' ')} by ${entry.updatedBy} at ${new Date(entry.timestamp).toLocaleString()}`,
                }))}
              />
            </Space>
          </Card>
        </Col>

        <Col xs={24} xl={8}>
          <Card className="soft-card" title="Actions">
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              {canManageStatus && (
                <>
                  <Text type="secondary">Status controls</Text>
                  <Button
                    block
                    onClick={() => updateStatus.mutate('en_route')}
                    loading={updateStatus.isPending}
                  >
                    Set en route
                  </Button>
                  <Button
                    block
                    onClick={() => updateStatus.mutate('on_scene')}
                    loading={updateStatus.isPending}
                  >
                    Set on scene
                  </Button>
                  <Button
                    block
                    type="primary"
                    onClick={() => updateStatus.mutate('resolved')}
                    loading={updateStatus.isPending}
                  >
                    Resolve incident
                  </Button>
                </>
              )}

              {role === 'secretary' && report.status === 'pending' && (
                <>
                  <Button
                    block
                    type="primary"
                    icon={<CheckOutlined />}
                    onClick={() => verifyMutation.mutate()}
                    loading={verifyMutation.isPending}
                  >
                    Verify report
                  </Button>
                  <Button
                    block
                    danger
                    icon={<FlagOutlined />}
                    onClick={() => flagMutation.mutate()}
                    loading={flagMutation.isPending}
                  >
                    Flag report
                  </Button>
                </>
              )}

              {['tanod', 'responder', 'captain', 'secretary'].includes(role || '') && (
                <Button
                  block
                  type="dashed"
                  icon={<ExclamationCircleOutlined />}
                  onClick={() => acknowledgeMutation.mutate()}
                  loading={acknowledgeMutation.isPending}
                >
                  Acknowledge
                </Button>
              )}
            </Space>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
