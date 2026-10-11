import { Tag } from 'antd';
import { getStatusLabel, normalizeReportStatus } from '../lib/reportWorkflow';

const statusStyles: Record<
  string,
  { backgroundColor: string; borderColor: string; color: string }
> = {
  pending: {
    backgroundColor: 'color-mix(in srgb, var(--status-pending-tag) 14%, transparent)',
    borderColor: 'var(--status-pending-tag)',
    color: 'var(--status-pending-text)',
  },
  coordinating: {
    backgroundColor: 'color-mix(in srgb, var(--status-coordinating-border) 14%, transparent)',
    borderColor: 'var(--status-coordinating-border)',
    color: 'var(--status-coordinating-text)',
  },
  verified: {
    backgroundColor: 'color-mix(in srgb, var(--status-verified-tag) 14%, transparent)',
    borderColor: 'var(--status-verified-tag)',
    color: 'var(--status-verified-tag)',
  },
  acknowledged: {
    backgroundColor: 'color-mix(in srgb, var(--status-en-route-tag) 14%, transparent)',
    borderColor: 'var(--status-en-route-tag)',
    color: 'var(--status-en-route-tag)',
  },
  in_progress: {
    backgroundColor: 'color-mix(in srgb, var(--status-on-scene-tag) 14%, transparent)',
    borderColor: 'var(--status-on-scene-tag)',
    color: 'var(--status-on-scene-text)',
  },
  en_route: {
    backgroundColor: 'color-mix(in srgb, var(--status-en-route-tag) 14%, transparent)',
    borderColor: 'var(--status-en-route-tag)',
    color: 'var(--status-en-route-tag)',
  },
  on_scene: {
    backgroundColor: 'color-mix(in srgb, var(--status-on-scene-tag) 14%, transparent)',
    borderColor: 'var(--status-on-scene-tag)',
    color: 'var(--status-on-scene-tag)',
  },
  resolved: {
    backgroundColor: 'color-mix(in srgb, var(--status-resolved-tag) 14%, transparent)',
    borderColor: 'var(--status-resolved-tag)',
    color: 'var(--status-resolved-tag)',
  },
  flagged: {
    backgroundColor: 'color-mix(in srgb, var(--status-flagged-tag) 14%, transparent)',
    borderColor: 'var(--status-flagged-tag)',
    color: 'var(--status-flagged-tag)',
  },
};

export default function StatusTag({ status }: { status: string }) {
  const displayStatus = normalizeReportStatus(status);
  const style = statusStyles[displayStatus] ?? {
    backgroundColor: 'var(--neutral-100)',
    borderColor: 'var(--border-default)',
    color: 'var(--text-secondary)',
  };

  return <Tag style={{ ...style, border: 0 }}>{formatStatus(status)}</Tag>;
}

export function formatStatus(status: string) {
  return getStatusLabel(status);
}
