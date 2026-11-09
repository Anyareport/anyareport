import type { CSSProperties } from 'react';
import { normalizeReportStatus } from './reportWorkflow';

const statusStyles: Record<string, CSSProperties> = {
  active: {
    backgroundColor: 'color-mix(in srgb, var(--severity-low-tag) 14%, transparent)',
    color: 'var(--severity-low-tag)',
  },
  suspended: {
    backgroundColor: 'color-mix(in srgb, var(--status-flagged-tag) 14%, transparent)',
    color: 'var(--status-flagged-tag)',
  },
  pending: {
    backgroundColor: 'color-mix(in srgb, var(--status-pending-tag) 14%, transparent)',
    color: 'var(--status-pending-tag)',
  },
  coordinating: {
    backgroundColor: 'color-mix(in srgb, var(--status-coordinating-tag) 14%, transparent)',
    color: 'var(--status-coordinating-tag)',
  },
  verified: {
    backgroundColor: 'color-mix(in srgb, var(--status-verified-tag) 14%, transparent)',
    color: 'var(--status-verified-tag)',
  },
  acknowledged: {
    backgroundColor: 'color-mix(in srgb, var(--status-en-route-tag) 14%, transparent)',
    color: 'var(--status-en-route-tag)',
  },
  in_progress: {
    backgroundColor: 'color-mix(in srgb, var(--status-on-scene-tag) 14%, transparent)',
    color: 'var(--status-on-scene-tag)',
  },
  en_route: {
    backgroundColor: 'color-mix(in srgb, var(--status-en-route-tag) 14%, transparent)',
    color: 'var(--status-en-route-tag)',
  },
  on_scene: {
    backgroundColor: 'color-mix(in srgb, var(--status-on-scene-tag) 14%, transparent)',
    color: 'var(--status-on-scene-tag)',
  },
  resolved: {
    backgroundColor: 'color-mix(in srgb, var(--status-resolved-tag) 14%, transparent)',
    color: 'var(--status-resolved-tag)',
  },
  endorsed: {
    backgroundColor: 'color-mix(in srgb, var(--status-coordinating-tag) 14%, transparent)',
    color: 'var(--status-coordinating-tag)',
  },
  flagged: {
    backgroundColor: 'color-mix(in srgb, var(--status-flagged-tag) 14%, transparent)',
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
