const guestReportIdsKey = 'anyareport:guest-report-ids';

export function getGuestReportIds(): string[] {
  try {
    const stored = JSON.parse(localStorage.getItem(guestReportIdsKey) || '[]');
    return Array.isArray(stored) ? stored.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

export function rememberGuestReport(id: string) {
  const ids = getGuestReportIds().filter((storedId) => storedId !== id);
  localStorage.setItem(guestReportIdsKey, JSON.stringify([...ids, id].slice(-50)));
}
