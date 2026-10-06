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

export function matchesIncidentSearch(report: Report, search: string) {
  const terms = search.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  if (!terms.length) return true;

  const searchableText = [
    report._id,
    report.referenceNumber,
    report.submittedBy,
    report.submitterName,
    getIncidentLabel(report),
    report.category,
    report.subcategory,
    report.description,
    getLocationLabel(report),
  ]
    .filter(Boolean)
    .join(' ')
    .toLocaleLowerCase();

  return terms.every((term) => searchableText.includes(term));
}

export function isIncidentInDateRange(
  report: Report,
  startTimestamp: number | null,
  endTimestamp: number | null
) {
  const createdTimestamp = new Date(report.createdAt).getTime();
  if (!Number.isFinite(createdTimestamp)) return false;

  return (
    (startTimestamp === null || createdTimestamp >= startTimestamp) &&
    (endTimestamp === null || createdTimestamp <= endTimestamp)
  );
}

export function isIncidentOnDate(report: Report, date: string) {
  if (!date) return true;

  const startTimestamp = new Date(`${date}T00:00:00`).getTime();
  const endTimestamp = new Date(`${date}T23:59:59.999`).getTime();
  return isIncidentInDateRange(report, startTimestamp, endTimestamp);
}

export function isIncidentInPeriod(report: Report, period: 'date' | 'month' | 'year', value: string) {
  if (!value) return true;

  const createdDate = new Date(report.createdAt);
  if (!Number.isFinite(createdDate.getTime())) return false;

  if (period === 'year') {
    return String(createdDate.getFullYear()) === value;
  }

  if (period === 'month') {
    const [year, month] = value.split('-').map(Number);
    return createdDate.getFullYear() === year && createdDate.getMonth() + 1 === month;
  }

  return isIncidentOnDate(report, value);
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
