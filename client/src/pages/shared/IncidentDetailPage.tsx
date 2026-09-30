import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Button,
  Card,
  Col,
  Divider,
  Image,
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
  FlagOutlined,
  RobotOutlined,
  EnvironmentOutlined,
  UserOutlined,
  UserAddOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import { api, type Report } from '../../lib/api';
import StatusTag, { formatStatus } from '../../components/StatusTag';
import SeverityTag from '../../components/SeverityTag';
import { StaticMap, RouteMap } from '../../components/map/MapPicker';
import { useAuth } from '../../contexts/AuthContext';

const { Paragraph, Text } = Typography;

interface IncidentDetailPageProps {
  variant: 'admin' | 'responder' | 'resident';
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
    refetchInterval: 15000,
  });

  const updateStatus = useMutation({
    mutationFn: (status: 'in_progress' | 'resolved') =>
      api.patch(`/api/reports/${id}/status`, { status }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['report', id] });
      await queryClient.invalidateQueries({ queryKey: ['admin-reports'] });
      await queryClient.invalidateQueries({ queryKey: ['responder-reports'] });
      await queryClient.invalidateQueries({ queryKey: ['responder-alerts'] });
      await queryClient.invalidateQueries({ queryKey: ['responder-handled-reports'] });
      await queryClient.invalidateQueries({ queryKey: ['responder-history'] });
      await queryClient.invalidateQueries({ queryKey: ['my-reports'] });
      await queryClient.invalidateQueries({ queryKey: ['admin-reports'] });
      await queryClient.invalidateQueries({ queryKey: ['admin-dashboard-reports'] });
      await queryClient.invalidateQueries({ queryKey: ['admin-dashboard-analytics'] });
      await queryClient.invalidateQueries({ queryKey: ['secretary-intake'] });
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
      await queryClient.invalidateQueries({ queryKey: ['responder-reports'] });
      await queryClient.invalidateQueries({ queryKey: ['responder-alerts'] });
      await queryClient.invalidateQueries({ queryKey: ['responder-handled-reports'] });
      await queryClient.invalidateQueries({ queryKey: ['responder-history'] });
      message.success('Incident acknowledged');
    },
    onError: (error: Error) => message.error(error.message),
  });

  const backupMutation = useMutation({
    mutationFn: () =>
      api.post<{ report: Report; alreadyRequested: boolean }>(`/api/reports/${id}/backup`, {}),
    onSuccess: async ({ alreadyRequested }) => {
      await queryClient.invalidateQueries({ queryKey: ['report', id] });
      await queryClient.invalidateQueries({ queryKey: ['responder-reports'] });
      await queryClient.invalidateQueries({ queryKey: ['responder-alerts'] });
      await queryClient.invalidateQueries({ queryKey: ['responder-handled-reports'] });
      message.success(alreadyRequested ? 'Backup is already requested' : 'Backup requested');
    },
    onError: (error: Error) => message.error(error.message),
  });

  const joinBackupMutation = useMutation({
    mutationFn: () =>
      api.post<{ report: Report; alreadyJoined: boolean }>(`/api/reports/${id}/backup/join`, {}),
    onSuccess: async ({ alreadyJoined }) => {
      await queryClient.invalidateQueries({ queryKey: ['report', id] });
      await queryClient.invalidateQueries({ queryKey: ['responder-reports'] });
      await queryClient.invalidateQueries({ queryKey: ['responder-alerts'] });
      await queryClient.invalidateQueries({ queryKey: ['responder-handled-reports'] });
      await queryClient.invalidateQueries({ queryKey: ['responder-history'] });
      await queryClient.invalidateQueries({ queryKey: ['notifications'] });
      message.success(alreadyJoined ? 'You are already assisting' : 'You joined as backup');
    },
    onError: (error: Error) => message.error(error.message),
  });

  const closeBackupMutation = useMutation({
    mutationFn: () =>
      api.post<{ report: Report; alreadyClosed: boolean }>(`/api/reports/${id}/backup/close`, {}),
    onSuccess: async ({ alreadyClosed }) => {
      await queryClient.invalidateQueries({ queryKey: ['report', id] });
      await queryClient.invalidateQueries({ queryKey: ['responder-reports'] });
      await queryClient.invalidateQueries({ queryKey: ['responder-alerts'] });
      await queryClient.invalidateQueries({ queryKey: ['responder-handled-reports'] });
      await queryClient.invalidateQueries({ queryKey: ['responder-history'] });
      message.success(alreadyClosed ? 'Backup request is already closed' : 'No more backup needed');
    },
    onError: (error: Error) => message.error(error.message),
  });

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

  const statusHistory = report.statusHistory ?? [];

  const [lng, lat] = report.location?.coordinates || [0, 0];
  const isResident = variant === 'resident';
  const isResponder = ['tanod', 'responder'].includes(role || '');
  const backupRequests = report.backupRequests ?? [];
  const openBackupRequest = backupRequests.find((request) => request.status === 'pending');
  const backupResponderUids = backupRequests.flatMap((request) => request.joinedBy ?? []);
  const backupResponderNames = [
    ...new Set(backupRequests.flatMap((request) => request.joinedByNames ?? [])),
  ];
  const isOwner = isResponder && report.acknowledgedBy === profile?.firebaseUid;
  const isBackupResponder = isResponder && backupResponderUids.includes(profile?.firebaseUid || '');
  const canJoinBackup =
    isResponder &&
    !!openBackupRequest &&
    report.acknowledgedBy !== profile?.firebaseUid &&
    !isBackupResponder &&
    report.status !== 'resolved';
  const isReservedByAnotherResponder =
    isResponder && !!report.acknowledgedBy && !isOwner && !isBackupResponder;
  const isOversightRole = role === 'captain' || role === 'secretary';
  const responseActionsDisabled = report.status === 'resolved' || isReservedByAnotherResponder;

  // The main report card — shared across all variants
  const reportCard = (
    <Card
      className="soft-card card-container"
      title={report.category}
      extra={<StatusTag status={report.status} />}
    >
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        {/* Tag row — admin/responder show AI category + role label; resident omits these */}
        {!isResident && (
          <Space wrap>
            {report.verifiedBy && <Tag color="geekblue">Reviewed</Tag>}
            {/* {report.aiSuggestedCategory && (
              <Tag color="purple">AI: {report.aiSuggestedCategory}</Tag>
            )} */}
            {/* <Tag>{getRoleLabel(profile?.role)}</Tag> */}
          </Space>
        )}

        {((report.subcategory && report.subcategory !== 'undefined') || report.severity) && (
          <Space wrap>
            {report.subcategory && report.subcategory !== 'undefined' && (
              <Tag>{report.subcategory}</Tag>
            )}
            <SeverityTag severity={report.severity} />
          </Space>
        )}

        {(report.aiSummary || report.aiSuggestedCategory) && (
          <Alert
            type="info"
            showIcon
            icon={<RobotOutlined />}
            message={
              <Space size={8} wrap>
                <Text strong>AI Analysis</Text>
                {report.aiSuggestedCategory && report.aiSuggestedCategory !== report.category && (
                  <Tag color="blue">Suggested: {report.aiSuggestedCategory}</Tag>
                )}
              </Space>
            }
            description={report.aiSummary}
          />
        )}

        <Paragraph>{report.description}</Paragraph>

        <Space direction="vertical" size={10} style={{ width: '100%' }}>
          {report.location?.address && (
            <Space size={6}>
              <EnvironmentOutlined />
              <Text strong>{report.location.address}</Text>
            </Space>
          )}

          <Space size={16}>
            <Space size={4}>
              <ClockCircleOutlined />
              <Text type="secondary">{new Date(report.createdAt).toLocaleString()}</Text>
            </Space>

            <Space size={4}>
              {!isResident && report.submitterName && (
                <Space size={4}>
                  <UserOutlined />
                  <Text type="secondary">{report.submitterName}</Text>
                </Space>
              )}
            </Space>
          </Space>
        </Space>

        {!isResident && report.acknowledgedBy && (
          <Space direction="vertical" size={4}>
            <Text>Lead responder: {report.acknowledgedByName || report.acknowledgedBy}</Text>
            {backupResponderNames.length > 0 && (
              <Text type="secondary">Backup: {backupResponderNames.join(', ')}</Text>
            )}
          </Space>
        )}

        {/* Map — responder gets route view, everyone else gets static */}
        {variant === 'responder' ? (
          <Card size="small">
            <Space direction="vertical" style={{ width: '100%' }}>
              <Text strong>Routing view</Text>
              <RouteMap incidentLat={lat} incidentLng={lng} />
            </Space>
          </Card>
        ) : (
          <StaticMap latitude={lat} longitude={lng} />
        )}

        {/* Photo gallery — shown to resident (their own submission) */}
        {report.photos?.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <Image.PreviewGroup>
              {report.photos.map((p, i) => (
                <Image
                  key={i}
                  src={
                    p.startsWith('http') || p.startsWith('data:')
                      ? p
                      : `${import.meta.env.VITE_API_URL || ''}${p}`
                  }
                  width={120}
                  style={{ marginRight: 8 }}
                />
              ))}
            </Image.PreviewGroup>
          </div>
        )}

        <Divider />

        {/* Timeline — resident sees "status — date"; admin/responder see "status by X at date" */}
        <Timeline>
          {statusHistory.map((entry, i) => {
            const isLatest = i === statusHistory.length - 1;
            return (
              <Timeline.Item key={i} color={isLatest ? 'var(--brand-primary)' : 'gray'}>
                <Text type={isLatest ? undefined : 'secondary'} strong={isLatest}>
                  {isResident
                    ? `${formatStatus(entry.status)} — ${new Date(entry.timestamp).toLocaleString()}`
                    : `${formatStatus(entry.status)} by ${entry.updatedBy} at ${new Date(entry.timestamp).toLocaleString()}`}
                </Text>
              </Timeline.Item>
            );
          })}
        </Timeline>
      </Space>
    </Card>
  );

  // Resident: simple full-width layout, no actions panel
  if (isResident) {
    return (
      <div className="page-shell">
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate(-1)}
          style={{ marginBottom: 16 }}
        >
          Back
        </Button>
        {reportCard}
      </div>
    );
  }

  // Admin / responder: two-column layout with actions panel on the right
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
          {reportCard}
        </Col>

        <Col xs={24} xl={8}>
          <Card className="soft-card" title="Actions">
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              {isResponder && !report.acknowledgedBy && (
                <Button
                  block
                  type="primary"
                  icon={<CheckOutlined />}
                  disabled={
                    responseActionsDisabled || !['pending', 'verified'].includes(report.status)
                  }
                  onClick={() => acknowledgeMutation.mutate()}
                  loading={acknowledgeMutation.isPending}
                >
                  Acknowledge
                </Button>
              )}

              {canJoinBackup && (
                <Button
                  block
                  type="primary"
                  icon={<UserAddOutlined />}
                  onClick={() => joinBackupMutation.mutate()}
                  loading={joinBackupMutation.isPending}
                >
                  Join as backup
                </Button>
              )}

              {isResponder &&
                !isOwner &&
                !isBackupResponder &&
                report.acknowledgedBy &&
                !openBackupRequest &&
                report.status !== 'resolved' && (
                  <Text type="secondary">
                    Being handled by {report.acknowledgedByName || report.acknowledgedBy}
                  </Text>
                )}

              {isOwner && (
                <>
                  {report.status === 'acknowledged' && (
                    <Button
                      block
                      type="primary"
                      disabled={responseActionsDisabled}
                      onClick={() => updateStatus.mutate('in_progress')}
                      loading={updateStatus.isPending}
                    >
                      Mark in progress
                    </Button>
                  )}
                </>
              )}

              {isResponder &&
                (isOwner || isBackupResponder) &&
                ['in_progress', 'en_route', 'on_scene'].includes(report.status) && (
                  <Button
                    block
                    type="primary"
                    disabled={responseActionsDisabled}
                    onClick={() => updateStatus.mutate('resolved')}
                    loading={updateStatus.isPending}
                  >
                    Mark resolved
                  </Button>
                )}

              {isOversightRole && (role === 'captain' || report.category === 'Blotter Cases') && (
                <Button
                  block
                  type="primary"
                  disabled={report.status === 'resolved'}
                  onClick={() => updateStatus.mutate('resolved')}
                  loading={updateStatus.isPending}
                >
                  Mark resolved
                </Button>
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

              {isOwner && openBackupRequest && (
                <Button
                  block
                  icon={<CheckOutlined />}
                  disabled={responseActionsDisabled}
                  onClick={() => closeBackupMutation.mutate()}
                  loading={closeBackupMutation.isPending}
                >
                  Enough help
                </Button>
              )}

              {isOwner && !openBackupRequest && (
                <Button
                  block
                  danger
                  disabled={responseActionsDisabled}
                  onClick={() => backupMutation.mutate()}
                  loading={backupMutation.isPending}
                >
                  {openBackupRequest ? 'Backup requested' : 'Request backup'}
                </Button>
              )}
            </Space>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
