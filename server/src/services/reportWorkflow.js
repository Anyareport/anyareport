export const FIELD_REPORT_CATEGORIES = ['Public Concerns', 'Emergency Situations'];
export const BLOTTER_REPORT_CATEGORY = 'Blotter Cases';

const RESPONDER_ROLES = ['tanod', 'responder'];

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

export function canViewReporter(role, report, uid) {
  if (role === 'resident') return report.submittedBy === uid;
  if (RESPONDER_ROLES.includes(role)) {
    return (
      report.acknowledgedBy === uid ||
      (report.backupRequests || []).some((request) => (request.joinedBy || []).includes(uid))
    );
  }
  return role === 'secretary' && report.category === BLOTTER_REPORT_CATEGORY;
}

function reject(statusCode, error) {
  return { allowed: false, statusCode, error };
}

export function getTransitionDecision({
  category,
  role,
  fromStatus,
  toStatus,
  actorUid,
  ownerUid,
  helperUids = [],
}) {
  const currentStatus = normalizeReportStatus(fromStatus);
  const isResponder = RESPONDER_ROLES.includes(role);

  if (FIELD_REPORT_CATEGORIES.includes(category)) {
    if (toStatus === 'coordinating') {
      if (!isResponder)
        return reject(403, 'Only tanods or responders can coordinate field reports');
      if (currentStatus !== 'pending') {
        return reject(409, 'Only pending reports can be acknowledged');
      }
      return {
        allowed: true,
        filter: {
          category: { $in: FIELD_REPORT_CATEGORIES },
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
          category: { $in: FIELD_REPORT_CATEGORIES },
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
          category: { $in: FIELD_REPORT_CATEGORIES },
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
      if (currentStatus !== 'pending') {
        return reject(409, 'Only pending blotter cases can begin processing');
      }
      return {
        allowed: true,
        filter: {
          category: BLOTTER_REPORT_CATEGORY,
          status: { $in: ['pending', 'verified'] },
        },
        update: { status: 'in_progress' },
        action: 'status_updated',
      };
    }

    if (toStatus === 'resolved') {
      if (role !== 'secretary') {
        return reject(403, 'Only the Secretary can resolve blotter cases');
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

export function getJoinDecision({ category, status, ownerUid, actorUid, backupRequests = [] }) {
  if (!FIELD_REPORT_CATEGORIES.includes(category)) {
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
      category: { $in: FIELD_REPORT_CATEGORIES },
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
