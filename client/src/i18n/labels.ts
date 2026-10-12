import { getStatusLabel, normalizeReportStatus } from '../lib/reportWorkflow';

export type Lang = 'en' | 'fil';

// PLACEHOLDER: pending review by Chief Tanod/responders.
export const labels = {
  acknowledge: { en: 'Acknowledge', fil: 'Tanggapin' },
  startWork: { en: 'Start work', fil: 'Simulan ang Aksyon' },
  requestBackup: { en: 'Request backup', fil: 'Humingi ng Backup' },
  joinBackup: { en: 'Join as assisting responder', fil: 'Sumama sa Backup' },
  resolve: { en: 'Mark resolved', fil: 'Tapusin ang Kaso' },
  closeBackup: { en: 'Enough help', fil: 'Sapat na ang Tulong' },
  acknowledgeSuccess: { en: 'Incident acknowledged', fil: 'Natanggap na ang report' },
  startWorkSuccess: { en: 'Incident status updated', fil: 'Na-update na ang status ng report' },
  resolutionSuccess: { en: 'Resolution submitted', fil: 'Naipasa na ang resulta ng aksyon' },
  requestBackupSuccess: { en: 'Backup requested', fil: 'Humingi na ng backup' },
  requestBackupAlready: { en: 'Backup is already requested', fil: 'May naka-request nang backup' },
  joinBackupSuccess: { en: 'You joined as backup', fil: 'Sumama ka na bilang backup' },
  joinBackupAlready: { en: 'You are already assisting', fil: 'Tumutulong ka na' },
  closeBackupSuccess: {
    en: 'No more backup needed',
    fil: 'Hindi na kailangan ng dagdag na backup',
  },
  closeBackupAlready: {
    en: 'Backup request is already closed',
    fil: 'Sarado na ang request para sa backup',
  },
  acknowledgedBy: { en: 'Acknowledged by', fil: 'Tinanggap ni' },
  reportReceived: { en: 'Report received', fil: 'Natanggap ang report' },
  flaggedReview: {
    en: 'This report has been flagged for review.',
    fil: 'Minarkahan ang report para repasuhin.',
  },
  reportProgress: { en: 'Report progress', fil: 'Progreso ng report' },
  dashboard: { en: 'Dashboard', fil: 'Dashboard' },
  alerts: { en: 'Alerts', fil: 'Mga Alert' },
  history: { en: 'History', fil: 'Kasaysayan' },
  notifications: { en: 'Notifications', fil: 'Notifications' },
  profile: { en: 'Profile', fil: 'Profile' },
  all: { en: 'All', fil: 'Lahat' },
  emergencyFilter: { en: 'Emergency', fil: 'Emergency' },
  publicConcernFilter: { en: 'Public concern', fil: 'Usaping pampubliko' },
  criminalFilter: { en: 'Criminal', fil: 'Kriminal' },
  filterAlerts: { en: 'Filter alerts by category', fil: 'I-filter ang alerts ayon sa kategorya' },
  noReportsWaiting: {
    en: 'No reports are waiting for a response',
    fil: 'Walang report na naghihintay ng aksyon',
  },
  noAlertsInCategory: { en: 'No alerts in this category', fil: 'Walang alert sa kategoryang ito' },
  pending: { en: 'Pending', fil: 'Hindi pa natatanggap' },
  coordinating: { en: 'Coordinating', fil: 'May umaksyon' },
  inProgress: { en: 'In Progress', fil: 'Aksyon ginagawa' },
  resolved: { en: 'Resolved', fil: 'Tapos na' },
  flagged: { en: 'Flagged', fil: 'Minarkahan para repasuhin' },
  verified: { en: 'Verified', fil: 'Na-verify' },
  reviewedLegacy: { en: 'Reviewed (legacy)', fil: 'Nasuri (lumang status)' },
  publicConcerns: { en: 'Public Concerns', fil: 'Mga Usaping Pampubliko' },
  emergencySituations: { en: 'Emergency Situations', fil: 'Mga Emergency' },
  blotterCases: { en: 'Blotter Cases', fil: 'Mga Kaso sa Blotter' },
  blotterCase: { en: 'Blotter case', fil: 'Kaso sa Blotter' },
  criminal: { en: 'Criminal', fil: 'Kriminal' },
  civil: { en: 'Civil', fil: 'Sibil' },
} as const;

export type LabelKey = keyof typeof labels;

export function getCategoryLabel(category: string, subcategory?: string | null) {
  const categoryKey = {
    'Public Concerns': 'publicConcerns',
    'Emergency Situations': 'emergencySituations',
    'Blotter Cases': 'blotterCases',
  }[category] as LabelKey | undefined;
  const subcategoryKey = {
    Criminal: 'criminal',
    Civil: 'civil',
  }[subcategory || ''] as LabelKey | undefined;

  return {
    category: categoryKey,
    subcategory: subcategoryKey,
  };
}

export function getLocalizedCategory(
  category: string,
  subcategory: string | null | undefined,
  t: (key: LabelKey) => string
) {
  const keys = getCategoryLabel(category, subcategory);
  return {
    category: keys.category ? t(keys.category) : category,
    subcategory: subcategory ? (keys.subcategory ? t(keys.subcategory) : subcategory) : null,
  };
}

export function getLocalizedStatus(status: string, t: (key: LabelKey) => string) {
  const canonicalStatus = normalizeReportStatus(status);
  const statusKey: Partial<Record<string, LabelKey>> = {
    pending: 'pending',
    coordinating: 'coordinating',
    in_progress: 'inProgress',
    resolved: 'resolved',
    flagged: 'flagged',
    verified: 'verified',
    reviewed: 'reviewedLegacy',
  };
  const key = statusKey[canonicalStatus];
  return key ? t(key) : getStatusLabel(status);
}
