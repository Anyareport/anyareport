import { Parser } from 'json2csv';
import AuditLog from '../models/AuditLog.js';
import Report from '../models/Report.js';
import User from '../models/User.js';
import { getAuditScope } from '../middleware/rbac.js';
import {
  buildAuditFilter,
  parseAuditLimit,
  parseAuditRole,
  restrictActorToUids,
} from '../services/auditQuery.js';

export async function getAuditLogs(req, res) {
  try {
    const scope = getAuditScope(req.userRole, req.userCommittee);

    if (scope.scope === 'none') {
      return res.status(403).json({ error: 'Access denied' });
    }

    let query = buildAuditFilter(req.query);

    // Filter by the role of the person who did it.
    const roleFilter = parseAuditRole(req.query.role);
    if (roleFilter) {
      const uids = await User.find({ role: roleFilter }).distinct('firebaseUid');
      query = restrictActorToUids(query, uids);
    }

    if (scope.scope === 'committee' && scope.committee) {
      const reportIds = await Report.find({ committee: scope.committee }).distinct('_id');
      query = { ...query, reportId: { $in: reportIds } };
    }

    const logs = await AuditLog.find(query)
      .sort({ timestamp: -1 })
      .limit(parseAuditLimit(req.query.limit));

    const uids = [...new Set(logs.map((l) => l.actorUid).filter(Boolean))];
    const reportIds = [...new Set(logs.map((log) => log.reportId?.toString()).filter(Boolean))];
    const users = await User.find({ firebaseUid: { $in: uids } })
      .select('firebaseUid name role')
      .lean();
    const reports = await Report.find({ _id: { $in: reportIds } })
      .select('_id referenceNumber')
      .lean();
    const nameMap = Object.fromEntries(users.map((u) => [u.firebaseUid, u.name]));
    const roleMap = Object.fromEntries(users.map((u) => [u.firebaseUid, u.role]));
    const referenceMap = Object.fromEntries(
      reports.map((report) => [report._id.toString(), report.referenceNumber || null])
    );

    const result = logs.map((l) => ({
      ...l.toObject(),
      actorName: l.actorUid ? nameMap[l.actorUid] || null : null,
      actorRole: l.actorUid ? roleMap[l.actorUid] || null : null,
      reportReferenceNumber: l.reportId ? referenceMap[l.reportId.toString()] || null : null,
    }));

    if (req.query.format === 'csv') {
      const parser = new Parser({
        fields: [
          'timestamp',
          'action',
          'actorName',
          'reportReferenceNumber',
          'reportId',
          'metadata',
          'ip',
          'userAgent',
        ],
      });
      const rows = result.map((entry) => ({
        ...entry,
        metadata: JSON.stringify(entry.metadata || {}),
      }));
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename=anyareport-audit.csv');
      return res.send(`\uFEFF${parser.parse(rows)}`);
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// Every action and user that appears in the log, for the filter dropdowns.
export async function getAuditFilterOptions(req, res) {
  try {
    if (getAuditScope(req.userRole, req.userCommittee).scope === 'none') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const [actions, actorUids] = await Promise.all([
      AuditLog.distinct('action'),
      AuditLog.distinct('actorUid'),
    ]);
    const uids = actorUids.filter(Boolean);
    const users = await User.find({ firebaseUid: { $in: uids } })
      .select('firebaseUid name')
      .lean();
    const nameByUid = Object.fromEntries(users.map((user) => [user.firebaseUid, user.name]));

    res.json({
      actions: actions.filter(Boolean).sort(),
      actors: uids
        .map((uid) => ({ uid, name: nameByUid[uid] || uid }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}