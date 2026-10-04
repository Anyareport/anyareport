import type { Report } from './api';

const SHORT_CATEGORY_LABELS: Record<string, string> = {
  'Blotter Cases': 'Blotter',
  'Emergency Situations': 'Emergency',
  'Public Concerns': 'Public concern',
};

export function getIncidentLabel(report: Report) {
  const aiTitle = report.aiTitle?.trim();
  if (aiTitle) return aiTitle;

  const description = report.description.trim();
  if (description) {
    return description.length > 80 ? `${description.slice(0, 80).trimEnd()}…` : description;
  }

  return report.subcategory || report.category;
}

export function getIncidentMeta(report: Report) {
  const category = SHORT_CATEGORY_LABELS[report.category] || report.category;
  const categoryDetail = report.subcategory ? `${category} · ${report.subcategory}` : category;
  return [report.referenceNumber, categoryDetail].filter(Boolean).join(' · ');
}

export function getLocationLabel(report: Report) {
  const address = report.location?.address?.trim();
  if (!address) return 'Location unavailable';

  return address.replace(/,?\s*Don Mariano Marcos\s*$/i, '').trim() || 'Location unavailable';
}

export function formatRelativeDate(value: string) {
  const date = new Date(value);
  const daysAgo = Math.floor((Date.now() - date.getTime()) / 86_400_000);

  if (!Number.isFinite(daysAgo) || daysAgo < 0) return date.toLocaleDateString();
  if (daysAgo === 0) return 'Today';
  if (daysAgo === 1) return 'Yesterday';
  if (daysAgo < 30) return `${daysAgo} days ago`;
  return date.toLocaleDateString();
}
