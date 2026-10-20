import type { AuditLog } from './api';

export type AuditCategory = 'incident' | 'account' | 'resolved' | 'flagged' | 'system';
export type AuditIcon = 'user' | 'check-circle' | 'check' | 'file' | 'flag' | 'system';

export interface AuditLabel {
  label: string;
  category: AuditCategory;
  tone: 'blue' | 'orange' | 'green' | 'gray';
  icon: AuditIcon;
}

const AUDIT_LABELS: Record<string, AuditLabel> = {
  report_submitted: { label: 'Report submitted', category: 'incident', tone: 'blue', icon: 'file' },
  report_acknowledged: {
    label: 'Report acknowledged',
    category: 'incident',
    tone: 'blue',
    icon: 'check-circle',
  },
  report_classified: { label: 'Report classified', category: 'incident', tone: 'blue', icon: 'file' },
  hotline_opened: { label: 'Hotline opened', category: 'incident', tone: 'blue', icon: 'file' },
  report_recipients_notified: {
    label: 'Responders notified',
    category: 'system',
    tone: 'gray',
    icon: 'system',
  },
  resolution_submitted: {
    label: 'Resolution submitted',
    category: 'incident',
    tone: 'blue',
    icon: 'file',
  },
  status_updated: { label: 'Status updated', category: 'incident', tone: 'blue', icon: 'file' },
  user_role_changed: {
    label: 'Role changed',
    category: 'account',
    tone: 'orange',
    icon: 'user',
  },
  user_status_changed: {
    label: 'Account status changed',
    category: 'account',
    tone: 'orange',
    icon: 'user',
  },
  user_created: { label: 'User created', category: 'account', tone: 'orange', icon: 'user' },
  report_flagged: { label: 'Report flagged', category: 'flagged', tone: 'orange', icon: 'flag' },
  admin_notification_read: {
    label: 'Notification read',
    category: 'system',
    tone: 'gray',
    icon: 'system',
  },
  admin_notification_read_all: {
    label: 'All notifications read',
    category: 'system',
    tone: 'gray',
    icon: 'system',
  },
  admin_notification_sent: {
    label: 'Notification sent',
    category: 'system',
    tone: 'gray',
    icon: 'system',
  },
};

export const NOTIFICATION_AUDIT_ACTIONS = [
  'admin_notification_read',
  'admin_notification_read_all',
  'admin_notification_sent',
];

const NOTIFICATION_TYPE_LABELS: Record<string, string> = {
  admin_user_created: 'new admin account',
  admin_user_status_changed: 'admin account status change',
  admin_user_role_changed: 'admin role change',
  admin_report_flagged: 'flagged report',
};

function sentenceCase(value: string) {
  const text = value.replace(/_/g, ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function getNotificationSubject(type: unknown) {
  if (typeof type !== 'string' || !type) return 'an admin notification';
  return NOTIFICATION_TYPE_LABELS[type] || sentenceCase(type);
}

export function getAuditLabel(log: Pick<AuditLog, 'action' | 'metadata'>): AuditLabel {
  const known = AUDIT_LABELS[log.action];
  if (!known) {
    return { label: sentenceCase(log.action), category: 'system', tone: 'gray', icon: 'system' };
  }

  if (log.action === 'status_updated' && log.metadata?.status === 'resolved') {
    return { ...known, category: 'resolved', tone: 'green', icon: 'check' };
  }

  return known;
}

export function getAuditSummary(log: AuditLog) {
  const metadata = log.metadata || {};
  const target =
    (typeof metadata.targetName === 'string' && metadata.targetName) ||
    (typeof metadata.targetEmail === 'string' && metadata.targetEmail) ||
    (typeof metadata.targetUid === 'string' && metadata.targetUid);
  const reference = log.reportReferenceNumber ? `Report ${log.reportReferenceNumber}` : 'Report';

  switch (log.action) {
    case 'user_created':
      return `Created ${metadata.role ?? 'user'} account for ${target ?? 'unknown user'}`;
    case 'user_status_changed':
    case 'user_role_changed':
      return `${target ?? 'Unknown user'}: ${metadata.from ?? '?'} → ${metadata.to ?? '?'}`;
    case 'admin_notification_sent':
      return `${metadata.urgent ? 'Urgent ' : ''}${sentenceCase(getNotificationSubject(metadata.type))} notification sent to ${metadata.recipientCount ?? 0} admins`;
    case 'admin_notification_read':
      return `Read a notification about ${getNotificationSubject(metadata.type)}`;
    case 'admin_notification_read_all':
      return `Marked ${metadata.count ?? 0} notifications as read`;
    case 'report_recipients_notified':
      return `${metadata.recipientCount ?? 0} responder(s) notified`;
    case 'status_updated':
      return metadata.status
        ? `${reference} status updated to ${sentenceCase(String(metadata.status))}`
        : `${reference} status updated`;
    case 'report_submitted':
      return metadata.category ? `${reference} submitted in ${metadata.category}` : `${reference} submitted`;
    case 'report_acknowledged':
      return `${reference} acknowledged`;
    case 'resolution_submitted':
      return `Resolution submitted for ${reference.toLowerCase()}`;
    case 'report_classified':
      return metadata.category
        ? `${reference} classified as ${metadata.category}`
        : `${reference} classified`;
    case 'report_flagged':
      return `${reference} flagged`;
    case 'hotline_opened':
      return `${reference} hotline opened`;
    default:
      return reference === 'Report' ? getAuditLabel(log).label : reference;
  }
}

export function getAuditActorRole(role?: string | null) {
  if (!role) return '';
  if (role === 'admin') return 'Sysadmin';
  return `${role.charAt(0).toUpperCase()}${role.slice(1)}`;
}
