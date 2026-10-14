import mongoose from 'mongoose';
import AuditLog from '../models/AuditLog.js';
import Report from '../models/Report.js';
import User from '../models/User.js';
import { workflowConfig } from '../config/workflow.js';
import { statusFilterValues } from '../services/reportWorkflow.js';
import { exportToCSV, exportToPDF } from '../services/export.js';
import {
  getNotificationsForUser,
  markAllNotificationsRead,
  markNotificationGroupRead,
  markNotificationRead,
} from '../services/notifications.js';

const reportStatuses = [
  'pending',
  'coordinating',
  'in_progress',
  'resolved',
  'flagged',
  'acknowledged',
  'en_route',
  'on_scene',
  'verified',
];
const reportSeverities = ['Low', 'Medium', 'High', 'Critical'];

function getQueryString(req, key) {
  const value = req.query[key];
  if (value === undefined) return undefined;
  if (typeof value !== 'string') {
    const error = new Error(`Invalid ${key} filter`);
    error.statusCode = 400;
    throw error;
  }
  return value;
}

function getQueryDate(req, key) {
  const value = getQueryString(req, key);
  if (value === undefined) return undefined;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    const error = new Error(`Invalid ${key} filter`);
    error.statusCode = 400;
    throw error;
  }
  return date;
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getExportLocation(report) {
  const address = report.location?.address?.trim();
  if (!address) return 'Location unavailable';
  return address.replace(/,?\s*Don Mariano Marcos\s*$/i, '').trim() || 'Location unavailable';
}

function matchesExportSearch(report, submitterName, search) {
  const title = report.aiTitle?.trim();
  const description = report.description?.trim() || '';
  const incidentLabel = title || (description ? description.slice(0, 80).trimEnd() : '') ||
    report.subcategory || report.category;
  const searchableText = [
    report._id?.toString(),
    report.referenceNumber,
    submitterName,
    incidentLabel,
    report.category,
    report.subcategory,
    description,
    getExportLocation(report),
  ]
    .filter(Boolean)
    .join(' ')
    .toLocaleLowerCase();

  return search
    .toLocaleLowerCase()
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .every((term) => searchableText.includes(term));
}

