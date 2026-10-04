import type { Report } from './api';

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
  const categoryDetail = report.subcategory
    ? `${report.category} · ${report.subcategory}`
    : report.category;
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
