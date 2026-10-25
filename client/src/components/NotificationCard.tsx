import {
  AlertOutlined,
  BellOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  DownOutlined,
  FileTextOutlined,
  TeamOutlined,
  SafetyOutlined,
  SyncOutlined,
  UserAddOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Button, Typography } from 'antd';
import { useState } from 'react';
import type { CSSProperties } from 'react';
import type { NotificationFeedItem } from '../lib/api';
import { useLang } from '../contexts/LanguageContext';
import type { LabelKey } from '../i18n/labels';
import { getStatusLabel } from '../lib/reportWorkflow';
import { getSeverityStyle } from './SeverityTag';
import { Link } from 'react-router-dom';
import { getCompactAddressLabel } from '../lib/incidentUtils';

const { Text } = Typography;

interface NotificationCardProps {
  item: NotificationFeedItem;
  role: string | null;
  to: string | null;
  onOpen?: () => void;
}

function formatTime(value: string) {
  const date = new Date(value);
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

const ACTOR_ROLE_LABELS: Record<string, string> = {
  captain: 'the Barangay Captain',
  secretary: 'the Barangay Secretary',
  tanod: 'a Barangay Tanod',
  responder: 'an Emergency Responder',
};

function getActorLabel(actorRole: string | null, actorName: string | null, role: string | null) {
  if (role === 'resident') return ACTOR_ROLE_LABELS[actorRole || ''] || 'a staff member';
  return actorName || ACTOR_ROLE_LABELS[actorRole || ''] || '';
}

function getItemActorLabel(item: NotificationFeedItem, role: string | null) {
  return getActorLabel(item.actorRole, item.actorName, role);
}

function getHeadline(item: NotificationFeedItem, role: string | null) {
  const reference = item.report.referenceNumber;
  const title = item.report.title;
  const category = item.report.category;
  const hasUsefulTitle = title && title.toLowerCase() !== category?.toLowerCase();

  if (item.kind === 'status_group') {
    const reportLabel = reference ? ` ${reference}` : '';
    const statusLabel = getStatusLabel(item.status || 'pending');
    return role === 'resident'
      ? `Your report${reportLabel} status is ${statusLabel}`
      : `${reference || 'Report'} status is ${statusLabel}`;
  }

  if (item.type === 'incident_received') {
    const prefix =
      category === 'Emergency Situations'
        ? 'New emergency'
        : category === 'Blotter Cases'
          ? 'New blotter case'
          : 'New public concern';
    return hasUsefulTitle ? `${prefix}: ${title}` : prefix;
  }

  if (item.type === 'backup_requested') {
    return `Backup requested${reference ? ` for ${reference}` : ''}`;
  }

  if (item.type === 'backup_joined') {
    const actor = role === 'resident' ? 'A responder' : item.actorName || 'A responder';
    return `${actor} joined as backup`;
  }

  return item.message;
}

function isAdminEvent(item: NotificationFeedItem) {
  return item.type.startsWith('admin_');
}

function getIconKind(item: NotificationFeedItem) {
  if (item.type === 'admin_report_flagged') return 'flagged';
  if (
    item.type === 'admin_user_created' ||
    item.type === 'admin_user_status_changed' ||
    item.type === 'admin_user_role_changed'
  ) {
    return 'admin-account';
  }
  if (isAdminEvent(item)) return 'admin-event';
  if (item.type === 'dispatch_response') {
    if (item.dispatchResponse === 'accepted') return 'response-accepted';
    if (item.dispatchResponse === 'declined') return 'response-declined';
  }
  if (item.type === 'backup_requested') return 'backup-requested';
  if (item.type === 'backup_joined') return 'backup-joined';
  if (item.kind === 'status_group') {
    if (item.status === 'resolved') return 'resolved';
    if (item.status === 'flagged') return 'flagged';
    if (item.status === 'coordinating' || item.status === 'in_progress') return 'in-progress';
    return 'pending';
  }
  if (item.report.category === 'Emergency Situations') return 'emergency';
  return 'new-report';
}

function getIcon(kind: string) {
  switch (kind) {
    case 'admin-account':
      return <UserOutlined />;
    case 'backup-requested':
      return <TeamOutlined />;
    case 'backup-joined':
      return <UserAddOutlined />;
    case 'admin-event':
      return <SafetyOutlined />;
    case 'response-accepted':
      return <CheckCircleOutlined />;
    case 'response-declined':
      return <CloseCircleOutlined />;
    case 'new-report':
      return <FileTextOutlined />;
    case 'resolved':
      return <CheckCircleOutlined />;
    case 'flagged':
    case 'emergency':
      return <AlertOutlined />;
    case 'in-progress':
      return <SyncOutlined />;
    case 'pending':
      return <ClockCircleOutlined />;
    default:
      return <BellOutlined />;
  }
}

function getSeverityLabel(
  severity: string,
  role: string | null,
  lang: string,
  t: (key: LabelKey) => string
) {
  const severityKeys: Record<string, LabelKey> = {
    critical: 'severityCritical',
    high: 'severityHigh',
    medium: 'severityMedium',
    low: 'severityLow',
  };
  const key = severityKeys[severity.toLowerCase()];
  return lang === 'fil' && ['tanod', 'responder'].includes(role || '') && key
    ? t(key)
    : severity;
}

function getContext(item: NotificationFeedItem, role: string | null) {
  const actor = getItemActorLabel(item, role);
  if (isAdminEvent(item)) return item.urgent ? 'Needs your attention' : null;
  if (!actor || item.type === 'incident_received') return null;
  if (item.kind === 'status_group') return `Updated by ${actor}`;
  if (item.type === 'backup_requested') return `${actor} requested assistance`;
  if (item.type === 'backup_joined') return `${actor} is assisting`;
  return null;
}

export default function NotificationCard({ item, role, to, onOpen }: NotificationCardProps) {
  const [expanded, setExpanded] = useState(false);
  const context = getContext(item, role);
  const iconKind = getIconKind(item);
  const severity = item.report.severity;
  const severityStyle = severity ? getSeverityStyle(severity) : undefined;
  const incidentSeverityClass =
    item.type === 'incident_received' && severity
      ? ` notification-card__icon--severity-${severity.toLowerCase()}`
      : '';
  const { lang, t } = useLang();
  const detailItems: { label: string; className?: string; style?: CSSProperties }[] = [];
  if (severity) {
    detailItems.push({
      label: getSeverityLabel(severity, role, lang, t),
      className: 'notification-card__severity',
      style: severityStyle,
    });
  }
  if (item.report.referenceNumber) detailItems.push({ label: item.report.referenceNumber });
  if (item.report.category) detailItems.push({ label: item.report.category });
  const location = getCompactAddressLabel(item.report.location);
  if (location) detailItems.push({ label: location });
  if (context) detailItems.push({ label: context });
  const row = (
    <>
      <div
        className={`notification-card__icon notification-card__icon--${iconKind}${incidentSeverityClass}`}
        aria-hidden="true"
      >
        {getIcon(iconKind)}
      </div>
      <div className="notification-card__body">
        <Text className="notification-card__headline">{getHeadline(item, role)}</Text>
        {detailItems.length > 0 && (
          <Text type="secondary" className="notification-card__details">
            {detailItems.map((detail, index) => (
              <span
                className={detail.className}
                style={detail.style ? { color: detail.style.color } : undefined}
                key={`${detail.label}-${index}`}
              >
                {index > 0 && <span aria-hidden="true"> · </span>}
                {detail.label}
              </span>
            ))}
          </Text>
        )}
      </div>
      <div className="notification-card__time-column">
        <Text
          type="secondary"
          className="notification-card__time"
          title={new Date(item.createdAt).toLocaleString()}
        >
          {formatTime(item.createdAt)}
        </Text>
        {!item.read && <span className="notification-card__unread-dot" aria-label="Unread" />}
      </div>
    </>
  );
  const earlierUpdates = item.kind === 'status_group' && item.earlierUpdates.length > 0 && (
    <>
      <Button
        type="link"
        size="small"
        className="notification-card__expand"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
      >
        <DownOutlined className={expanded ? 'notification-card__chevron--open' : ''} />
        {expanded
          ? 'Hide earlier updates'
          : `Show ${item.earlierUpdates.length} earlier ${item.earlierUpdates.length === 1 ? 'update' : 'updates'}`}
      </Button>
      {expanded && (
        <ol className="notification-card__history">
          {item.earlierUpdates.map((update) => {
            const actor = getActorLabel(update.actorRole, update.actorName, role);
            return (
              <li key={update.id}>
                <span>{getStatusLabel(update.status || 'pending')}</span>
                {actor && <span> by {actor}</span>}
                <Text type="secondary" title={new Date(update.createdAt).toLocaleString()}>
                  {formatTime(update.createdAt)}
                </Text>
              </li>
            );
          })}
        </ol>
      )}
    </>
  );

  return (
    <article className={`notification-card${item.read ? '' : ' notification-card--unread'}`}>
      {to ? (
        <Link to={to} className="notification-card__row" onClick={onOpen}>
          {row}
        </Link>
      ) : (
        <div
          className="notification-card__row notification-card__row--interactive"
          onClick={onOpen}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              onOpen?.();
            }
          }}
          role="button"
          tabIndex={0}
        >
          {row}
        </div>
      )}
      {earlierUpdates}
    </article>
  );
}