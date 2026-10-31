import Report from '../models/Report.js';
import User from '../models/User.js';

export class RespondersUnavailableError extends Error {
  constructor() {
    super('One or more selected responders are no longer available');
    this.name = 'RespondersUnavailableError';
  }
}

export async function lockAndCheckResponders({
  reportId,
  responderUids,
  session,
  userModel = User,
  reportModel = Report,
}) {
  const lockResult = await userModel.updateMany(
    {
      firebaseUid: { $in: responderUids },
      role: /^\s*(tanod|responder)\s*$/i,
      status: { $ne: 'suspended' },
    },
    { $inc: { dispatchLockVersion: 1 } },
    { session, timestamps: false }
  );
  if (lockResult.matchedCount !== responderUids.length) {
    throw new RespondersUnavailableError();
  }

  const activeReports = await reportModel
    .find({
      _id: { $ne: reportId },
      status: { $nin: ['resolved', 'flagged'] },
      $or: [
        { acknowledgedBy: { $in: responderUids } },
        { 'backupRequests.joinedBy': { $in: responderUids } },
        {
          dispatchInvites: {
            $elemMatch: {
              responderUid: { $in: responderUids },
              status: { $ne: 'declined' },
            },
          },
        },
      ],
    })
    .select('acknowledgedBy backupRequests dispatchInvites')
    .session(session)
    .lean();

  const assignedUids = new Set();
  activeReports.forEach((activeReport) => {
    if (activeReport.acknowledgedBy) assignedUids.add(activeReport.acknowledgedBy);
    (activeReport.backupRequests || []).forEach((request) =>
      (request.joinedBy || []).forEach((uid) => assignedUids.add(uid))
    );
    (activeReport.dispatchInvites || [])
      .filter((invite) => invite.status !== 'declined')
      .forEach((invite) => assignedUids.add(invite.responderUid));
  });

  if (responderUids.some((uid) => assignedUids.has(uid))) {
    throw new RespondersUnavailableError();
  }
}
