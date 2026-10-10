import type { Report } from './api';
import { normalizeReportStatus } from './reportWorkflow.ts';

export const EMERGENCY_CATEGORY = 'Emergency Situations';

export const STATUS_ORDER: Record<string, number> = {
  pending: 0,
  coordinating: 1,
  in_progress: 2,
  flagged: 4,
  resolved: 5,
};

export const SEVERITY_ORDER: Record<string, number> = {
  Critical: 0,
  High: 1,
  Medium: 2,
  Low: 3,
};

export const TERMINAL_STATUSES = new Set(['resolved', 'flagged']);

export function getPriorityTier(r: Report): number {
  const status = normalizeReportStatus(r.status);
  if (status === 'flagged') return 3;
  if (TERMINAL_STATUSES.has(status)) return 2;
  if (r.category === EMERGENCY_CATEGORY || r.severity === 'Critical') return 0;
  return 1;
}

export function getStatusOrder(status: string): number {
  return STATUS_ORDER[normalizeReportStatus(status)] ?? 99;
}

export function getSeverityOrder(severity: string | null | undefined): number {
  return SEVERITY_ORDER[severity ?? ''] ?? 4;
}

export function compareDateDesc(a: Report, b: Report): number {
  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
}

export function compareDateAsc(a: Report, b: Report): number {
  return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
}

export function compareIncidentPriority(a: Report, b: Report): number {
  const tierDiff = getPriorityTier(a) - getPriorityTier(b);
  if (tierDiff !== 0) return tierDiff;

  const tier = getPriorityTier(a);
  let dateDiff = 0;

  if (tier <= 1) {
    const severityDiff = getSeverityOrder(a.severity) - getSeverityOrder(b.severity);
    if (severityDiff !== 0) return severityDiff;

    const emergencyDiff =
      Number(b.category === EMERGENCY_CATEGORY) - Number(a.category === EMERGENCY_CATEGORY);
    if (emergencyDiff !== 0) return emergencyDiff;

    const statusDiff = getStatusOrder(a.status) - getStatusOrder(b.status);
    if (statusDiff !== 0) return statusDiff;

    dateDiff = compareDateAsc(a, b);
  } else if (tier === 2) {
    const aResolvedAt = new Date(a.resolution?.resolvedAt || a.createdAt).getTime();
    const bResolvedAt = new Date(b.resolution?.resolvedAt || b.createdAt).getTime();
    dateDiff = bResolvedAt - aResolvedAt;
  } else {
    dateDiff = compareDateDesc(a, b);
  }

  if (dateDiff !== 0) return dateDiff;
  return String(a._id).localeCompare(String(b._id));
}

export function compareSeverity(a: Report, b: Report): number {
  return (
    getSeverityOrder(a.severity) - getSeverityOrder(b.severity) ||
    String(a._id).localeCompare(String(b._id))
  );
}

export function compareStatus(a: Report, b: Report): number {
  return (
    getStatusOrder(a.status) - getStatusOrder(b.status) ||
    String(a._id).localeCompare(String(b._id))
  );
}

export function compareCreatedAt(a: Report, b: Report): number {
  return compareDateAsc(a, b) || String(a._id).localeCompare(String(b._id));
}
