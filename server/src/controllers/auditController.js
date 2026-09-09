import AuditLog from '../models/AuditLog.js';
import Report from '../models/Report.js';
import User from '../models/User.js';
import { getAuditScope } from '../middleware/rbac.js';

export async function getAuditLogs(req, res) {
  try {
    const scope = getAuditScope(req.userRole, req.userCommittee);

    if (scope.scope === 'none') {
      return res.status(403).json({ error: 'Access denied' });
    }

    let query = {};

    if (scope.scope === 'committee' && scope.committee) {
      const reportIds = await Report.find({ committee: scope.committee }).distinct('_id');
      query.reportId = { $in: reportIds };
    }

    const logs = await AuditLog.find(query).sort({ timestamp: -1 }).limit(100);

    const uids = [...new Set(logs.map((l) => l.actorUid).filter(Boolean))];
    const users = await User.find({ firebaseUid: { $in: uids } })
      .select('firebaseUid name')
      .lean();
    const nameMap = Object.fromEntries(users.map((u) => [u.firebaseUid, u.name]));

    const result = logs.map((l) => ({
      ...l.toObject(),
      actorName: l.actorUid ? nameMap[l.actorUid] || null : null,
    }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
