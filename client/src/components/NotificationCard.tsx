import {
  AlertOutlined,
  BellOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  DownOutlined,
  TeamOutlined,
  SyncOutlined,
  UserAddOutlined,
} from '@ant-design/icons';
import { Button, Typography } from 'antd';
import { useState } from 'react';
import type { NotificationFeedItem } from '../lib/api';
import { getStatusLabel } from '../lib/reportWorkflow';
import SeverityTag from './SeverityTag';
import FeedCard from './FeedCard';

const { Text } = Typography;

interface NotificationCardProps {
  item: NotificationFeedItem;
  role: string | null;
  to: string | null;
  onOpen?: () => void;
}

function formatRelativeTime(value: string) {
  const date = new Date(value);
  const elapsed = Date.now() - date.getTime();
  if (!Number.isFinite(elapsed) || elapsed < 0) return date.toLocaleDateString();
  if (elapsed < 60_000) return 'Just now';
  if (elapsed < 3_600_000) return `${Math.floor(elapsed / 60_000)} min ago`;
  if (elapsed < 86_400_000) {
    const hours = Math.floor(elapsed / 3_600_000);
    return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  }
  return `${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}, ${date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;
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

function getIconKind(item: NotificationFeedItem) {
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
    case 'backup-requested':
      return <TeamOutlined />;
    case 'backup-joined':
      return <UserAddOutlined />;
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

function getContext(item: NotificationFeedItem, role: string | null) {
  const actor = getItemActorLabel(item, role);
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
  const severityClass = item.report.severity
    ? ` notification-card--severity-${item.report.severity.toLowerCase()}`
    : '';
  const content = (
    <div className="notification-card__row">
      <div className={`notification-card__icon notification-card__icon--${iconKind}`}>
        {getIcon(iconKind)}
      </div>
      <div className="notification-card__body">
        <div className="notification-card__topline">
          <div className="notification-card__headline-row">
            <Text className="notification-card__headline">{getHeadline(item, role)}</Text>
            <SeverityTag severity={item.report.severity} />
          </div>
          <Text
            type="secondary"
            className="notification-card__time"
            title={new Date(item.createdAt).toLocaleString()}
          >
            {formatRelativeTime(item.createdAt)}
          </Text>
        </div>

        <div className="notification-card__details">
          {item.report.referenceNumber && <span>{item.report.referenceNumber}</span>}
          {item.report.category && <span>{item.report.category}</span>}
          {item.report.location && <span>{item.report.location}</span>}
          {context && <span>{context}</span>}
        </div>
      </div>
      {!item.read && <span className="notification-card__unread-dot" aria-label="Unread" />}
    </div>
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
                  {formatRelativeTime(update.createdAt)}
                </Text>
              </li>
            );
          })}
        </ol>
      )}
    </>
  );

  return (
    <FeedCard
      to={to}
      onClick={onOpen}
      afterLink={earlierUpdates}
      className={`notification-card${item.read ? '' : ' notification-card--unread'}${severityClass}`}
    >
      {content}
    </FeedCard>
  );
}
