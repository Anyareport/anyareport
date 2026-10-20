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
        {showDetails && log.userAgent && (
          <details className="audit-activity__details">
            <summary>Details</summary>
            <span>{log.userAgent}</span>
          </details>
        )}
      </div>
      <time className="audit-activity__time" dateTime={timestamp.toISOString()} title={fullTimestamp}>
        {timeLabel || fullTimestamp}
      </time>
    </div>
  );
}