export async function exportReports(req, res) {
  try {
    const format = getQueryString(req, 'format') || 'csv';
    if (!['csv', 'pdf'].includes(format)) {
      return res.status(400).json({ error: 'Format must be csv or pdf' });
    }

    const query = {};
    const conditions = [];
    const status = getQueryString(req, 'status');
    if (status && status !== 'all') {
      if (!reportStatuses.includes(status)) {
        return res.status(400).json({ error: 'Invalid status filter' });
      }
      conditions.push({ status: { $in: statusFilterValues(status) } });
    }

    const category = getQueryString(req, 'category');
    const subcategory = getQueryString(req, 'subcategory');
    const severity = getQueryString(req, 'severity');
    if (category) query.category = category;
    if (subcategory) query.subcategory = subcategory;
    if (severity) {
      if (!reportSeverities.includes(severity)) {
        return res.status(400).json({ error: 'Invalid severity filter' });
      }
      query.severity = severity;
    }

    const dateFrom = getQueryDate(req, 'dateFrom');
    const dateTo = getQueryDate(req, 'dateTo');
    if (dateFrom || dateTo) {
      query.createdAt = {
        ...(dateFrom ? { $gte: dateFrom } : {}),
        ...(dateTo ? { $lt: dateTo } : {}),
      };
    }

    const location = getQueryString(req, 'location');
    if (location === 'Location unavailable') {
      query.$or = [
        { 'location.address': { $exists: false } },
        { 'location.address': null },
        { 'location.address': '' },
        { 'location.address': { $regex: '^\\s*Don Mariano Marcos\\s*$', $options: 'i' } },
      ];
    } else if (location) {
      query['location.address'] = {
        $regex: `^${escapeRegex(location)}(?:,?\\s*Don Mariano Marcos)?$`,
        $options: 'i',
      };
    }

    const scope = getQueryString(req, 'scope');
    if (scope && !['open', 'inactive'].includes(scope)) {
      return res.status(400).json({ error: 'Invalid scope filter' });
    }
    if (scope) conditions.push({ status: { $nin: ['resolved', 'flagged'] } });

    const verification = getQueryString(req, 'verification');
    if (verification) {
      if (!['pending', 'verified'].includes(verification)) {
        return res.status(400).json({ error: 'Invalid verification filter' });
      }
      query['resolution.verificationStatus'] = verification;
    }

    const stale = getQueryString(req, 'stale');
    if (stale && stale !== 'true') {
      return res.status(400).json({ error: 'Invalid stale filter' });
    }
    if (stale === 'true') {
      query.updatedAt = { $lte: getQueryDate(req, 'staleBefore') || new Date(Date.now() - 7 * 86400000) };
      conditions.push({ status: { $ne: 'resolved' } });
    }

    const verifiedPeriod = getQueryString(req, 'verifiedPeriod');
    if (verifiedPeriod && verifiedPeriod !== 'week') {
      return res.status(400).json({ error: 'Invalid verified period filter' });
    }
    if (verifiedPeriod === 'week') {
      const verifiedAfter = getQueryDate(req, 'verifiedAfter');
      if (!verifiedAfter) return res.status(400).json({ error: 'Missing verifiedAfter filter' });
      query['resolution.verificationStatus'] = 'verified';
      query['resolution.verifiedAt'] = { $gte: verifiedAfter };
    }

    if (conditions.length) query.$and = conditions;

    let reports = await Report.find(query).sort({ createdAt: -1 }).lean();

    if (scope === 'inactive' && reports.length) {
      const reportIds = reports.map((report) => report._id);
      const lastActivities = await AuditLog.aggregate([
        { $match: { reportId: { $in: reportIds } } },
        { $sort: { timestamp: -1 } },
        { $group: { _id: '$reportId', lastActivityAt: { $first: '$timestamp' } } },
      ]);
      const lastActivityByReport = new Map(
        lastActivities.map((entry) => [String(entry._id), entry.lastActivityAt])
      );
      const cutoff = new Date(Date.now() - workflowConfig.captainInactivityHours * 3600000);
      reports = reports.filter(
        (report) =>
          (lastActivityByReport.get(String(report._id)) || report.createdAt) <= cutoff
      );
    }

    const search = getQueryString(req, 'search') || '';
    if (search.trim()) {
      const submitterUids = [...new Set(reports.map((report) => report.submittedBy).filter(Boolean))];
      const submitters = await User.find({ firebaseUid: { $in: submitterUids } })
        .select('firebaseUid name')
        .lean();
      const namesByUid = new Map(submitters.map((user) => [user.firebaseUid, user.name]));
      reports = reports.filter((report) =>
        matchesExportSearch(report, namesByUid.get(report.submittedBy), search)
      );
    }

    if (format === 'pdf') {
      const pdf = await exportToPDF(reports);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename=anyareport-export.pdf');
      return res.send(pdf);
    }

    const csv = await exportToCSV(reports);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=anyareport-export.csv');
    res.send(csv);
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
}

export async function getNotifications(req, res) {
  try {
    const limit = Number(req.query.limit ?? 20);
    if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
      return res.status(400).json({ error: 'Limit must be an integer between 1 and 50' });
    }

    const feed = await getNotificationsForUser(req.firebaseUser.uid, {
      cursor: req.query.cursor,
      limit,
    });
    res.json(feed);
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
}

export async function markRead(req, res) {
  try {
    const notif = await markNotificationRead(req.params.id, req.firebaseUser.uid);
    if (!notif) return res.status(404).json({ error: 'Notification not found' });
    res.json(notif);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function markGroupRead(req, res) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.reportId)) {
      return res.status(400).json({ error: 'Invalid report id' });
    }

    const result = await markNotificationGroupRead(req.params.reportId, req.firebaseUser.uid);
    res.json({ modifiedCount: result.modifiedCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function markAllRead(req, res) {
  try {
    const result = await markAllNotificationsRead(req.firebaseUser.uid);
    res.json({ modifiedCount: result.modifiedCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
