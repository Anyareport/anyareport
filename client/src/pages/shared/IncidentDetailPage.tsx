import { useRef, useState, type TouchEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Avatar,
  Button,
  Card,
  Col,
  Collapse,
  Divider,
  Empty,
  Form,
  Image,
  Input,
  Modal,
  Radio,
  Row,
  Space,
  Timeline,
  Typography,
  Select,
  Upload,
} from 'antd';
import type { UploadFile } from 'antd';
import {
  ArrowLeftOutlined,
  CheckOutlined,
  CompassOutlined,
  DownOutlined,
  DownloadOutlined,
  EnvironmentOutlined,
  FlagOutlined,
  LeftOutlined,
  PhoneOutlined,
  PrinterOutlined,
  RightOutlined,
  RobotOutlined,
  UserAddOutlined,
  UserOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import { api, type AuditLog, type DispatchResponder, type Report } from '../../lib/api';
import StatusTag from '../../components/StatusTag';
import SeverityTag from '../../components/SeverityTag';
import AppTag from '../../components/AppTag';
import EmergencyHotline, {
  EMERGENCY_HOTLINE_OPTIONS,
} from '../../components/EmergencyHotline';
import { StaticMap, RouteMap } from '../../components/map/MapPicker';
import { useAuth } from '../../contexts/AuthContext';
import TranslationNote from '../../components/TranslationNote';
import { useTranslatedTexts } from '../../lib/translation';
import { useLang } from '../../contexts/LanguageContext';
import { getLocalizedCategory, getLocalizedStatus, type LabelKey } from '../../i18n/labels';
import { notificationFeedQueryKey } from '../../lib/notificationFeed';
import { invalidateReportQueries } from '../../lib/reportUpdates';
import { getSuggestedNextSteps } from '../../lib/nextSteps';
import { createIncidentSummaryHtml } from '../../lib/incidentSummary';
import {
  BLOTTER_REPORT_CATEGORY,
  FIELD_REPORT_CATEGORIES,
  getStatusLabel,
  normalizeReportStatus,
} from '../../lib/reportWorkflow';
import IncidentStatusSteps from './IncidentStatusSteps';
import LoadingState from '../../components/LoadingState';
import './IncidentDetailPage.css';
import { useAntdMessage } from '../../lib/useAntdMessage';
const { Paragraph, Text, Title } = Typography;

function getDialablePhone(value: string) {
  const dialNumber = value.trim().replace(/[\s().-]/g, '');
  return /^\+?\d{7,15}$/.test(dialNumber) ? dialNumber : null;
}

interface IncidentDetailPageProps {
  variant: 'admin' | 'responder' | 'resident';
  guest?: boolean;
}

interface BackupRequestResponse {
  report: Report;
  alreadyRequested: boolean;
}

interface DispatchOptionsResponse {
  responders: DispatchResponder[];
}

interface ResolutionFormValues {
  closureType: 'resolved' | 'endorsed';
  summary?: string;
  actionsTaken: string;
  outcome: string;
  furtherActionRequired?: boolean;
  furtherActionRecommendation?: string;
  assistanceRequested?: boolean;
  endorsedToOtherEmergencyDepartment?: boolean;
  endorsedToDepartment?: string;
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
      return `Resolution reviewed by ${entry.actorName || 'Official'}`;
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

async function downloadFile(
  path: string,
  filename: string,
  message: ReturnType<typeof useAntdMessage>
) {
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

function printIncidentSummary(
  message: ReturnType<typeof useAntdMessage>,
  report: Report,
  reporterName?: string | null,
  reporterPhone?: string | null,
  generatedByName?: string | null,
  generatedByRole?: string | null
) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    message.error('Your browser blocked the print window. Allow pop-ups and try again.');
    return;
  }
  printWindow.opener = null;
  printWindow.document.write(
    createIncidentSummaryHtml(report, {
      generatedByName,
      generatedByRole,
      reporterName,
      reporterPhone,
    })
  );
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}

export default function IncidentDetailPage({ variant, guest = false }: IncidentDetailPageProps) {
  const message = useAntdMessage();
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const galleryTouchStart = useRef<{ x: number; y: number } | null>(null);
  const { id } = useParams();
  const location = useLocation();
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
  const [routeLocationUnavailable, setRouteLocationUnavailable] = useState(false);

  const { data: report, isLoading } = useQuery({
    queryKey: ['report', id, guest, location.search],
    queryFn: () => {
      if (guest) {
        const requestId = new URLSearchParams(location.search).get('requestId');
        return api.get<Report>(
          `/api/reports/guest/${id}?requestId=${encodeURIComponent(requestId || '')}`
        );
      }
      return api.get<Report>(`/api/reports/${id}`);
    },
    enabled: !!id && (!guest || new URLSearchParams(location.search).has('requestId')),
    // Stop polling once the report is closed (resolved or flagged). TanStack Query v5 signature.
    refetchInterval: (query) => {
      const current = query.state.data;
      const s = normalizeReportStatus(current?.status || current?.workflowStatus || '');
      return ['flagged', 'resolved', 'endorsed'].includes(s) ? false : 15000;
    },
  });

  const resolutionMutation = useMutation({
    mutationFn: (values: ResolutionFormValues) => {
      const formData = new FormData();
      if (values.summary) formData.append('summary', values.summary);
      formData.append('actionsTaken', values.actionsTaken);
      formData.append('outcome', values.outcome);
      if (values.furtherActionRequired !== undefined) {
        formData.append('furtherActionRequired', String(values.furtherActionRequired));
      }
      if (values.furtherActionRecommendation) {
        formData.append('furtherActionRecommendation', values.furtherActionRecommendation);
      }
      if (values.assistanceRequested !== undefined) {
        formData.append('assistanceRequested', String(values.assistanceRequested));
      }
      if (values.endorsedToOtherEmergencyDepartment !== undefined) {
        formData.append(
          'endorsedToOtherEmergencyDepartment',
          String(values.endorsedToOtherEmergencyDepartment)
        );
      }
      formData.set(
        'endorsedToOtherEmergencyDepartment',
        String(values.closureType === 'endorsed')
      );
      if (values.endorsedToDepartment) {
        formData.append('endorsedToDepartment', values.endorsedToDepartment);
      }
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
      message.success(
        useFilipinoLabels ? t('resolutionSuccess') : 'This report has been marked as resolved.'
      );
    },
    onError: (error: Error) => message.error(error.message),
  });

  const verifyResolutionMutation = useMutation({
    mutationFn: () => api.patch<Report>(`/api/reports/${id}/resolution/verify`, {}),
    onSuccess: async () => {
      await invalidateReportViews();
      await queryClient.invalidateQueries({ queryKey: ['report-audit', id] });
      message.success('Resolution reviewed.');
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
    !guest &&
    variant === 'admin' && ['admin', 'captain', 'secretary'].includes(role || '');
  const showStatusTimeline = variant !== 'admin' || role !== 'admin';
  const { data: auditEntries = [] } = useQuery({
    queryKey: ['report-audit', id],
    queryFn: () => api.get<AuditLog[]>(`/api/reports/${id}/audit`),
    enabled: !!id && canViewReportAudit,
    refetchInterval: 30000,
  });

  const invalidateReportViews = () => invalidateReportQueries(queryClient, id);

  const confirmResponderArrival = () => {
    Modal.confirm({
      title: "Confirm you've arrived",
      content:
        'Confirm that you have reached the incident location? The report status will change to In Progress.',
      okText: "I've arrived",
      cancelText: 'Cancel',
      onOk: () => updateStatus.mutate('in_progress'),
    });
  };

  const updateStatus = useMutation({
    mutationFn: (status: 'in_progress' | 'resolved' | 'endorsed') =>
      api.patch<Report>(`/api/reports/${id}/status`, { status }),
    onSuccess: async (_report, status) => {
      await invalidateReportViews();
      if (['tanod', 'responder'].includes(role || '')) {
        message.success(t(status === 'in_progress' ? 'startWorkSuccess' : 'resolutionSuccess'));
      }
    },
    onError: (error: Error) => message.error(error.message),
  });
  const [flagOpen, setFlagOpen] = useState(false);
  const [flagReason, setFlagReason] = useState<string | undefined>();
  const flagMutation = useMutation({
    mutationFn: (reason: string) => api.post<Report>(`/api/reports/${id}/flag`, { reason }),
    onSuccess: async () => {
      setFlagOpen(false);
      setFlagReason(undefined);
      await invalidateReportViews();
      await queryClient.invalidateQueries({ queryKey: ['report-audit', id] });
      message.success('Report flagged for review.');
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
      message.success('Responders have been dispatched to this incident.');
    },
    onError: (error: Error) => message.error(error.message),
  });

  // One batched request translates every free-text field on this page.
  const translation = useTranslatedTexts([
    report?.description,
    report?.aiSummary,
    report?.aiTitle,
    report?.resolution?.summary,
    report?.resolution?.actionsTaken,
    report?.resolution?.outcome,
    report?.resolution?.furtherActionRecommendation,
  ]);
  const [
    descriptionText,
    aiSummaryText,
    aiTitleText,
    resolutionSummaryText,
    actionsTakenText,
    outcomeText,
    recommendationText,
  ] = translation.texts;
  const translationNote = <TranslationNote translation={translation} />;

  if (isLoading) {
    return <LoadingState minHeight={320} />;
  }

  if (!report) {
    return <Alert type="error" showIcon message={text('reportNotFound', 'Report not found')} />;
  }

  const isResident = variant === 'resident' && !guest;
  const isResponder = !guest && variant === 'responder' && ['tanod', 'responder'].includes(role || '');
  const canViewSuggestedNextSteps =
    variant !== 'resident' && ['tanod', 'responder', 'captain', 'secretary'].includes(role || '');
  const isBlotter = report.category === BLOTTER_REPORT_CATEGORY;
  const isSimpleFieldCloseout = FIELD_REPORT_CATEGORIES.includes(report.category);
  const status = dispatchStatus;
  const isTerminalStatus = ['resolved', 'endorsed', 'flagged'].includes(status);
  const suggestedNextSteps = getSuggestedNextSteps(report.category);

  // Must be declared after `status` (const is not usable before its declaration).
  const flaggedNotice =
    status === 'flagged' ? (
      <Alert
        type="warning"
        showIcon
        icon={<FlagOutlined />}
        style={{ marginBottom: 16 }}
        message={
          isResident
            ? text('reportFlaggedResident', 'Your report was flagged')
            : text('reportFlaggedTitle', 'This report has been flagged')
        }
        description={
          <Space direction="vertical" size={4}>
            {report.flagReasonLabel && (
              <Text>
                <Text strong>{text('reason', 'Reason')}:</Text> {report.flagReasonLabel}
              </Text>
            )}
            {isResident && (
              <Text type="secondary">
                {text(
                  'flaggedResidentNote',
                  'No response will be made to this report. Repeated flagged reports may lead to account suspension.'
                )}
              </Text>
            )}
            {report.flaggedAt && (
              <Text type="secondary">{new Date(report.flaggedAt).toLocaleString()}</Text>
            )}
          </Space>
        }
      />
    ) : null;

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
  const canExportIncidentSummary =
    variant === 'admin' && ['captain', 'secretary'].includes(role || '');
  const reporterContact = report.reportedBy
    ? report.reportedByContact
    : report.submitterPhone;
  const reporterDialNumber = reporterContact ? getDialablePhone(reporterContact) : null;
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
  const description = descriptionText.trim();
  const categoryLabels = getLocalizedCategory(report.category, report.subcategory, t);
  const title =
    aiTitleText.trim() ||
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
    !isTerminalStatus &&
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
  const canResolvePublicConcern =
    variant === 'admin' &&
    role === 'secretary' &&
    report.category === 'Public Concerns' &&
    status === 'in_progress';
  const canStartPublicConcern =
    variant === 'admin' &&
    role === 'secretary' &&
    report.category === 'Public Concerns' &&
    ['pending', 'verified'].includes(status);
  const canUseResponderBackup = !isBlotter || isCriminalBlotter;
  const canReviewResolution =
    variant === 'admin' && ['captain', 'secretary'].includes((role || '').toLowerCase());
  const resolutionRoleLabel =
    role === 'tanod'
      ? 'Tanod'
      : role === 'responder'
        ? text('responder', 'Responder')
        : role === 'captain'
          ? text('captain', 'Captain')
          : text('secretary', 'Secretary');
  const resolutionSubmitter = profile?.name || resolutionRoleLabel;
  const resolutionSubmitterLine = `${text('submittingAs', 'Submitting as')} ${resolutionSubmitter} (${resolutionRoleLabel}${canResolveFieldWork ? `, ${text('assignedResponder', 'assigned responder')}` : ''})`;
  const resolutionSubmissionNote = canResolveBlotter
    ? text(
        'officialResolutionNote',
        'This will be recorded under your account and must be verified before the case is closed.'
      )
    : text(
        'resolutionVerificationNote',
        'A captain or secretary must verify this submission before the case is closed.'
      );
  const actionBusy =
    updateStatus.isPending ||
    acknowledgeMutation.isPending ||
    backupMutation.isPending ||
    joinBackupMutation.isPending ||
    closeBackupMutation.isPending ||
    dispatchMutation.isPending ||
    resolutionMutation.isPending ||
    verifyResolutionMutation.isPending ||
    flagMutation.isPending;

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
      onClick={confirmResponderArrival}
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

  const oversightAction = canStartPublicConcern ? (
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
  ) : canResolvePublicConcern ? (
    <Button
      block
      size="large"
      type="primary"
      disabled={actionBusy}
      loading={resolutionMutation.isPending}
      onClick={() => setResolutionOpen(true)}
    >
      Mark resolved
    </Button>
  ) : canStartBlotter ? (
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

  const secretaryAction = isBlotter || report.category === 'Public Concerns' ? (
    <Card
      className="soft-card incident-side-section incident-mobile-hide-panel"
      role="region"
      aria-label={text('actionsHeading', 'Actions')}
      title={text('actionsHeading', 'Actions')}
    >
      {oversightAction || (
        <Text type="secondary">
          {status === 'resolved' || status === 'endorsed'
            ? 'This blotter case is resolved.'
            : status === 'flagged'
              ? 'This blotter case was flagged and is closed to further action.'
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
          downloadFile(
            `/api/reports/${id}/audit?format=csv`,
            `anyareport-report-${report.referenceNumber || id}-audit.csv`,
            message
          )
        }
      >
        Export case audit
      </Button>
    </Card>
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

  const flagAction =
    role === 'secretary' && !isTerminalStatus ? (
      <Card
        className="soft-card incident-side-section incident-mobile-hide-panel"
        role="region"
        aria-label="Flag report"
        title="Flag report"
      >
        <Text type="secondary">
          For prank, unrelated, duplicate or test reports. Repeated flags suspend the resident.
        </Text>
        <Button block danger icon={<FlagOutlined />} onClick={() => setFlagOpen(true)}>
          Flag as false or unrelated
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
          {status === 'resolved' || status === 'endorsed'
            ? text('incidentResolvedNotice', 'This incident is resolved.')
            : status === 'flagged'
              ? text('reportFlaggedNotice', 'This report was flagged and requires no response.')
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
  ) : role === 'admin' ? null : ['captain', 'secretary'].includes(role || '') ? (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      {captainResponseAction}
      {secretaryAction}
      {dispatchAction}
      {flagAction}
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
            ? ['resolved', 'endorsed'].includes(status)
              ? 'This blotter case is resolved.'
              : status === 'flagged'
                ? 'This blotter case was flagged and is closed to further action.'
                : 'Blotter cases can be resolved by the Captain or Secretary.'
            : ['resolved', 'endorsed'].includes(status)
              ? 'This blotter case is resolved.'
              : status === 'flagged'
                ? 'This blotter case was flagged and is closed to further action.'
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
            downloadFile(
              `/api/reports/${id}/audit?format=csv`,
              `anyareport-report-${report.referenceNumber || id}-audit.csv`,
              message
            )
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
        dot: (
          <span
            className={`incident-timeline-marker${
              index === reportHistory.length - 1 ? ' incident-timeline-marker--latest' : ''
            }`}
            aria-hidden="true"
          />
        ),
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
      items={auditEntries.map((entry, index) => ({
        dot: (
          <span
            className={`incident-timeline-marker${
              index === auditEntries.length - 1 ? ' incident-timeline-marker--latest' : ''
            }`}
            aria-hidden="true"
          />
        ),
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

  const responderLocationAlert = routeLocationUnavailable ? (
    <Alert
      type="warning"
      showIcon
      message="Responder location unavailable"
      description="The incident location remains visible, but your current position and route are unavailable without device location access."
    />
  ) : null;

  const responderRouteMap = (
    <div className="incident-hero-map">
      <section
        className="incident-route-section"
        aria-label={text('routeToIncident', 'Route to incident')}
      >
        <RouteMap
          incidentLat={latitude}
          incidentLng={longitude}
          hideAlert
          onLocationUnavailableChange={setRouteLocationUnavailable}
        />
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
    </div>
  );

  const reportHero = (
    <>
      {variant === 'responder' && photos.length === 0 && responderLocationAlert}
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
        ) : variant === 'responder' ? (
          responderRouteMap
        ) : (
          <div className="incident-hero-map">
            <StaticMap latitude={latitude} longitude={longitude} height={340} />
          </div>
        )}
      </section>
    </>
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
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <Space direction="vertical" size={2}>
              <Text strong>{report.referenceNumber || referenceLabel}</Text>
              <Text type="secondary">
                {categoryLabels.category}
                {categoryLabels.subcategory ? ` · ${categoryLabels.subcategory}` : ''}
              </Text>
            </Space>
            <AppTag
              tone={report.resolution.verificationStatus === 'verified' ? 'success' : 'warning'}
            >
              {report.resolution.verificationStatus === 'verified'
                ? text('resolutionReviewed', 'Reviewed')
                : text('pendingReview', 'Pending review')}
            </AppTag>
          </div>
          <Divider style={{ margin: 0 }} />
          {resolutionSummaryText.trim() && (
            <section>
              <Text strong>{text('summary', 'Summary')}</Text>
              {translationNote}
              <Paragraph style={{ marginBottom: 0 }}>{resolutionSummaryText}</Paragraph>
            </section>
          )}
          <section>
            <Text strong>{text('actionsTaken', 'Actions Taken')}</Text>
            <Paragraph style={{ marginBottom: 0 }}>{actionsTakenText}</Paragraph>
          </section>
          <section>
            <Text strong>{text('outcome', 'Outcome')}</Text>
            <Paragraph style={{ marginBottom: 0 }}>{outcomeText}</Paragraph>
          </section>
          <Row gutter={[16, 12]}>
            <Col xs={12}>
              <Text strong>{text('furtherActionRequired', 'Further Action Required')}</Text>
              <div>
                <AppTag tone="neutral">
                  {report.resolution.furtherActionRequired === null
                    ? '—'
                    : report.resolution.furtherActionRequired
                      ? text('yes', 'Yes')
                      : text('no', 'No')}
                </AppTag>
              </div>
            </Col>
            <Col xs={12}>
              <Text strong>{text('assistanceRequested', 'Assistance Requested')}</Text>
              <div>
                <AppTag tone="neutral">
                  {report.resolution.assistanceRequested === null
                    ? '—'
                    : report.resolution.assistanceRequested
                      ? text('yes', 'Yes')
                      : text('no', 'No')}
                </AppTag>
              </div>
            </Col>
            <Col xs={12}>
              <Text strong>
                {text(
                  'endorsedToOtherEmergencyDepartment',
                  'Endorsed to another emergency department'
                )}
              </Text>
              <div>
                <AppTag tone="neutral">
                  {report.resolution.endorsedToOtherEmergencyDepartment === null ||
                  report.resolution.endorsedToOtherEmergencyDepartment === undefined
                    ? '—'
                    : report.resolution.endorsedToOtherEmergencyDepartment
                      ? text('yes', 'Yes')
                      : text('no', 'No')}
                </AppTag>
              </div>
            </Col>
            {report.resolution.endorsedToOtherEmergencyDepartment && (
              <Col xs={24}>
                <Text strong>
                  {text('endorsedToDepartment', 'Endorsed emergency hotline')}
                </Text>
                <div>{report.resolution.endorsedToDepartment || '—'}</div>
              </Col>
            )}
          </Row>
          {report.resolution.furtherActionRequired && (
            <section>
              <Text strong>
                {text('furtherActionRecommendation', 'Further Action / Recommendation')}
              </Text>
              <Paragraph style={{ marginBottom: 0 }}>{recommendationText}</Paragraph>
            </section>
          )}
          {!!report.resolution.supportingEvidence.length && (
            <section>
              <Text strong>{text('supportingEvidence', 'Supporting Evidence')}</Text>
              <Image.PreviewGroup>
                <Space wrap>
                  {report.resolution.supportingEvidence.map((evidence) => (
                    <Image
                      key={evidence}
                      width={96}
                      height={96}
                      style={{ objectFit: 'cover', borderRadius: 6 }}
                      src={getPhotoUrl(evidence)}
                      alt={text('imageEvidence', 'Supporting evidence')}
                    />
                  ))}
                </Space>
              </Image.PreviewGroup>
            </section>
          )}
          <Divider style={{ margin: 0 }} />
          <Row gutter={[16, 8]}>
            <Col xs={24} sm={12}>
              <Text strong>{text('resolvedBy', 'Resolved By')}</Text>
              <div>{report.resolution.resolvedByName || report.resolution.resolvedBy}</div>
            </Col>
            <Col xs={24} sm={12}>
              <Text strong>{text('resolvedDateTime', 'Resolved Date & Time')}</Text>
              <div>{new Date(report.resolution.resolvedAt).toLocaleString()}</div>
            </Col>
            {report.resolution.verificationStatus === 'verified' && (
              <Col xs={24}>
                <Text strong>{text('reviewedBy', 'Reviewed by')}</Text>
                <div>
                  {report.resolution.verifiedByName || report.resolution.verifiedBy}
                  {report.resolution.verifiedAt &&
                    ` · ${new Date(report.resolution.verifiedAt).toLocaleString()}`}
                </div>
              </Col>
            )}
          </Row>
          <Space style={{ width: '100%', justifyContent: 'flex-end' }} wrap>
            <Button onClick={() => setResolutionViewOpen(false)}>{text('close', 'Close')}</Button>
            {canReviewResolution && report.resolution.verificationStatus !== 'verified' && (
              <Button
                type="primary"
                loading={verifyResolutionMutation.isPending}
                onClick={() => verifyResolutionMutation.mutate()}
              >
                {text('markResolutionReviewed', 'Mark as reviewed')}
              </Button>
            )}
          </Space>
        </Space>
      </Modal>
    </>
  ) : null;

  return (
    <main className={`incident-detail incident-detail--${variant}`}>
      <header className="incident-detail-header">
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => (guest ? navigate('/report/reports') : navigate(-1))}
        >
          {text('back', 'Back')}
        </Button>
        {canExportIncidentSummary && (
          <Button
            className="incident-summary-button"
            aria-label="Print incident summary"
            title="Print incident summary"
            icon={<PrinterOutlined />}
            onClick={() =>
              printIncidentSummary(
                message,
                report,
                canViewReporter ? report.reportedBy || report.submitterName : null,
                canViewReporterContact ? reporterContact : null,
                profile?.name,
                role
              )
            }
          >
            <span className="incident-summary-button__label">Print summary</span>
          </Button>
        )}
        {/* {variant === 'admin' && <Text className="incident-role-label">{role?.toUpperCase()}</Text>} */}
      </header>

      <div className="incident-detail-grid">
        <Card className="soft-card incident-main-card">
          <article className="incident-main">
            {flaggedNotice}
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
                {translationNote}
              </section>
            )}

            {report.aiSummary && (
              <section className="incident-ai-summary">
                <div className="incident-section-label">
                  <RobotOutlined /> <Text strong>{text('aiSummaryLabel', 'AI summary')}</Text>
                </div>
                <Paragraph>{aiSummaryText}</Paragraph>
                {!description && translationNote}
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
                <div className="incident-fact incident-fact--reporter">
                  <UserOutlined />
                  {report.isGuest ? (
                    <Text>Reporter: Anonymous account</Text>
                  ) : report.reportedBy || report.submitterName ? (
                    <div className="incident-reporter">
                      <Text>
                        {text('reporterLabel', 'Reporter')}: {report.reportedBy || report.submitterName}
                      </Text>
                      {canViewReporterContact &&
                        (reporterContact ? (
                          <>
                            <span className="incident-reporter__separator" aria-hidden="true">
                              ·
                            </span>
                            {reporterDialNumber ? (
                              <a
                                className="incident-reporter__phone"
                                href={`tel:${reporterDialNumber}`}
                                aria-label={`${text('call', 'Call')} ${report.reportedBy || report.submitterName} at ${reporterContact}`}
                              >
                                <PhoneOutlined aria-hidden="true" />
                                <span>{reporterContact}</span>
                              </a>
                            ) : (
                              <span
                                className="incident-reporter__phone"
                                aria-label={`${text('phoneNumber', 'Phone number')}: ${reporterContact}`}
                              >
                                <PhoneOutlined aria-hidden="true" />
                                <span>{reporterContact}</span>
                              </span>
                            )}
                          </>
                        ) : (
                          <Text type="secondary">{text('noContact', 'No contact on file')}</Text>
                        ))}
                    </div>
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

            {photos.length > 0 &&
              (variant === 'responder' ? (
                <>
                  {responderLocationAlert}
                  <section
                    className="incident-hero"
                    aria-label={text('incidentLocation', 'Incident location')}
                  >
                    {responderRouteMap}
                  </section>
                </>
              ) : (
                <section className="incident-location-section">
                  <h2>Location</h2>
                  <StaticMap latitude={latitude} longitude={longitude} height={250} />
                </section>
              ))}
          </article>
        </Card>

        <aside className="incident-aside">
          {resolutionDetails}
          {!isResident && actionPanel}

          {canViewSuggestedNextSteps && !isTerminalStatus && suggestedNextSteps.length > 0 && (
            <Card
              className="soft-card incident-side-section"
              role="region"
              aria-label={t('suggestedNextSteps')}
              title={t('suggestedNextSteps')}
            >
              <ol style={{ margin: 0, paddingLeft: 20 }}>
                {suggestedNextSteps.map((step) => (
                  <li key={step} style={{ marginBottom: 8 }}>
                    <Text>{t(step)}</Text>
                  </li>
                ))}
              </ol>
              <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
                {t('nextStepsAdvisoryNote')}
              </Text>
            </Card>
          )}

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
        title="Flag this report"
        open={flagOpen}
        zIndex={1200}
        okText="Flag report"
        okButtonProps={{ danger: true, disabled: !flagReason }}
        confirmLoading={flagMutation.isPending}
        onOk={() => flagReason && flagMutation.mutate(flagReason)}
        onCancel={() => setFlagOpen(false)}
      >
        <Select
          aria-label="Flag reason"
          placeholder="Select a reason"
          value={flagReason}
          onChange={setFlagReason}
          style={{ width: '100%' }}
          options={[
            { value: 'prank', label: 'Prank' },
            { value: 'unrelated', label: 'Unrelated' },
            { value: 'duplicate', label: 'Duplicate' },
            { value: 'test', label: 'Test report' },
            { value: 'wrong_location', label: 'Wrong location' },
          ]}
        />
      </Modal>

      <Modal
        title={text('resolveIncident', 'Resolve incident')}
        width="min(720px, calc(100vw - 24px))"
        open={resolutionOpen}
        zIndex={1200}
        destroyOnClose
        footer={null}
        onCancel={() => {
          setResolutionOpen(false);
          setEvidenceFiles([]);
        }}
      >
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Space wrap size={8}>
            <Text strong>{report.referenceNumber || referenceLabel}</Text>
            <Text type="secondary">
              {categoryLabels.category}
              {categoryLabels.subcategory ? ` · ${categoryLabels.subcategory}` : ''}
            </Text>
            {report.severity && <SeverityTag severity={report.severity} />}
          </Space>
          <Alert
            type="info"
            showIcon
            message={resolutionSubmitterLine}
            description={resolutionSubmissionNote}
          />
          <Form
            layout="vertical"
            initialValues={
              isSimpleFieldCloseout
                ? { closureType: 'resolved' }
                : {
                    closureType: 'resolved',
                    furtherActionRequired: false,
                    assistanceRequested: false,
                  }
            }
            onFinish={(values: ResolutionFormValues) => resolutionMutation.mutate(values)}
          >
            <Form.Item
              name="closureType"
              label={text('closureType', 'How should this report be closed?')}
              rules={[{ required: true }]}
            >
              <Radio.Group
                buttonStyle="solid"
                optionType="button"
                style={{ display: 'flex', width: '100%' }}
              >
                <Radio.Button value="resolved" style={{ flex: 1, textAlign: 'center' }}>
                  {text('resolveWithinBarangay', 'Resolve within barangay')}
                </Radio.Button>
                <Radio.Button value="endorsed" style={{ flex: 1, textAlign: 'center' }}>
                  {text('endorseExternalAgency', 'Endorse to external agency')}
                </Radio.Button>
              </Radio.Group>
            </Form.Item>
            <Form.Item
              noStyle
              shouldUpdate={(previous, current) => previous.closureType !== current.closureType}
            >
              {({ getFieldValue }) =>
                getFieldValue('closureType') === 'endorsed' ? (
                  <Form.Item
                    name="endorsedToDepartment"
                    label={text('endorsedToDepartment', 'Which external agency?')}
                    rules={[
                      {
                        required: true,
                        message: text(
                          'provideEndorsedDepartment',
                          'Provide the external agency name.'
                        ),
                      },
                    ]}
                  >
                    <Select
                      placeholder={text('selectEmergencyHotline', 'Select an external agency')}
                      options={EMERGENCY_HOTLINE_OPTIONS.map(({ name }) => ({
                        value: name,
                        label: name,
                      }))}
                    />
                  </Form.Item>
                ) : null
              }
            </Form.Item>
            <Title level={5} style={{ margin: '0 0 12px' }}>
              {text('whatHappened', 'What happened')}
            </Title>
            <Form.Item
              name="actionsTaken"
              label={text('actionsTaken', 'Actions Taken')}
              rules={[{ required: true, whitespace: true }]}
            >
              <Input.TextArea
                rows={isSimpleFieldCloseout ? 2 : 3}
                placeholder={
                  isSimpleFieldCloseout
                    ? text(
                        'describeFieldActions',
                        'For example: Called PNP, provided on-site help, or both.'
                      )
                    : text('describeActions', 'Describe the actions or interventions performed.')
                }
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
              <Input.TextArea
                rows={isSimpleFieldCloseout ? 2 : 3}
                placeholder={
                  isSimpleFieldCloseout
                    ? text(
                        'describeFieldOutcome',
                        'For example: PNP answered and took over, or no answer.'
                      )
                    : text('describeOutcome', 'Describe the final result.')
                }
              />
            </Form.Item>

            <Form.Item
              noStyle
              shouldUpdate={(previous, current) => previous.closureType !== current.closureType}
            >
              {({ getFieldValue }) =>
                getFieldValue('closureType') === 'endorsed' ? null : (
                  <Collapse
                    size="small"
                    defaultActiveKey={isSimpleFieldCloseout ? [] : ['additional-details']}
                    items={[
                {
                  key: 'additional-details',
                  label: isSimpleFieldCloseout
                    ? text('optionalDetails', 'Additional details (optional)')
                    : text('followUp', 'Follow-up and evidence'),
                  children: (
                    <>
                      <Form.Item
                        name="summary"
                        label={text('resolutionSummary', 'Resolution Summary')}
                        rules={
                          isSimpleFieldCloseout ? undefined : [{ required: true, whitespace: true }]
                        }
                      >
                        <Input.TextArea
                          rows={isSimpleFieldCloseout ? 2 : 3}
                          placeholder={text(
                            'describeWhatHappened',
                            'Briefly describe what happened'
                          )}
                        />
                      </Form.Item>
                      <Row gutter={16}>
                        <Col xs={24} sm={12}>
                          <Form.Item
                            name="furtherActionRequired"
                            label={text('furtherActionRequired', 'Further Action Required')}
                            rules={
                              isSimpleFieldCloseout
                                ? undefined
                                : [
                                    {
                                      required: true,
                                      message: text('selectYesNo', 'Select Yes or No.'),
                                    },
                                  ]
                            }
                          >
                            <Radio.Group
                              buttonStyle="solid"
                              optionType="button"
                              style={{ display: 'flex', width: '100%' }}
                            >
                              <Radio.Button value={true} style={{ flex: 1, textAlign: 'center' }}>
                                {text('yes', 'Yes')}
                              </Radio.Button>
                              <Radio.Button value={false} style={{ flex: 1, textAlign: 'center' }}>
                                {text('no', 'No')}
                              </Radio.Button>
                            </Radio.Group>
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
                                  label={text(
                                    'furtherActionRecommendation',
                                    'Further Action / Recommendation'
                                  )}
                                  rules={
                                    isSimpleFieldCloseout
                                      ? undefined
                                      : [
                                          {
                                            required: true,
                                            whitespace: true,
                                            message: text(
                                              'provideRecommendation',
                                              'Provide the further action or recommendation.'
                                            ),
                                          },
                                        ]
                                  }
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
                        </Col>
                        <Col xs={24} sm={12}>
                          <Form.Item
                            name="assistanceRequested"
                            label={text('assistanceRequested', 'Assistance Requested')}
                            rules={
                              isSimpleFieldCloseout
                                ? undefined
                                : [
                                    {
                                      required: true,
                                      message: text('selectYesNo', 'Select Yes or No.'),
                                    },
                                  ]
                            }
                          >
                            <Radio.Group
                              buttonStyle="solid"
                              optionType="button"
                              style={{ display: 'flex', width: '100%' }}
                            >
                              <Radio.Button value={true} style={{ flex: 1, textAlign: 'center' }}>
                                {text('yes', 'Yes')}
                              </Radio.Button>
                              <Radio.Button value={false} style={{ flex: 1, textAlign: 'center' }}>
                                {text('no', 'No')}
                              </Radio.Button>
                            </Radio.Group>
                          </Form.Item>
                        </Col>
                      </Row>
                      <Title level={5} style={{ margin: '0 0 12px' }}>
                        {text('evidence', 'Evidence')}
                      </Title>
                      <Form.Item>
                        <Upload
                          listType="picture-card"
                          beforeUpload={() => false}
                          accept="image/*"
                          maxCount={3}
                          fileList={evidenceFiles}
                          onChange={({ fileList }) => setEvidenceFiles(fileList)}
                          onRemove={(file) => {
                            setEvidenceFiles((current) =>
                              current.filter((entry) => entry.uid !== file.uid)
                            );
                          }}
                        >
                          {evidenceFiles.length < 3 && (
                            <div>
                              <UploadOutlined />
                              <div style={{ marginTop: 8 }}>
                                {text('uploadPhotos', 'Upload photos')}
                              </div>
                            </div>
                          )}
                        </Upload>
                        <Text type="secondary">
                          {text('evidenceLimit', 'Images only, up to 3 files and 5 MB each.')}
                        </Text>
                      </Form.Item>
                    </>
                  ),
                },
                    ]}
                  />
                )
              }
            </Form.Item>
            <Divider />
            <Row gutter={[16, 12]} align="middle">
              <Col xs={24} sm={12}>
                <Text type="secondary">
                  {text('resolvedBy', 'Resolved By')}: {resolutionSubmitter}
                  <br />
                  {text(
                    'submissionTimeAutomatic',
                    'Submission date and time are recorded automatically.'
                  )}
                </Text>
              </Col>
              <Col xs={24} sm={12}>
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={resolutionMutation.isPending}
                  block
                >
                  {text('submitForReview', 'Submit for review')}
                </Button>
              </Col>
            </Row>
          </Form>
        </Space>
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
