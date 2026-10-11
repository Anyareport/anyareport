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
export const CRIMINAL_BLOTTER_SUBCATEGORY = 'Criminal';

// Criminal blotter cases are worked by tanods/responders, so they use the field workflow
// (including "coordinating"). Only civil blotter cases use the shorter 3-step flow.
export function getReportSteps(category: string, subcategory?: string | null) {
  if (category === BLOTTER_REPORT_CATEGORY && subcategory !== CRIMINAL_BLOTTER_SUBCATEGORY) {
    return BLOTTER_REPORT_STEPS;
  }
  return FIELD_REPORT_STEPS;
}

export function getActiveStep(
  category: string,
  status: string,
  subcategory?: string | null
): number {
  const steps = getReportSteps(category, subcategory);
  return (steps as readonly string[]).indexOf(normalizeReportStatus(status));
}
