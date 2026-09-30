export const FIELD_REPORT_CATEGORIES = ['Public Concerns', 'Emergency Situations'];
export const BLOTTER_REPORT_CATEGORY = 'Blotter Cases';

export const FIELD_REPORT_STEPS = ['pending', 'coordinating', 'in_progress', 'resolved'] as const;
export const BLOTTER_REPORT_STEPS = ['pending', 'in_progress', 'resolved'] as const;

export function normalizeReportStatus(status: string): string {
  switch (status) {
    case 'acknowledged':
      return 'coordinating';
    case 'en_route':
    case 'on_scene':
      return 'in_progress';
    case 'verified':
      return 'pending';
    default:
      return status;
  }
}

export function getStatusLabel(status: string): string {
  if (status === 'reviewed') return 'Reviewed (legacy)';
  const canonicalStatus = normalizeReportStatus(status);
  return canonicalStatus
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function getReportSteps(category: string) {
  return category === BLOTTER_REPORT_CATEGORY ? BLOTTER_REPORT_STEPS : FIELD_REPORT_STEPS;
}

export function getActiveStep(category: string, status: string): number {
  const steps = getReportSteps(category);
  return (steps as readonly string[]).indexOf(normalizeReportStatus(status));
}
