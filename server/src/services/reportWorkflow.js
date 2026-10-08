export const FIELD_REPORT_CATEGORIES = ['Public Concerns', 'Emergency Situations'];
export const BLOTTER_REPORT_CATEGORY = 'Blotter Cases';
export const CRIMINAL_BLOTTER_SUBCATEGORY = 'Criminal';

const RESPONDER_ROLES = ['tanod', 'responder'];

export function validateResolutionDetails(details) {
  const requiredText = ['summary', 'actionsTaken', 'outcome'];
  if (requiredText.some((field) => typeof details[field] !== 'string' || !details[field].trim())) {
    return 'Resolution summary, actions taken, and outcome are required';
  }
  if (typeof details.furtherActionRequired !== 'boolean') {
    return 'Further action required must be Yes or No';
  }
  if (
    details.furtherActionRequired &&
    (typeof details.furtherActionRecommendation !== 'string' ||
      !details.furtherActionRecommendation.trim())
  ) {
    return 'Further action or recommendation is required when Yes is selected';
  }
  if (typeof details.assistanceRequested !== 'boolean') {
    return 'Assistance requested must be specified';
  }
  return null;
}

export function canSubmitResolution(actorUid, assignedResponderUid) {
  return Boolean(actorUid && assignedResponderUid && actorUid === assignedResponderUid);
}

export function supportsBackupRequests(category, subcategory) {
  return (
    FIELD_REPORT_CATEGORIES.includes(category) ||
    (category === BLOTTER_REPORT_CATEGORY && subcategory === CRIMINAL_BLOTTER_SUBCATEGORY)
  );
}

function responderCategoryFilter(category) {
  return category === BLOTTER_REPORT_CATEGORY
    ? { category: BLOTTER_REPORT_CATEGORY, subcategory: CRIMINAL_BLOTTER_SUBCATEGORY }
    : { category: { $in: FIELD_REPORT_CATEGORIES } };
}

