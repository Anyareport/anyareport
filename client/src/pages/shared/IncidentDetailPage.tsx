import { useRef, useState, type TouchEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Avatar,
  Button,
  Empty,
  Image,
  Space,
  Spin,
  Timeline,
  Typography,
  message,
} from 'antd';
import {
  ArrowLeftOutlined,
  CheckOutlined,
  CompassOutlined,
  DownloadOutlined,
  EnvironmentOutlined,
  LeftOutlined,
  RightOutlined,
  RobotOutlined,
  UserAddOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { api, type AuditLog, type Report } from '../../lib/api';
import StatusTag from '../../components/StatusTag';
import SeverityTag from '../../components/SeverityTag';
import { StaticMap, RouteMap } from '../../components/map/MapPicker';
import { useAuth } from '../../contexts/AuthContext';
import {
  BLOTTER_REPORT_CATEGORY,
  getStatusLabel,
  normalizeReportStatus,
} from '../../lib/reportWorkflow';
import IncidentStatusSteps from './IncidentStatusSteps';
import './IncidentDetailPage.css';

const { Paragraph, Text, Title } = Typography;

interface IncidentDetailPageProps {
  variant: 'admin' | 'responder' | 'resident';
}

interface BackupRequestResponse {
  report: Report;
  alreadyRequested: boolean;
}

function getPhotoUrl(photo: string) {
  return photo.startsWith('http') || photo.startsWith('data:')
    ? photo
    : `${import.meta.env.VITE_API_URL || ''}${photo}`;
}

function getAuditLabel(entry: AuditLog) {
  const status = typeof entry.metadata?.status === 'string' ? entry.metadata.status : null;
  switch (entry.action) {
    case 'report_submitted':
      return 'Report received';
    case 'report_classified':
      return 'Classified by AI';
    case 'report_recipients_notified':
      return 'Response team notified';
    case 'report_acknowledged':
      return `Acknowledged by ${entry.actorName || 'Responder'}`;
    case 'backup_requested':
      return 'Backup requested';
    case 'backup_joined':
      return `${entry.actorName || 'Responder'} joined as backup`;
    case 'backup_request_closed':
      return 'Backup request closed';
    case 'status_updated':
      return status
        ? `${getStatusLabel(status)} by ${entry.actorName || 'Official'}`
        : 'Status updated';
    case 'report_flagged':
      return 'Report flagged';
    default:
      return entry.action.replace(/_/g, ' ');
  }
}

function getHistoryLabel(status: string, actor?: string) {
  const canonicalStatus = normalizeReportStatus(status);
  if (canonicalStatus === 'coordinating') return `Acknowledged by ${actor || 'Responder'}`;
  if (canonicalStatus === 'pending') return 'Report received';
  const label = getStatusLabel(status);
  return actor ? `${label} by ${actor}` : label;
}

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

async function downloadFile(path: string, filename: string) {
  try {
    const blob = await api.download(path);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  } catch (error) {
    message.error(error instanceof Error ? error.message : 'Download failed');
  }
}

export default function IncidentDetailPage({ variant }: IncidentDetailPageProps) {
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const galleryTouchStart = useRef<{ x: number; y: number } | null>(null);
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

  const canViewReportAudit =
    variant === 'admin' &&
    (role === 'admin' || (role === 'secretary' && report?.category === BLOTTER_REPORT_CATEGORY));
  const { data: auditEntries = [] } = useQuery({
    queryKey: ['report-audit', id],
    queryFn: () => api.get<AuditLog[]>(`/api/reports/${id}/audit`),
    enabled: !!id && canViewReportAudit,
    refetchInterval: 30000,
  });

  const invalidateReportViews = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['report', id] }),
      queryClient.invalidateQueries({ queryKey: ['admin-reports'] }),
      queryClient.invalidateQueries({ queryKey: ['responder-reports'] }),
      queryClient.invalidateQueries({ queryKey: ['responder-alerts'] }),
      queryClient.invalidateQueries({ queryKey: ['responder-handled-reports'] }),
      queryClient.invalidateQueries({ queryKey: ['responder-history'] }),
      queryClient.invalidateQueries({ queryKey: ['my-reports'] }),
      queryClient.invalidateQueries({ queryKey: ['admin-dashboard-reports'] }),
      queryClient.invalidateQueries({ queryKey: ['admin-dashboard-analytics'] }),
      queryClient.invalidateQueries({ queryKey: ['admin-analytics'] }),
      queryClient.invalidateQueries({ queryKey: ['secretary-intake'] }),
      queryClient.invalidateQueries({ queryKey: ['captain-inactive-reports'] }),
      queryClient.invalidateQueries({ queryKey: ['report-audit', id] }),
    ]);
  };

  const updateStatus = useMutation({
    mutationFn: (status: 'in_progress' | 'resolved') =>
      api.patch<Report>(`/api/reports/${id}/status`, { status }),
    onSuccess: invalidateReportViews,
    onError: (error: Error) => message.error(error.message),
  });

  const acknowledgeMutation = useMutation({
    mutationFn: () => api.patch<Report>(`/api/reports/${id}/acknowledge`, {}),
    onSuccess: async () => {
      await invalidateReportViews();
      message.success('Incident acknowledged');
    },
    onError: (error: Error) => message.error(error.message),
  });

  const backupMutation = useMutation({
    mutationFn: () => api.post<BackupRequestResponse>(`/api/reports/${id}/backup`, {}),
    onSuccess: async ({ alreadyRequested }) => {
      await invalidateReportViews();
      message.success(alreadyRequested ? 'Backup is already requested' : 'Backup requested');
    },
    onError: (error: Error) => message.error(error.message),
  });

  const joinBackupMutation = useMutation({
    mutationFn: () =>
      api.post<{ report: Report; alreadyJoined: boolean }>(`/api/reports/${id}/backup/join`, {}),
    onSuccess: async ({ alreadyJoined }) => {
      await invalidateReportViews();
      await queryClient.invalidateQueries({ queryKey: ['notifications'] });
      message.success(alreadyJoined ? 'You are already assisting' : 'You joined as backup');
    },
    onError: (error: Error) => message.error(error.message),
  });

  const closeBackupMutation = useMutation({
    mutationFn: () =>
      api.post<{ report: Report; alreadyClosed: boolean }>(`/api/reports/${id}/backup/close`, {}),
    onSuccess: async ({ alreadyClosed }) => {
      await invalidateReportViews();
      message.success(alreadyClosed ? 'Backup request is already closed' : 'No more backup needed');
    },
    onError: (error: Error) => message.error(error.message),
  });

  if (isLoading) {
    return (
      <div className="incident-loading">
        <Spin size="large" />
      </div>
    );
  }

  if (!report) {
    return <Alert type="error" showIcon message="Report not found" />;
  }

  const isResident = variant === 'resident';
  const isResponder = variant === 'responder' && ['tanod', 'responder'].includes(role || '');
  const isBlotter = report.category === BLOTTER_REPORT_CATEGORY;
  const status = normalizeReportStatus(report.status);
  const isOwner = isResponder && report.acknowledgedBy === profile?.firebaseUid;
  const backupRequests = report.backupRequests ?? [];
  const openBackupRequest = backupRequests.find((request) => request.status === 'pending');
  const backupResponderUids = backupRequests.flatMap((request) => request.joinedBy ?? []);
  const backupResponderNames = [
    ...new Set(backupRequests.flatMap((request) => request.joinedByNames ?? [])),
  ];
  const isBackupResponder = isResponder && backupResponderUids.includes(profile?.firebaseUid || '');
  const isParticipant = isOwner || isBackupResponder;
  const canViewReporter =
    (variant === 'responder' && isParticipant) ||
    (variant === 'admin' && role === 'secretary' && isBlotter);
  const canJoinBackup =
    isResponder &&
    !!openBackupRequest &&
    report.acknowledgedBy !== profile?.firebaseUid &&
    !isBackupResponder &&
    status !== 'resolved';
  const photos = report.photos || [];
  const activePhoto = photos[activePhotoIndex];
  const activePhotoUrl = activePhoto ? getPhotoUrl(activePhoto) : undefined;
  const [longitude, latitude] = report.location?.coordinates || [0, 0];
  const description = report.description.trim();
  const title = description || report.subcategory || report.category;
  const referenceLabel = 'Reference pending';
  const reportHistory = report.statusHistory || [];
  const showMobileResponderActions = isResponder;
  const canStartBlotter =
    isBlotter && status === 'pending' && ['captain', 'secretary'].includes(role || '');
  const canResolveBlotter = isBlotter && status === 'in_progress' && role === 'secretary';
  const canStartFieldWork = isResponder && isOwner && status === 'coordinating';
  const canResolveFieldWork = isResponder && isParticipant && status === 'in_progress';
  const actionBusy =
    updateStatus.isPending ||
    acknowledgeMutation.isPending ||
    backupMutation.isPending ||
    joinBackupMutation.isPending ||
    closeBackupMutation.isPending;

  const showPreviousPhoto = () => {
    setActivePhotoIndex((currentIndex) => (currentIndex - 1 + photos.length) % photos.length);
  };

  const showNextPhoto = () => {
    setActivePhotoIndex((currentIndex) => (currentIndex + 1) % photos.length);
  };

  const handleGalleryTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0];
    galleryTouchStart.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleGalleryTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    const start = galleryTouchStart.current;
    galleryTouchStart.current = null;
    if (!start || photos.length < 2) return;

    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    if (Math.abs(deltaX) < 48 || Math.abs(deltaX) < Math.abs(deltaY)) return;

    if (deltaX > 0) showPreviousPhoto();
    else showNextPhoto();
  };

  const handleGalleryKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      showPreviousPhoto();
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      showNextPhoto();
    }
  };

  const responderAction = canJoinBackup ? (
    <Button
      block
      size="large"
      type="primary"
      icon={<UserAddOutlined />}
      loading={joinBackupMutation.isPending}
      onClick={() => joinBackupMutation.mutate()}
    >
      Join as assisting responder
    </Button>
  ) : isResponder && !report.acknowledgedBy && status === 'pending' ? (
    <Button
      block
      size="large"
      type="primary"
      icon={<CheckOutlined />}
      loading={acknowledgeMutation.isPending}
      onClick={() => acknowledgeMutation.mutate()}
    >
      Acknowledge
    </Button>
  ) : canStartFieldWork ? (
    <Button
      block
      size="large"
      type="primary"
      disabled={actionBusy}
      loading={updateStatus.isPending}
      onClick={() => updateStatus.mutate('in_progress')}
    >
      Start work
    </Button>
  ) : canResolveFieldWork ? (
    <Button
      block
      size="large"
      type="primary"
      disabled={actionBusy}
      loading={updateStatus.isPending}
      onClick={() => updateStatus.mutate('resolved')}
    >
      Mark resolved
    </Button>
  ) : null;

  const oversightAction = canStartBlotter ? (
    <Button
      block
      size="large"
      type="primary"
      disabled={actionBusy}
      loading={updateStatus.isPending}
      onClick={() => updateStatus.mutate('in_progress')}
    >
      Start processing
    </Button>
  ) : canResolveBlotter ? (
    <Button
      block
      size="large"
      type="primary"
      disabled={actionBusy}
      loading={updateStatus.isPending}
      onClick={() => updateStatus.mutate('resolved')}
    >
      Mark resolved
    </Button>
  ) : null;

  const actionPanel = isResident ? null : isResponder ? (
    <section className="incident-side-section" aria-labelledby="incident-actions-heading">
      <h2 id="incident-actions-heading">Response</h2>
      {responderAction || (
        <Text type="secondary">
          {status === 'resolved'
            ? 'This incident is resolved.'
            : report.acknowledgedBy
              ? `Being handled by ${report.acknowledgedByName || 'the lead responder'}.`
              : 'No response action is available for this report.'}
        </Text>
      )}
      {isOwner && status !== 'resolved' && (
        <Button
          block
          disabled={actionBusy || !!openBackupRequest}
          loading={backupMutation.isPending}
          onClick={() => backupMutation.mutate()}
        >
          {openBackupRequest ? 'Backup requested' : 'Request backup'}
        </Button>
      )}
      {isOwner && openBackupRequest && (
        <Button
          block
          icon={<CheckOutlined />}
          disabled={actionBusy}
          loading={closeBackupMutation.isPending}
          onClick={() => closeBackupMutation.mutate()}
        >
          Enough help
        </Button>
      )}
      {isResponder && status !== 'resolved' && (
        <Space className="incident-quick-actions" wrap>
          <Button
            icon={<CompassOutlined />}
            href={`https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`}
            target="_blank"
            rel="noreferrer"
          >
            Navigate
          </Button>
        </Space>
      )}
    </section>
  ) : role === 'admin' ? (
    <section className="incident-side-section" aria-labelledby="incident-access-heading">
      <h2 id="incident-access-heading">Access</h2>
      <Text type="secondary">
        Read-only. Admins manage accounts and system logs, not incident status.
      </Text>
      <Button
        block
        icon={<DownloadOutlined />}
        onClick={() => downloadFile('/api/audit-logs?format=csv', 'anyareport-audit.csv')}
      >
        Export system log
      </Button>
    </section>
  ) : isBlotter ? (
    <section className="incident-side-section" aria-labelledby="incident-actions-heading">
      <h2 id="incident-actions-heading">Actions</h2>
      {oversightAction || (
        <Text type="secondary">
          {role === 'captain'
            ? 'Only the Secretary can mark a blotter case as resolved.'
            : status === 'resolved'
              ? 'This blotter case is resolved.'
              : 'Blotter processing is managed by the Captain and Secretary.'}
        </Text>
      )}
      {role === 'secretary' && (
        <Button
          block
          icon={<DownloadOutlined />}
          disabled={!auditEntries.length}
          onClick={() =>
            downloadFile(`/api/reports/${id}/audit?format=csv`, `report-${id}-audit.csv`)
          }
        >
          Export case audit
        </Button>
      )}
    </section>
  ) : (
    <section className="incident-side-section" aria-labelledby="incident-actions-heading">
      <h2 id="incident-actions-heading">Monitoring</h2>
      <Text type="secondary">Field status changes are handled by tanods and responders.</Text>
    </section>
  );

  const historyTimeline = (
    <Timeline
      items={reportHistory.map((entry, index) => ({
        color: index === reportHistory.length - 1 ? 'blue' : 'gray',
        children: (
          <div className="incident-timeline-entry">
            <Text strong>
              {getHistoryLabel(entry.status, isResident ? undefined : entry.updatedBy)}
            </Text>
            <Text type="secondary">{new Date(entry.timestamp).toLocaleString()}</Text>
          </div>
        ),
      }))}
    />
  );

  const auditTimeline = (
    <Timeline
      items={auditEntries.map((entry) => ({
        color: 'blue',
        children: (
          <div className="incident-timeline-entry">
            <Text strong>{getAuditLabel(entry)}</Text>
            <Text type="secondary">
              {new Date(entry.timestamp).toLocaleString()}
              {entry.actorName ? ` · ${entry.actorName}` : ' · System'}
            </Text>
          </div>
        ),
      }))}
    />
  );

  const titleBlock = (
    <div className="incident-title-block">
      <Text className="incident-eyebrow">
        {isBlotter ? 'Blotter case' : report.category}
        {report.subcategory ? ` · ${report.subcategory}` : ''}
      </Text>
      <Title level={1}>{title}</Title>
      <Space wrap size={[8, 8]} className="incident-meta-tags">
        <SeverityTag severity={report.severity} />
        <StatusTag status={status} />
      </Space>
      <Space wrap className="incident-reference-line">
        <Text>{referenceLabel}</Text>
        <Text type="secondary">{new Date(report.createdAt).toLocaleString()}</Text>
      </Space>
    </div>
  );

  const progress = <IncidentStatusSteps category={report.category} status={status} />;

  const reportHero = (
    <section
      className={photos.length ? 'incident-gallery' : 'incident-hero'}
      aria-label={photos.length ? 'Report photo' : 'Incident location'}
    >
      {photos.length > 0 && activePhotoUrl ? (
        <div
          className="incident-gallery__stage"
          role="group"
          aria-label={`Photo ${activePhotoIndex + 1} of ${photos.length}`}
          tabIndex={photos.length > 1 ? 0 : undefined}
          onTouchStart={handleGalleryTouchStart}
          onTouchEnd={handleGalleryTouchEnd}
          onKeyDown={handleGalleryKeyDown}
        >
          <img
            className="incident-gallery__backdrop"
            src={activePhotoUrl}
            alt=""
            aria-hidden="true"
          />
          <Image.PreviewGroup>
            <Image
              className="incident-gallery__image"
              src={activePhotoUrl}
              alt={`Report photo ${activePhotoIndex + 1}`}
            />
          </Image.PreviewGroup>
          {photos.length > 1 && (
            <>
              <Button
                className="incident-gallery__control incident-gallery__control--previous"
                shape="circle"
                icon={<LeftOutlined />}
                aria-label="Previous photo"
                title="Previous photo"
                onClick={showPreviousPhoto}
              />
              <Button
                className="incident-gallery__control incident-gallery__control--next"
                shape="circle"
                icon={<RightOutlined />}
                aria-label="Next photo"
                title="Next photo"
                onClick={showNextPhoto}
              />
              <span className="incident-gallery__count" aria-live="polite">
                {activePhotoIndex + 1} / {photos.length}
              </span>
            </>
          )}
        </div>
      ) : (
        <div className="incident-hero-map">
          {variant === 'responder' ? (
            <RouteMap incidentLat={latitude} incidentLng={longitude} />
          ) : (
            <StaticMap latitude={latitude} longitude={longitude} height={340} />
          )}
        </div>
      )}
    </section>
  );

  return (
    <main className={`incident-detail incident-detail--${variant}`}>
      <header className="incident-detail-header">
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>
          Back
        </Button>
        {variant === 'admin' && <Text className="incident-role-label">{role?.toUpperCase()}</Text>}
      </header>

      <div className="incident-detail-grid">
        <article className="incident-main">
          {variant === 'admin' ? (
            <>
              {titleBlock}
              {progress}
              {reportHero}
            </>
          ) : (
            <>
              {reportHero}
              {titleBlock}
              {progress}
            </>
          )}

          {report.aiSummary && (
            <section className="incident-ai-summary">
              <div className="incident-section-label">
                <RobotOutlined /> <Text strong>AI summary</Text>
              </div>
              <Paragraph>{report.aiSummary}</Paragraph>
              {report.aiSuggestedCategory && report.aiSuggestedCategory !== report.category && (
                <Text type="secondary">Suggested category: {report.aiSuggestedCategory}</Text>
              )}
            </section>
          )}

          <section className="incident-facts" aria-label="Report details">
            <div className="incident-fact">
              <EnvironmentOutlined />
              <Text>{report.location?.address || 'Location unavailable'}</Text>
            </div>
            {description && description !== title && (
              <Paragraph className="incident-description">{description}</Paragraph>
            )}
            {!isResident && canViewReporter && (
              <div className="incident-fact">
                <UserOutlined />
                {report.submitterName ? (
                  <Text>
                    Reporter: {report.submitterName}
                    {variant === 'admin' && role === 'secretary'
                      ? report.submitterPhone
                        ? ` · ${report.submitterPhone}`
                        : ' · No contact on file'
                      : ''}
                  </Text>
                ) : (
                  <Text type="secondary">
                    {isResponder && report.acknowledgedBy !== profile?.firebaseUid
                      ? 'Reporter hidden until you acknowledge'
                      : 'Reporter details unavailable'}
                  </Text>
                )}
              </div>
            )}
            {isResponder && !canViewReporter && (
              <div className="incident-fact">
                <UserOutlined />
                <Text type="secondary">Reporter hidden until you acknowledge</Text>
              </div>
            )}
            {!isResident && report.acknowledgedBy && (
              <div className="incident-participants">
                <div className="incident-participant-group">
                  <Text strong>Lead</Text>
                  <span className="incident-participant-chip">
                    <Avatar size={22}>
                      {getInitials(report.acknowledgedByName || 'Responder')}
                    </Avatar>
                    {report.acknowledgedByName || 'Responder'}
                  </span>
                </div>
                {backupResponderNames.length > 0 && (
                  <div className="incident-participant-group">
                    <Text strong>Backup</Text>
                    <div className="incident-participant-list">
                      {backupResponderNames.map((name) => (
                        <span key={name} className="incident-participant-chip">
                          <Avatar size={22}>{getInitials(name)}</Avatar>
                          {name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>

          {photos.length > 0 && (
            <section className="incident-location-section">
              <h2>Location</h2>
              {variant === 'responder' ? (
                <RouteMap incidentLat={latitude} incidentLng={longitude} />
              ) : (
                <StaticMap latitude={latitude} longitude={longitude} height={250} />
              )}
            </section>
          )}

          {variant === 'resident' && (
            <section className="incident-history-section">
              <h2>Report history</h2>
              {reportHistory.length ? historyTimeline : <Empty description="No updates yet" />}
            </section>
          )}
        </article>

        {!isResident && (
          <aside className="incident-aside">
            {actionPanel}

            {variant === 'admin' && role !== 'admin' && (
              <section
                className="incident-side-section"
                aria-labelledby="incident-timeline-heading"
              >
                <h2 id="incident-timeline-heading">Timeline</h2>
                {reportHistory.length ? (
                  historyTimeline
                ) : (
                  <Empty description="No activity recorded" />
                )}
              </section>
            )}

            {canViewReportAudit && (
              <section className="incident-side-section" aria-labelledby="incident-audit-heading">
                <div className="incident-panel-heading">
                  <h2 id="incident-audit-heading">
                    {role === 'admin' ? 'Audit trail' : 'Case activity'}
                  </h2>
                  {role === 'admin' && (
                    <Button
                      size="small"
                      icon={<DownloadOutlined />}
                      onClick={() =>
                        downloadFile('/api/audit-logs?format=csv', 'anyareport-audit.csv')
                      }
                    >
                      Export system log
                    </Button>
                  )}
                </div>
                {auditEntries.length ? (
                  auditTimeline
                ) : (
                  <Empty description="No audit events recorded" />
                )}
              </section>
            )}
          </aside>
        )}
      </div>

      {showMobileResponderActions && <div className="incident-mobile-actions">{actionPanel}</div>}
    </main>
  );
}
