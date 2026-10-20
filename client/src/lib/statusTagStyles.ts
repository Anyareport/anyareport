import type { CSSProperties } from 'react';
import { normalizeReportStatus } from './reportWorkflow';

const statusStyles: Record<string, CSSProperties> = {
  active: {
    backgroundColor: 'color-mix(in srgb, var(--severity-low-tag) 14%, transparent)',
    borderColor: 'var(--severity-low-tag)',
    color: 'var(--severity-low-tag)',
  },
  suspended: {
    backgroundColor: 'color-mix(in srgb, var(--status-flagged-tag) 14%, transparent)',
    borderColor: 'var(--status-flagged-tag)',
    color: 'var(--status-flagged-text)',
  },
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

export function getStatusTagStyle(status: string): CSSProperties {
  const displayStatus = normalizeReportStatus(status);
  const style = statusStyles[displayStatus] ?? {
    backgroundColor: 'var(--neutral-100)',
    borderColor: 'var(--border-default)',
    color: 'var(--text-secondary)',
  };

  return { ...style, border: 0, fontWeight: 600 };
}
