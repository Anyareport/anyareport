import { Parser } from 'json2csv';
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
    const reportIds = [...new Set(logs.map((log) => log.reportId?.toString()).filter(Boolean))];
    const users = await User.find({ firebaseUid: { $in: uids } })
      .select('firebaseUid name')
      .lean();
    const reports = await Report.find({ _id: { $in: reportIds } })
      .select('_id referenceNumber')
      .lean();
    const nameMap = Object.fromEntries(users.map((u) => [u.firebaseUid, u.name]));
    const referenceMap = Object.fromEntries(
      reports.map((report) => [report._id.toString(), report.referenceNumber || null])
    );

    const result = logs.map((l) => ({
      ...l.toObject(),
      actorName: l.actorUid ? nameMap[l.actorUid] || null : null,
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
