const severityOrder = { Critical: 0, High: 1, Medium: 2, Low: 3 };
const statusOrder = {
  pending: 0,
  coordinating: 1,
  in_progress: 2,
  flagged: 4,
  resolved: 5,
};
const emergencyCategory = 'Emergency Situations';

function normalizeStatus(status) {
  if (status === 'acknowledged') return 'coordinating';
  if (status === 'en_route' || status === 'on_scene') return 'in_progress';
  if (status === 'verified') return 'pending';
  return status;
}

function getPriorityTier(report) {
  const status = normalizeStatus(report.status);
  if (status === 'flagged') return 3;
  if (status === 'resolved') return 2;
  if (report.category === emergencyCategory || report.severity === 'Critical') return 0;
  return 1;
}

function compareDateDescending(first, second) {
  return new Date(second).getTime() - new Date(first).getTime();
}

export function compareReportSubmittedAtDescending(first, second) {
  return (
    compareDateDescending(first.createdAt, second.createdAt) ||
    String(second._id).localeCompare(String(first._id))
  );
}

export function compareReportPriority(first, second) {
  const firstTier = getPriorityTier(first);
  const secondTier = getPriorityTier(second);
  if (firstTier !== secondTier) return firstTier - secondTier;

  let dateDifference = 0;
  if (firstTier <= 1) {
    const firstSeverity = severityOrder[first.severity] ?? 4;
    const secondSeverity = severityOrder[second.severity] ?? 4;
    if (firstSeverity !== secondSeverity) return firstSeverity - secondSeverity;

    const emergencyDifference =
      Number(second.category === emergencyCategory) - Number(first.category === emergencyCategory);
    if (emergencyDifference !== 0) return emergencyDifference;

    const firstStatus = normalizeStatus(first.status);
    const secondStatus = normalizeStatus(second.status);
    const statusDifference = (statusOrder[firstStatus] ?? 99) - (statusOrder[secondStatus] ?? 99);
    if (statusDifference !== 0) return statusDifference;

    dateDifference =
      new Date(first.createdAt).getTime() - new Date(second.createdAt).getTime();
  } else if (firstTier === 2) {
    dateDifference = compareDateDescending(
      first.resolution?.resolvedAt || first.createdAt,
      second.resolution?.resolvedAt || second.createdAt
    );
  } else {
    dateDifference = compareDateDescending(first.createdAt, second.createdAt);
  }

  if (dateDifference !== 0) return dateDifference;
  return String(first._id).localeCompare(String(second._id));
}
