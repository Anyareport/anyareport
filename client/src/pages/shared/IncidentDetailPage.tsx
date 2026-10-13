import { useRef, useState, type TouchEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Avatar,
  Button,
  Card,
  Empty,
  Form,
  Image,
  Input,
  Modal,
  Radio,
  Space,
  Spin,
  Timeline,
  Typography,
  Select,
  Upload,
  message,
} from 'antd';
import type { UploadFile } from 'antd';
import {
  ArrowLeftOutlined,
  CheckOutlined,
  CompassOutlined,
  DownOutlined,
  DownloadOutlined,
  EnvironmentOutlined,
  LeftOutlined,
  RightOutlined,
  RobotOutlined,
  UserAddOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { api, type AuditLog, type DispatchResponder, type Report } from '../../lib/api';
import StatusTag from '../../components/StatusTag';
import SeverityTag from '../../components/SeverityTag';
import EmergencyHotline from '../../components/EmergencyHotline';
import { StaticMap, RouteMap } from '../../components/map/MapPicker';
import { useAuth } from '../../contexts/AuthContext';
import { useLang } from '../../contexts/LanguageContext';
import { getLocalizedCategory, getLocalizedStatus, type LabelKey } from '../../i18n/labels';
import { notificationFeedQueryKey } from '../../lib/notificationFeed';
import { invalidateReportQueries } from '../../lib/reportUpdates';
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

interface DispatchOptionsResponse {
  responders: DispatchResponder[];
}

interface ResolutionFormValues {
  summary: string;
  actionsTaken: string;
  outcome: string;
  furtherActionRequired: boolean;
  furtherActionRecommendation?: string;
  assistanceRequested: boolean;
}

function getPhotoUrl(photo: string) {
  return photo.startsWith('http') || photo.startsWith('data:')
    ? photo
    : `${import.meta.env.VITE_API_URL || ''}${photo}`;
}

function getAuditLabel(entry: AuditLog) {
  const status = typeof entry.metadata?.status === 'string' ? entry.metadata.status : null;
  const hotlineAgency =
    typeof entry.metadata?.agency === 'string' ? entry.metadata.agency : 'an emergency agency';
  switch (entry.action) {
    case 'report_submitted':
      return 'Report received';
    case 'report_classified':
      return 'Classified by AI';
    case 'report_recipients_notified':
      return 'Response team notified';
    case 'hotline_opened':
      return `Hotline opened: ${hotlineAgency}`;
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
    case 'resolution_submitted':
      return `Resolution submitted by ${entry.actorName || 'Responder'}`;
    case 'resolution_verified':
      return `Resolution verified by ${entry.actorName || 'Official'}`;
    default:
      return entry.action.replace(/_/g, ' ');
  }
}

function getHistoryLabel(status: string, actor?: string, translate?: (key: LabelKey) => string) {
  const canonicalStatus = normalizeReportStatus(status);
  if (canonicalStatus === 'coordinating') {
    return `${translate ? translate('acknowledgedBy') : 'Acknowledged by'} ${actor || 'Responder'}`;
  }
  if (canonicalStatus === 'pending')
    return translate ? translate('reportReceived') : 'Report received';
  const label = translate ? getLocalizedStatus(status, translate) : getStatusLabel(status);
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
  const { lang, t } = useLang();
  const useFilipinoLabels = lang === 'fil' && ['tanod', 'responder'].includes(role || '');
  const text = (key: LabelKey, english: string) => (useFilipinoLabels ? t(key) : english);
  const [selectedResponderUids, setSelectedResponderUids] = useState<string[]>([]);
  const [resolutionOpen, setResolutionOpen] = useState(false);
  const [resolutionViewOpen, setResolutionViewOpen] = useState(false);
  const [evidenceFiles, setEvidenceFiles] = useState<UploadFile[]>([]);

  const { data: report, isLoading } = useQuery({
    queryKey: ['report', id],
    queryFn: () => api.get<Report>(`/api/reports/${id}`),
    enabled: !!id,
    refetchInterval: 15000,
  });

  const resolutionMutation = useMutation({
    mutationFn: (values: ResolutionFormValues) => {
      const formData = new FormData();
      formData.append('summary', values.summary);
      formData.append('actionsTaken', values.actionsTaken);
      formData.append('outcome', values.outcome);
      formData.append('furtherActionRequired', String(values.furtherActionRequired));
      formData.append('furtherActionRecommendation', values.furtherActionRecommendation || '');
      formData.append('assistanceRequested', String(values.assistanceRequested));
      evidenceFiles.forEach((file) => {
        if (file.originFileObj) formData.append('evidence', file.originFileObj);
      });
      return api.post<Report>(`/api/reports/${id}/resolution`, formData);
    },
    onSuccess: async () => {
      setResolutionOpen(false);
      setEvidenceFiles([]);
      await invalidateReportViews();
      await queryClient.invalidateQueries({ queryKey: ['report-audit', id] });
      message.success(useFilipinoLabels ? t('resolutionSuccess') : 'Resolution submitted');
    },
    onError: (error: Error) => message.error(error.message),
  });

  const verifyResolutionMutation = useMutation({
    mutationFn: () => api.patch<Report>(`/api/reports/${id}/resolution/verify`, {}),
    onSuccess: async () => {
      await invalidateReportViews();
      await queryClient.invalidateQueries({ queryKey: ['report-audit', id] });
      message.success('Resolution verified');
    },
    onError: (error: Error) => message.error(error.message),
  });
  const dispatchStatus = normalizeReportStatus(report?.status || report?.workflowStatus || '');
  const isCivilBlotterReport =
    report?.category === BLOTTER_REPORT_CATEGORY && report.subcategory === 'Civil';
  const canDispatchCurrentStatus =
    dispatchStatus === 'in_progress' ||
    (!isCivilBlotterReport && dispatchStatus === 'pending' && !report?.acknowledgedBy);
  const canDispatch =
    ['captain', 'secretary'].includes(role || '') &&
    canDispatchCurrentStatus &&
    (report?.category === 'Public Concerns' ||
      report?.category === 'Emergency Situations' ||
      (report?.category === BLOTTER_REPORT_CATEGORY &&
        ['Criminal', 'Civil'].includes(report?.subcategory || '')));
  const {
    data: dispatchOptions,
    isLoading: dispatchOptionsLoading,
    error: dispatchOptionsError,
  } = useQuery({
    queryKey: ['report-dispatch-options', id],
    queryFn: () => api.get<DispatchOptionsResponse>(`/api/reports/${id}/dispatch-options`),
    enabled: !!id && canDispatch,
    refetchInterval: 15000,
  });

  const canViewReportAudit =
    variant === 'admin' && ['admin', 'captain', 'secretary'].includes(role || '');
  const showStatusTimeline = variant !== 'admin' || role !== 'admin';
  const { data: auditEntries = [] } = useQuery({
    queryKey: ['report-audit', id],
    queryFn: () => api.get<AuditLog[]>(`/api/reports/${id}/audit`),
    enabled: !!id && canViewReportAudit,
    refetchInterval: 30000,
  });

  const invalidateReportViews = () => invalidateReportQueries(queryClient, id);

  const updateStatus = useMutation({
    mutationFn: (status: 'in_progress' | 'resolved') =>
      api.patch<Report>(`/api/reports/${id}/status`, { status }),
    onSuccess: async (_report, status) => {
      await invalidateReportViews();
      if (['tanod', 'responder'].includes(role || '')) {
        message.success(t(status === 'in_progress' ? 'startWorkSuccess' : 'resolutionSuccess'));
      }
    },
    onError: (error: Error) => message.error(error.message),
  });

  const acknowledgeMutation = useMutation({
    mutationFn: () => api.patch<Report>(`/api/reports/${id}/acknowledge`, {}),
    onSuccess: async () => {
      await invalidateReportViews();
      message.success(t('acknowledgeSuccess'));
    },
    onError: (error: Error) => message.error(error.message),
  });

  const backupMutation = useMutation({
    mutationFn: () => api.post<BackupRequestResponse>(`/api/reports/${id}/backup`, {}),
    onSuccess: async ({ alreadyRequested }) => {
      await invalidateReportViews();
      message.success(t(alreadyRequested ? 'requestBackupAlready' : 'requestBackupSuccess'));
    },
    onError: (error: Error) => message.error(error.message),
  });

  const joinBackupMutation = useMutation({
    mutationFn: () =>
      api.post<{ report: Report; alreadyJoined: boolean }>(`/api/reports/${id}/backup/join`, {}),
    onSuccess: async ({ alreadyJoined }) => {
      await invalidateReportViews();
      await queryClient.invalidateQueries({ queryKey: notificationFeedQueryKey });
      message.success(t(alreadyJoined ? 'joinBackupAlready' : 'joinBackupSuccess'));
    },
    onError: (error: Error) => message.error(error.message),
  });

  const closeBackupMutation = useMutation({
    mutationFn: () =>
      api.post<{ report: Report; alreadyClosed: boolean }>(`/api/reports/${id}/backup/close`, {}),
    onSuccess: async ({ alreadyClosed }) => {
      await invalidateReportViews();
      message.success(t(alreadyClosed ? 'closeBackupAlready' : 'closeBackupSuccess'));
    },
    onError: (error: Error) => message.error(error.message),
  });

  const dispatchMutation = useMutation({
    mutationFn: () =>
      api.post<{ report: Report }>(`/api/reports/${id}/dispatch`, {
        responderUids: selectedResponderUids,
      }),
    onSuccess: async () => {
      setSelectedResponderUids([]);
      await invalidateReportViews();
      await queryClient.invalidateQueries({ queryKey: ['report-dispatch-options', id] });
      message.success('Incident dispatched');
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
    return <Alert type="error" showIcon message={text('reportNotFound', 'Report not found')} />;
  }

  const isResident = variant === 'resident';
  const isResponder = variant === 'responder' && ['tanod', 'responder'].includes(role || '');
  const isBlotter = report.category === BLOTTER_REPORT_CATEGORY;
  const status = dispatchStatus;
  const isTerminalStatus = status === 'resolved' || status === 'flagged';
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
    (variant === 'admin' && ['admin', 'captain', 'secretary'].includes(role || ''));
  const canViewReporterContact =
    (variant === 'responder' && isParticipant) || (variant === 'admin' && role === 'secretary');
  const canJoinBackup =
    isResponder &&
    !!openBackupRequest &&
    report.acknowledgedBy !== profile?.firebaseUid &&
    !isBackupResponder &&
    !isTerminalStatus;
  const photos = report.photos || [];
  const activePhoto = photos[activePhotoIndex];
  const activePhotoUrl = activePhoto ? getPhotoUrl(activePhoto) : undefined;
  const [longitude, latitude] = report.location?.coordinates || [0, 0];
  const description = report.description.trim();
  const categoryLabels = getLocalizedCategory(report.category, report.subcategory, t);
  const title =
    report.aiTitle?.trim() ||
    (useFilipinoLabels
      ? categoryLabels.subcategory || categoryLabels.category
      : report.subcategory || report.category);
  const referenceLabel = report.referenceNumber
    ? `${text('reference', 'Reference')} ${report.referenceNumber}`
    : text('noReference', 'Reference not assigned');
  const reportHistory = report.statusHistory || [];
  const isCriminalBlotter = isBlotter && report.subcategory === 'Criminal';
  // Criminal blotter cases follow the responder workflow; Captain/Secretary dispatch and verify.
  const canStartBlotter =
    isBlotter &&
    !isCriminalBlotter &&
    status === 'pending' &&
    ['captain', 'secretary'].includes(role || '');
  const canResolveBlotter =
    isBlotter &&
    !isCriminalBlotter &&
    status === 'in_progress' &&
    ['captain', 'secretary'].includes(role || '');
  const hotlineAction =
    variant !== 'resident' &&
    (role === 'captain' || isResponder) &&
    (report.category === 'Emergency Situations' || isCriminalBlotter) ? (
      <EmergencyHotline
        reportId={report._id}
        category={report.category}
        subcategory={report.subcategory}
        referenceNumber={report.referenceNumber}
      />
    ) : null;
  const isCaptain = variant === 'admin' && role === 'captain';
  const captainResponseAction =
    isCaptain && hotlineAction ? (
      <Card
        className="soft-card incident-side-section incident-mobile-hide-panel"
        role="region"
        aria-label={text('responseHeading', 'Response')}
        title={text('responseHeading', 'Response')}
      >
        {hotlineAction}
      </Card>
    ) : null;
  const showMobileResponderActions = isResponder || !!captainResponseAction;
  const canStartFieldWork =
    isResponder && isOwner && status === 'coordinating' && (!isBlotter || isCriminalBlotter);
  const canResolveFieldWork =
    isResponder && isOwner && status === 'in_progress' && (!isBlotter || isCriminalBlotter);
  const canUseResponderBackup = !isBlotter || isCriminalBlotter;
  const canReviewResolution =
    variant === 'admin' && ['captain', 'secretary'].includes((role || '').toLowerCase());
  const actionBusy =
    updateStatus.isPending ||
    acknowledgeMutation.isPending ||
    backupMutation.isPending ||
    joinBackupMutation.isPending ||
    closeBackupMutation.isPending ||
    dispatchMutation.isPending ||
    resolutionMutation.isPending ||
    verifyResolutionMutation.isPending;

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
      {t('joinBackup')}
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
      {t('acknowledge')}
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
      {t('startWork')}
    </Button>
  ) : canResolveFieldWork ? (
    <Button
      block
      size="large"
      type="primary"
      disabled={actionBusy}
      loading={updateStatus.isPending}
      onClick={() => setResolutionOpen(true)}
    >
      {t('resolve')}
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
      onClick={() => setResolutionOpen(true)}
    >
      Mark resolved
    </Button>
  ) : null;

  const dispatchAction = canDispatch ? (
    <Card
      className="soft-card incident-side-section incident-mobile-hide-panel"
      role="region"
      aria-label="Dispatch response team"
      title="Dispatch response team"
    >
      <Text type="secondary">
        {status === 'in_progress'
          ? 'Select available tanods or responders to assist'
          : isBlotter && report.subcategory === 'Civil'
            ? 'Select one or more tanods or responders to assist with this civil case.'
            : 'Select one or more available tanods or responders. The first selected person will lead.'}
      </Text>
      {dispatchOptionsError && (
        <Alert
          type="error"
          showIcon
          message="Unable to load available responders"
          description={
            dispatchOptionsError instanceof Error
              ? dispatchOptionsError.message
              : 'The responder list could not be retrieved.'
          }
          style={{ marginTop: 12 }}
        />
      )}
      <Select
        mode="multiple"
        allowClear
        showSearch
        optionFilterProp="label"
        placeholder="Select available tanods or responders"
        value={selectedResponderUids}
        onChange={setSelectedResponderUids}
        options={(dispatchOptions?.responders || []).map((responder) => ({
          label: `${responder.name} (${responder.role})`,
          value: responder.firebaseUid,
        }))}
        loading={dispatchOptionsLoading}
        disabled={actionBusy}
        style={{ width: '100%', marginTop: 12 }}
        notFoundContent={
          dispatchOptionsLoading
            ? 'Loading available tanods and responders...'
            : 'No available tanods or responders'
        }
      />
      <Button
        block
        type="primary"
        disabled={!selectedResponderUids.length || actionBusy}
        loading={dispatchMutation.isPending}
        onClick={() => dispatchMutation.mutate()}
        style={{ marginTop: 12 }}
      >
        {status === 'in_progress'
          ? 'Dispatch assisting tanods/responders'
          : 'Dispatch selected tanods/responders'}
      </Button>
    </Card>
  ) : null;

  const secretaryAction = isBlotter ? (
    <Card
      className="soft-card incident-side-section incident-mobile-hide-panel"
      role="region"
      aria-label={text('actionsHeading', 'Actions')}
      title={text('actionsHeading', 'Actions')}
    >
      {oversightAction || (
        <Text type="secondary">
          {status === 'resolved'
            ? 'This blotter case is resolved.'
            : isCriminalBlotter
              ? 'Criminal cases are worked by the dispatched tanod or responder. Dispatch a responder, then verify the resolution.'
              : 'Blotter processing is managed by the Captain and Secretary.'}
        </Text>
      )}
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
    </Card>
  ) : null;

  const actionPanel = isResident ? null : isResponder ? (
    <Card
      className="soft-card incident-side-section incident-mobile-hide-panel"
      role="region"
      aria-label={text('responseHeading', 'Response')}
      title={text('responseHeading', 'Response')}
    >
      {responderAction || (
        <Text type="secondary">
          {status === 'resolved'
            ? text('incidentResolvedNotice', 'This incident is resolved.')
            : status === 'flagged'
              ? text('reportFlaggedNotice', 'This report is flagged for review.')
              : report.acknowledgedBy
                ? `${text('beingHandledBy', 'Being handled by')} ${report.acknowledgedByName || text('leadResponder', 'the lead responder')}.`
                : text('noResponseAction', 'No response action is available for this report.')}
        </Text>
      )}
      {hotlineAction}
      {isOwner && canUseResponderBackup && !isTerminalStatus && (
        <Button
          block
          size="large"
          icon={openBackupRequest ? <CheckOutlined /> : undefined}
          disabled={actionBusy}
          loading={openBackupRequest ? closeBackupMutation.isPending : backupMutation.isPending}
          onClick={() => {
            if (openBackupRequest) closeBackupMutation.mutate();
            else backupMutation.mutate();
          }}
        >
          {openBackupRequest ? t('closeBackup') : t('requestBackup')}
        </Button>
      )}
    </Card>
  ) : role === 'admin' ? (
    <Card
      className="soft-card incident-side-section incident-mobile-hide-panel"
      role="region"
      aria-label="Access"
      title="Access"
    >
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
    </Card>
  ) : ['captain', 'secretary'].includes(role || '') ? (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      {captainResponseAction}
      {dispatchAction}
      {secretaryAction}
    </Space>
  ) : isBlotter ? (
    <Card
      className="soft-card incident-side-section incident-mobile-hide-panel"
      role="region"
      aria-label="Actions"
      title="Actions"
    >
      {oversightAction || (
        <Text type="secondary">
          {role === 'captain'
            ? status === 'resolved'
              ? 'This blotter case is resolved.'
              : 'Blotter cases can be resolved by the Captain or Secretary.'
            : status === 'resolved'
              ? 'This blotter case is resolved.'
              : isCriminalBlotter
                ? 'Criminal cases are worked by the dispatched tanod or responder.'
                : 'Blotter processing is managed by the Captain and Secretary.'}
        </Text>
      )}
      {['captain', 'secretary'].includes(role || '') && (
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
    </Card>
  ) : (
    <Card
      className="soft-card incident-side-section incident-mobile-hide-panel"
      role="region"
      aria-label={text('monitoringHeading', 'Monitoring')}
      title={text('monitoringHeading', 'Monitoring')}
    >
      <Text type="secondary">Field status changes are handled by tanods and responders.</Text>
    </Card>
  );

  const historyTimeline = (
    <Timeline
      items={reportHistory.map((entry, index) => ({
        color: index === reportHistory.length - 1 ? 'blue' : 'gray',
        children: (
          <div className="incident-timeline-entry">
            <Text strong>
              {getHistoryLabel(
                entry.status,
                isResident ? undefined : entry.updatedBy,
                useFilipinoLabels ? (key) => t(key) : undefined
              )}
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
        {isBlotter
          ? useFilipinoLabels
            ? t('blotterCase')
            : 'Blotter case'
          : useFilipinoLabels
            ? categoryLabels.category
            : report.category}
        {report.subcategory
          ? ` · ${useFilipinoLabels ? categoryLabels.subcategory : report.subcategory}`
          : ''}
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

  const progress = (
    <IncidentStatusSteps
      category={report.category}
      subcategory={report.subcategory}
      status={status}
      translate={useFilipinoLabels}
    />
  );

  const reportHero = (
    <section
      className={photos.length ? 'incident-gallery' : 'incident-hero'}
      aria-label={
        photos.length
          ? text('reportPhoto', 'Report photo')
          : text('incidentLocation', 'Incident location')
      }
    >
      {photos.length > 0 && activePhotoUrl ? (
        <div
          className="incident-gallery__stage"
          role="group"
          aria-label={`${text('reportPhoto', 'Photo')} ${activePhotoIndex + 1} / ${photos.length}`}
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
              alt={`${text('reportPhoto', 'Report photo')} ${activePhotoIndex + 1}`}
            />
          </Image.PreviewGroup>
          {photos.length > 1 && (
            <>
              <Button
                className="incident-gallery__control incident-gallery__control--previous"
                shape="circle"
                icon={<LeftOutlined />}
                aria-label={text('previousPhoto', 'Previous photo')}
                title={text('previousPhoto', 'Previous photo')}
                onClick={showPreviousPhoto}
              />
              <Button
                className="incident-gallery__control incident-gallery__control--next"
                shape="circle"
                icon={<RightOutlined />}
                aria-label={text('nextPhoto', 'Next photo')}
                title={text('nextPhoto', 'Next photo')}
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
            <section className="incident-route-section" aria-labelledby="incident-route-heading">
              {/* <h2 id="incident-route-heading">{text('routeToIncident', 'Route to incident')}</h2> */}
              <RouteMap incidentLat={latitude} incidentLng={longitude} />
              <Button
                block
                color="primary"
                variant="solid"
                icon={<CompassOutlined />}
                href={`https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}&travelmode=driving`}
                target="_blank"
                rel="noreferrer"
              >
                {text('openMaps', 'Open in Google Maps')}
              </Button>
            </section>
          ) : (
            <StaticMap latitude={latitude} longitude={longitude} height={340} />
          )}
        </div>
      )}
    </section>
  );

  const resolutionDetails = report.resolution?.resolvedAt ? (
    <>
      <Card
        className="soft-card incident-side-section"
        role="region"
        aria-label={text('resolutionDetails', 'Resolution Details')}
        title={text('resolutionDetails', 'Resolution Details')}
      >
        <Button
          type="primary"
          onClick={() => setResolutionViewOpen(true)}
          style={{ width: '100%' }}
        >
          {text('viewDetails', 'View details')}
        </Button>
        <Text type="secondary">
          {text('resolutionAvailable', 'Resolution details are available for review.')}
        </Text>
      </Card>
      <Modal
        title={text('resolutionDetails', 'Resolution Details')}
        open={resolutionViewOpen}
        zIndex={1200}
        footer={null}
        onCancel={() => setResolutionViewOpen(false)}
      >
        <Space direction="vertical" size={8} style={{ width: '100%' }}>
          <Text strong>{text('resolutionSummary', 'Resolution Summary')}</Text>
          <Paragraph>{report.resolution.summary}</Paragraph>
          <Text strong>{text('actionsTaken', 'Actions Taken')}</Text>
          <Paragraph>{report.resolution.actionsTaken}</Paragraph>
          <Text strong>{text('outcome', 'Outcome')}</Text>
          <Paragraph>{report.resolution.outcome}</Paragraph>
          <Text strong>{text('furtherActionRequired', 'Further Action Required')}</Text>
          <Text>
            {report.resolution.furtherActionRequired ? text('yes', 'Yes') : text('no', 'No')}
          </Text>
          {report.resolution.furtherActionRequired && (
            <>
              <Text strong>
                {text('furtherActionRecommendation', 'Further Action / Recommendation')}
              </Text>
              <Paragraph>{report.resolution.furtherActionRecommendation}</Paragraph>
            </>
          )}
          <Text strong>{text('assistanceRequested', 'Assistance Requested')}</Text>
          <Text>
            {report.resolution.assistanceRequested ? text('yes', 'Yes') : text('no', 'No')}
          </Text>
          {!!report.resolution.supportingEvidence.length && (
            <>
              <Text strong>{text('supportingEvidence', 'Supporting Evidence')}</Text>
              <Space wrap>
                {report.resolution.supportingEvidence.map((evidence) => (
                  <Image
                    key={evidence}
                    width={96}
                    src={getPhotoUrl(evidence)}
                    alt={text('imageEvidence', 'Supporting evidence')}
                  />
                ))}
              </Space>
            </>
          )}
          <Text>
            {text('resolvedBy', 'Resolved By')}:{' '}
            {report.resolution.resolvedByName || report.resolution.resolvedBy}
          </Text>
          <Text>
            {text('resolvedDateTime', 'Resolved Date & Time')}:{' '}
            {new Date(report.resolution.resolvedAt).toLocaleString()}
          </Text>
          <Text>
            {text('verification', 'Verification')}:{' '}
            {report.resolution.verificationStatus === 'verified'
              ? `${text('verifiedBy', 'Verified by')} ${report.resolution.verifiedByName || report.resolution.verifiedBy} · ${new Date(report.resolution.verifiedAt || '').toLocaleString()}`
              : text('pendingReview', 'Pending review')}
          </Text>
          {canReviewResolution && report.resolution.verificationStatus !== 'verified' && (
            <Button
              type="primary"
              loading={verifyResolutionMutation.isPending}
              onClick={() => verifyResolutionMutation.mutate()}
            >
              {text('verifyResolution', 'Verify resolution')}
            </Button>
          )}
        </Space>
      </Modal>
    </>
  ) : null;

  return (
    <main className={`incident-detail incident-detail--${variant}`}>
      <header className="incident-detail-header">
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>
          {text('back', 'Back')}
        </Button>
        {/* {variant === 'admin' && <Text className="incident-role-label">{role?.toUpperCase()}</Text>} */}
      </header>

      <div className="incident-detail-grid">
        <Card className="soft-card incident-main-card">
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

            {description && (
              <section className="incident-description-section">
                <h2>{text('reportDescription', 'Report description')}</h2>
                <Paragraph className="incident-description">{description}</Paragraph>
              </section>
            )}

            {report.aiSummary && (
              <section className="incident-ai-summary">
                <div className="incident-section-label">
                  <RobotOutlined /> <Text strong>{text('aiSummaryLabel', 'AI summary')}</Text>
                </div>
                <Paragraph>{report.aiSummary}</Paragraph>
                {report.aiSuggestedCategory && report.aiSuggestedCategory !== report.category && (
                  <Text type="secondary">
                    {text('suggestedCategory', 'Suggested category')}:{' '}
                    {useFilipinoLabels
                      ? getLocalizedCategory(report.aiSuggestedCategory, null, t).category
                      : report.aiSuggestedCategory}
                  </Text>
                )}
              </section>
            )}

            <section
              className="incident-facts"
              aria-label={text('reportDetails', 'Report details')}
            >
              <div className="incident-fact">
                <EnvironmentOutlined />
                <Text>
                  {report.location?.address || text('locationUnavailable', 'Location unavailable')}
                </Text>
              </div>
              {!isResident && canViewReporter && (
                <div className="incident-fact">
                  <UserOutlined />
                  {report.submitterName ? (
                    <Text>
                      {text('reporterLabel', 'Reporter')}: {report.submitterName}
                      {canViewReporterContact
                        ? report.submitterPhone
                          ? ` · ${report.submitterPhone}`
                          : ` · ${text('noContact', 'No contact on file')}`
                        : ''}
                    </Text>
                  ) : (
                    <Text type="secondary">
                      {isResponder && report.acknowledgedBy !== profile?.firebaseUid
                        ? text('reporterHidden', 'Reporter hidden until you acknowledge')
                        : text('reporterUnavailable', 'Reporter details unavailable')}
                    </Text>
                  )}
                </div>
              )}
              {isResponder && !canViewReporter && (
                <div className="incident-fact">
                  <UserOutlined />
                  <Text type="secondary">
                    {text('reporterHidden', 'Reporter hidden until you acknowledge')}
                  </Text>
                </div>
              )}
              {!isResident && report.acknowledgedBy && (
                <div className="incident-participants">
                  <div className="incident-participant-group">
                    <Text strong>{text('lead', 'Lead')}</Text>
                    <span className="incident-participant-chip">
                      <Avatar size={22}>
                        {getInitials(report.acknowledgedByName || 'Responder')}
                      </Avatar>
                      {report.acknowledgedByName || 'Responder'}
                    </span>
                  </div>
                  {backupResponderNames.length > 0 && (
                    <div className="incident-participant-group">
                      <Text strong>{text('backup', 'Backup')}</Text>
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
                <h2>
                  {variant === 'responder'
                    ? text('routeToIncident', 'Route to incident')
                    : 'Location'}
                </h2>
                {variant === 'responder' ? (
                  <>
                    <RouteMap incidentLat={latitude} incidentLng={longitude} />
                    <Button
                      block
                      icon={<CompassOutlined />}
                      href={`https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}&travelmode=driving`}
                      target="_blank"
                      rel="noreferrer"
                      style={{ marginTop: 8 }}
                    >
                      {text('openMaps', 'Open in Google Maps')}
                    </Button>
                  </>
                ) : (
                  <StaticMap latitude={latitude} longitude={longitude} height={250} />
                )}
              </section>
            )}
          </article>
        </Card>

        <aside className="incident-aside">
          {resolutionDetails}
          {!isResident && actionPanel}

          {showStatusTimeline && (
            <Card
              className="soft-card incident-side-section"
              role="region"
              aria-label={text('timeline', 'Timeline')}
              title={text('timeline', 'Timeline')}
            >
              {reportHistory.length ? (
                historyTimeline
              ) : (
                <Empty description={text('noActivity', 'No activity recorded')} />
              )}
            </Card>
          )}

          {canViewReportAudit && (
            <Card
              className="soft-card incident-side-section"
              role="region"
              aria-label={role === 'admin' ? 'Audit trail' : 'Case activity'}
              title={role === 'admin' ? 'Audit trail' : 'Case activity'}
              extra={
                role === 'admin' && (
                  <Button
                    size="small"
                    icon={<DownloadOutlined />}
                    onClick={() =>
                      downloadFile('/api/audit-logs?format=csv', 'anyareport-audit.csv')
                    }
                  >
                    Export system log
                  </Button>
                )
              }
            >
              {auditEntries.length ? (
                auditTimeline
              ) : (
                <Empty description="No audit events recorded" />
              )}
            </Card>
          )}
        </aside>
      </div>

      <Modal
        title={text('resolutionDetails', 'Resolution Details')}
        open={resolutionOpen}
        zIndex={1200}
        destroyOnClose
        footer={null}
        onCancel={() => {
          setResolutionOpen(false);
          setEvidenceFiles([]);
        }}
      >
        <Form
          layout="vertical"
          initialValues={{ furtherActionRequired: false, assistanceRequested: false }}
          onFinish={(values: ResolutionFormValues) => resolutionMutation.mutate(values)}
        >
          <Form.Item
            name="summary"
            label={text('resolutionSummary', 'Resolution Summary')}
            rules={[{ required: true, whitespace: true }]}
          >
            <Input.TextArea
              rows={3}
              placeholder={text('describeWhatHappened', 'Briefly describe what happened')}
            />
          </Form.Item>
          <Form.Item
            name="actionsTaken"
            label={text('actionsTaken', 'Actions Taken')}
            rules={[{ required: true, whitespace: true }]}
          >
            <Input.TextArea
              rows={3}
              placeholder={text(
                'describeActions',
                'Describe the actions or interventions performed.'
              )}
            />
          </Form.Item>
          <Form.Item
            name="outcome"
            label={text('outcome', 'Outcome')}
            rules={[
              {
                required: true,
                whitespace: true,
                message: text('describeFinalResult', 'Describe the final result.'),
              },
            ]}
          >
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item
            name="furtherActionRequired"
            label={text('furtherActionRequired', 'Further Action Required')}
            rules={[{ required: true, message: text('selectYesNo', 'Select Yes or No.') }]}
          >
            <Radio.Group
              options={[
                { label: text('yes', 'Yes'), value: true },
                { label: text('no', 'No'), value: false },
              ]}
            />
          </Form.Item>
          <Form.Item
            noStyle
            shouldUpdate={(previous, current) =>
              previous.furtherActionRequired !== current.furtherActionRequired
            }
          >
            {({ getFieldValue }) =>
              getFieldValue('furtherActionRequired') ? (
                <Form.Item
                  name="furtherActionRecommendation"
                  label={text('furtherActionRecommendation', 'Further Action / Recommendation')}
                  rules={[
                    {
                      required: true,
                      whitespace: true,
                      message: text(
                        'provideRecommendation',
                        'Provide the further action or recommendation.'
                      ),
                    },
                  ]}
                >
                  <Input.TextArea
                    rows={2}
                    placeholder={text(
                      'exampleRecommendation',
                      'Example: Conduct a follow-up visit or refer the matter to the appropriate office.'
                    )}
                  />
                </Form.Item>
              ) : null
            }
          </Form.Item>
          <Form.Item
            name="assistanceRequested"
            label={text('assistanceRequested', 'Assistance Requested')}
            rules={[{ required: true, message: text('selectYesNo', 'Select Yes or No.') }]}
          >
            <Radio.Group
              options={[
                { label: text('yes', 'Yes'), value: true },
                { label: text('no', 'No'), value: false },
              ]}
            />
          </Form.Item>
          <Form.Item label={text('supportingEvidence', 'Supporting Evidence')}>
            <Upload
              beforeUpload={() => false}
              accept="image/*"
              maxCount={3}
              fileList={evidenceFiles}
              onChange={({ fileList }) => setEvidenceFiles(fileList)}
              onRemove={(file) => {
                setEvidenceFiles((current) => current.filter((entry) => entry.uid !== file.uid));
              }}
            >
              <Button>{text('uploadPhotos', 'Upload photos')}</Button>
            </Upload>
            <Text type="secondary">
              {text('evidenceLimit', 'Images only, up to 3 files and 5 MB each.')}
            </Text>
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={resolutionMutation.isPending} block>
            {text('submitResolution', 'Submit Resolution')}
          </Button>
        </Form>
      </Modal>

      {showMobileResponderActions && (
        <details open className="incident-mobile-actions soft-card">
          <summary className="incident-mobile-actions__summary">
            <span>{text('responseHeading', 'Response')}</span>
            <DownOutlined className="incident-mobile-actions__chevron" aria-hidden="true" />
          </summary>
          <div className="incident-mobile-actions__content">
            {isResponder ? actionPanel : captainResponseAction}
          </div>
        </details>
      )}
    </main>
  );
}
