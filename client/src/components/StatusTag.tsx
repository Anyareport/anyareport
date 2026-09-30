import { Tag } from 'antd';
import { getStatusLabel, normalizeReportStatus } from '../lib/reportWorkflow';

const statusStyles: Record<
  string,
  { backgroundColor: string; borderColor: string; color: string }
> = {
  pending: {
    backgroundColor: 'var(--status-pending-bg)',
    borderColor: 'var(--status-pending-border)',
    color: 'var(--status-pending-text)',
  },
  coordinating: {
    backgroundColor: 'var(--status-coordinating-bg)',
    borderColor: 'var(--status-coordinating-border)',
    color: 'var(--status-coordinating-text)',
  },
  verified: {
    backgroundColor: 'var(--status-verified-bg)',
    borderColor: 'var(--status-verified-border)',
    color: 'var(--status-verified-text)',
  },
  acknowledged: {
    backgroundColor: 'var(--status-en-route-bg)',
    borderColor: 'var(--status-en-route-border)',
    color: 'var(--status-en-route-text)',
  },
  in_progress: {
    backgroundColor: 'var(--status-on-scene-bg)',
    borderColor: 'var(--status-on-scene-border)',
    color: 'var(--status-on-scene-text)',
  },
  en_route: {
    backgroundColor: 'var(--status-en-route-bg)',
    borderColor: 'var(--status-en-route-border)',
    color: 'var(--status-en-route-text)',
  },
  on_scene: {
    backgroundColor: 'var(--status-on-scene-bg)',
    borderColor: 'var(--status-on-scene-border)',
    color: 'var(--status-on-scene-text)',
  },
  resolved: {
    backgroundColor: 'var(--status-resolved-bg)',
    borderColor: 'var(--status-resolved-border)',
    color: 'var(--status-resolved-text)',
  },
  flagged: {
    backgroundColor: 'var(--status-flagged-bg)',
    borderColor: 'var(--status-flagged-border)',
    color: 'var(--status-flagged-text)',
  },
};

export default function StatusTag({ status }: { status: string }) {
  const displayStatus = normalizeReportStatus(status);
  const style = statusStyles[displayStatus] ?? {
    backgroundColor: 'var(--neutral-100)',
    borderColor: 'var(--border-default)',
    color: 'var(--text-secondary)',
  };

  return <Tag style={style}>{formatStatus(status)}</Tag>;
}

export function formatStatus(status: string) {
  return getStatusLabel(status);
}