export function normalizeReportStatus(status) {
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

export function normalizeHistoryStatus(status) {
  if (status === 'acknowledged') return 'coordinating';
  if (status === 'en_route' || status === 'on_scene') return 'in_progress';
  if (status === 'verified') return 'reviewed';
  return status;
}

export function serializeReport(report) {
  const data = typeof report.toObject === 'function' ? report.toObject() : { ...report };
  return {
    ...data,
    workflowStatus: data.status,
    status: normalizeReportStatus(data.status),
    statusHistory: (data.statusHistory || []).map((entry) => ({
      ...entry,
      status: normalizeHistoryStatus(entry.status),
    })),
  };
}

export function statusFilterValues(status) {
  switch (status) {
    case 'pending':
      return ['pending', 'verified'];
    case 'coordinating':
      return ['coordinating', 'acknowledged'];
    case 'in_progress':
      return ['in_progress', 'en_route', 'on_scene'];
    default:
      return [status];
  }
}

function isResponderParticipant(report, uid) {
  return (
    report.acknowledgedBy === uid ||
    (report.backupRequests || []).some((request) => (request.joinedBy || []).includes(uid))
  );
}

export function canResponderViewReport(report, uid = null) {
  const isResolvedCivilBlotter =
    report.category === BLOTTER_REPORT_CATEGORY &&
    report.subcategory === 'Civil' &&
    normalizeReportStatus(report.status) === 'resolved';

  if (isResolvedCivilBlotter) return false;

  return (
    FIELD_REPORT_CATEGORIES.includes(report.category) ||
    (report.category === BLOTTER_REPORT_CATEGORY &&
      (report.subcategory === CRIMINAL_BLOTTER_SUBCATEGORY ||
        (report.subcategory === 'Civil' && uid && isResponderParticipant(report, uid))))
  );
}

export function canViewReporter(role, report, uid) {
  if (role === 'resident') return report.submittedBy === uid;
  if (RESPONDER_ROLES.includes(role)) return isResponderParticipant(report, uid);
  return ['admin', 'captain', 'secretary'].includes(role);
}

export function canViewReporterContact(role, report, uid) {
  if (['admin', 'captain'].includes(role)) return false;
  return canViewReporter(role, report, uid);
}

function reject(statusCode, error) {
  return { allowed: false, statusCode, error };
}

export function getTransitionDecision({
  category,
  subcategory,
  role,
  fromStatus,
  toStatus,
  actorUid,
  ownerUid,
  helperUids = [],
}) {
  const currentStatus = normalizeReportStatus(fromStatus);
  const isResponder = RESPONDER_ROLES.includes(role);

  if (
    FIELD_REPORT_CATEGORIES.includes(category) ||
    (category === BLOTTER_REPORT_CATEGORY &&
      subcategory === CRIMINAL_BLOTTER_SUBCATEGORY &&
      isResponder)
  ) {
    if (toStatus === 'coordinating') {
      if (!isResponder)
        return reject(403, 'Only tanods or responders can coordinate field reports');
      if (currentStatus !== 'pending') {
        return reject(409, 'Only pending reports can be acknowledged');
      }
      return {
        allowed: true,
        filter: {
          ...responderCategoryFilter(category),
          status: { $in: ['pending', 'verified'] },
          acknowledgedBy: null,
        },
        update: {
          status: 'coordinating',
          acknowledgedBy: actorUid,
        },
        action: 'report_acknowledged',
      };
    }

    if (toStatus === 'in_progress') {
      if (!isResponder || actorUid !== ownerUid) {
        return reject(403, 'Only the lead responder can start field work');
      }
      if (currentStatus !== 'coordinating') {
        return reject(409, 'A field report must be coordinating before work starts');
      }
      return {
        allowed: true,
        filter: {
          ...responderCategoryFilter(category),
          status: { $in: ['coordinating', 'acknowledged'] },
          acknowledgedBy: actorUid,
        },
        update: { status: 'in_progress' },
        action: 'status_updated',
      };
    }

    if (toStatus === 'resolved') {
      if (!isResponder || (actorUid !== ownerUid && !helperUids.includes(actorUid))) {
        return reject(403, 'Only a responder on this incident can resolve it');
      }
      if (currentStatus !== 'in_progress') {
        return reject(409, 'A field report can only be resolved from In Progress');
      }
      return {
        allowed: true,
        filter: {
          ...responderCategoryFilter(category),
          status: { $in: ['in_progress', 'en_route', 'on_scene'] },
          $or: [{ acknowledgedBy: actorUid }, { 'backupRequests.joinedBy': actorUid }],
        },
        update: { status: 'resolved' },
        action: 'status_updated',
      };
    }

    return reject(400, 'Unsupported field-report transition');
  }

  if (category === BLOTTER_REPORT_CATEGORY) {
    if (toStatus === 'in_progress') {
      if (!['captain', 'secretary'].includes(role)) {
        return reject(403, 'Only the Captain or Secretary can start blotter processing');
      }
      if (!['pending', 'coordinating'].includes(currentStatus)) {
        return reject(409, 'Only pending or dispatched blotter cases can begin processing');
      }
      return {
        allowed: true,
        filter: {
          category: BLOTTER_REPORT_CATEGORY,
          status: { $in: ['pending', 'verified', 'coordinating'] },
        },
        update: { status: 'in_progress' },
        action: 'status_updated',
      };
    }

    if (toStatus === 'resolved') {
      if (!['captain', 'secretary'].includes(role)) {
        return reject(403, 'Only the Captain or Secretary can resolve blotter cases');
      }
      if (currentStatus !== 'in_progress') {
        return reject(409, 'A blotter case can only be resolved from In Progress');
      }
      return {
        allowed: true,
        filter: {
          category: BLOTTER_REPORT_CATEGORY,
          status: { $in: ['in_progress', 'en_route', 'on_scene'] },
        },
        update: { status: 'resolved' },
        action: 'status_updated',
      };
    }

    return reject(400, 'Unsupported blotter transition');
  }

  return reject(404, 'Unknown report category');
}

export function getJoinDecision({
  category,
  subcategory,
  status,
  ownerUid,
  actorUid,
  backupRequests = [],
}) {
  if (!supportsBackupRequests(category, subcategory)) {
    return reject(404, 'Report not found');
  }
  if (!ownerUid || ownerUid === actorUid) {
    return reject(409, 'This incident has no open backup request for you');
  }

  const alreadyJoined = backupRequests.some((request) =>
    (request.joinedBy || []).includes(actorUid)
  );
  if (alreadyJoined) return { allowed: true, alreadyJoined: true };
  if (normalizeReportStatus(status) === 'resolved') {
    return reject(409, 'Resolved incidents cannot accept backup responders');
  }

  const hasOpenRequest = backupRequests.some(
    (request) => request.requestedBy === ownerUid && request.status === 'pending'
  );
  if (!hasOpenRequest) return reject(409, 'This incident has no open backup request');

  return {
    allowed: true,
    alreadyJoined: false,
    filter: {
      ...responderCategoryFilter(category),
      status: { $ne: 'resolved' },
      acknowledgedBy: ownerUid,
      backupRequests: {
        $elemMatch: {
          requestedBy: ownerUid,
          status: 'pending',
          joinedBy: { $ne: actorUid },
        },
      },
    },
  };
}
