import type { Report } from './api';

export const EMERGENCY_CATEGORY = 'Emergency Situations';

export const STATUS_ORDER: Record<string, number> = {
  pending: 0,
  verified: 1,
  en_route: 2,
  on_scene: 3,
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
  if (r.category === EMERGENCY_CATEGORY || r.severity === 'Critical') return 0;
  if (TERMINAL_STATUSES.has(r.status)) return 2;
  return 1;
}

export function getStatusOrder(status: string): number {
  return STATUS_ORDER[status] ?? 99;
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

  const sevDiff = getSeverityOrder(a.severity) - getSeverityOrder(b.severity);
  if (sevDiff !== 0) return sevDiff;

  const statusDiff = getStatusOrder(a.status) - getStatusOrder(b.status);
  if (statusDiff !== 0) return statusDiff;

  return compareDateDesc(a, b);
}

export function compareSeverity(a: Report, b: Report): number {
  const tierDiff = getPriorityTier(a) - getPriorityTier(b);
  if (tierDiff !== 0) return tierDiff;
  return getSeverityOrder(a.severity) - getSeverityOrder(b.severity);
}

export function compareStatus(a: Report, b: Report): number {
  const tierDiff = getPriorityTier(a) - getPriorityTier(b);
  if (tierDiff !== 0) return tierDiff;
  return getStatusOrder(a.status) - getStatusOrder(b.status);
}

export function compareCreatedAt(a: Report, b: Report): number {
  const tierDiff = getPriorityTier(a) - getPriorityTier(b);
  if (tierDiff !== 0) return tierDiff;
  return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
}
