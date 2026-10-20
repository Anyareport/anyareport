import {
  CheckCircleOutlined,
  CheckOutlined,
  FileOutlined,
  FlagOutlined,
  SettingOutlined,
  UserOutlined,
} from '@ant-design/icons';
import type { AuditLog } from '../lib/api';
import { getAuditActorRole, getAuditLabel, getAuditSummary } from '../lib/auditLabels';
import './AuditActivityRow.css';

const ICONS = {
  user: UserOutlined,
  'check-circle': CheckCircleOutlined,
  check: CheckOutlined,
  file: FileOutlined,
  flag: FlagOutlined,
  system: SettingOutlined,
};

type AuditDetail = {
  label: string;
  value: string;
};

function getAuditDetails(log: AuditLog): AuditDetail[] {
  const metadata = log.metadata || {};
  const details: AuditDetail[] = [];
  const addText = (label: string, value: unknown) => {
    if (typeof value === 'string' && value.trim()) details.push({ label, value: value.trim() });
  };
  const addCount = (label: string, value: unknown) => {
    if (typeof value === 'number' && Number.isFinite(value)) {
      details.push({ label, value: String(value) });
    }
  };

  switch (log.action) {
    case 'hotline_opened':
      addText('Contacted agency', metadata.agency);
      break;
    case 'resolution_submitted':
      addCount('Supporting evidence', metadata.evidenceCount);
      break;
    default:
      break;
  }

  return details;
}

interface AuditActivityRowProps {
  log: AuditLog;
  timeLabel?: string;
  showDetails?: boolean;
}

export default function AuditActivityRow({
  log,
  timeLabel,
  showDetails = false,
}: AuditActivityRowProps) {
  const auditLabel = getAuditLabel(log);
  const Icon = ICONS[auditLabel.icon];
  const actor = log.actorName || log.actorUid || 'system';
  const timestamp = new Date(log.timestamp);
  const fullTimestamp = timestamp.toLocaleString();
  const details = showDetails ? getAuditDetails(log) : [];

  return (
    <div className={`audit-activity audit-activity--${auditLabel.category}`}>
      <span className="audit-activity__icon" aria-hidden="true">
        <Icon />
      </span>
      <div className="audit-activity__body">
        <strong className="audit-activity__headline">{getAuditSummary(log)}</strong>
        <div className="audit-activity__subline">
          <span className="audit-activity__category">{auditLabel.label}</span>
          <span aria-hidden="true"> · </span>
          <span>by {actor}</span>
          {log.actorRole && (
            <>
              <span aria-hidden="true"> · </span>
              <span>{getAuditActorRole(log.actorRole)}</span>
            </>
          )}
        </div>
        {details.length > 0 && (
          <details className="audit-activity__details">
            <summary>Event details</summary>
            <dl className="audit-activity__detail-list">
              {details.map(({ label, value }) => (
                <div className="audit-activity__detail" key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </details>
        )}
      </div>
      <time className="audit-activity__time" dateTime={timestamp.toISOString()} title={fullTimestamp}>
        {timeLabel || fullTimestamp}
      </time>
    </div>
  );
}
