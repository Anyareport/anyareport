import Report from '../models/Report.js';
import User from '../models/User.js';
import AuditLog from '../models/AuditLog.js';
import Category from '../models/Category.js';
import { classifyReport } from '../services/gemini.js';
import { notifyOnVerification } from '../services/notifications.js';
import { antiAbuseConfig } from '../config/antiAbuse.js';
import {
  scopeToCommittee,
  assertCommitteeAccess,
  canUpdateStatus,
  canVerifyReports,
} from '../middleware/rbac.js';
import fs from 'fs';
import path from 'path';

// Resolves a Firebase UID to the user's display name, falling back to the UID
// so statusHistory doesn't become an empty string.
async function resolveActorName(uid) {
  const user = await User.findOne({ firebaseUid: uid }).select('name').lean();
  return user?.name || uid;
}
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function getCommitteeForCategory(categoryName) {
  const cat = await Category.findOne({ name: categoryName });
  return cat?.committee || null;
}

async function logAudit(action, req, reportId, metadata = {}) {
  await AuditLog.create({
    action,
    actorUid: req.firebaseUser?.uid || null,
    reportId,
    ip: req.ip || req.headers['x-forwarded-for'] || null,
    userAgent: req.headers['user-agent'] || null,
    metadata,
  });
}

export async function createReport(req, res) {
  try {
    if (req.userProfile?.status === 'suspended') {
      return res.status(403).json({ error: 'Account suspended — cannot submit reports' });
    }

    const reportCount = await Report.countDocuments({
      submittedBy: req.firebaseUser.uid,
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    });

    if (reportCount >= antiAbuseConfig.maxReportsPerDay) {
      return res.status(429).json({
        error: `Daily report limit reached (${antiAbuseConfig.maxReportsPerDay} per day)`,
      });
    }

    const { category, subcategory, description, latitude, longitude, address, severity } = req.body;

    if (!category || !description || !latitude || !longitude) {
      return res.status(400).json({ error: 'Category, description, and location are required' });
    }

    const committee = await getCommitteeForCategory(category);
    const photos = req.files?.map((f) => `/uploads/${f.filename}`) || [];

    let aiSuggestedCategory = null;
    if (req.files?.length > 0) {
      const filePath = req.files[0].path;
      const imageBuffer = fs.readFileSync(filePath);
      const result = await classifyReport(description, imageBuffer, req.files[0].mimetype);
      aiSuggestedCategory = result.category;
    } else {
      const result = await classifyReport(description, null, null);
      aiSuggestedCategory = result.category;
    }

    const report = await Report.create({
      submittedBy: req.firebaseUser.uid,
      category,
      subcategory: subcategory || null,
      severity: severity || null,
      committee,
      description,
      photos,
      location: {
        type: 'Point',
        coordinates: [parseFloat(longitude), parseFloat(latitude)],
        address: address || '',
      },
      aiSuggestedCategory,
      statusHistory: [
        {
          status: 'pending',
          updatedBy: await resolveActorName(req.firebaseUser.uid),
        },
      ],
    });

    await logAudit('report_submitted', req, report._id, {
      category,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.status(201).json(report);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function getMyReports(req, res) {
  try {
    const reports = await Report.find({
      submittedBy: req.firebaseUser.uid,
    }).sort({ createdAt: -1 });
    res.json(reports);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function getReports(req, res) {
  try {
    let query = {};
    query = scopeToCommittee(query, req.userRole, req.userCommittee);

    if (req.query.status) query.status = req.query.status;

    const reports = await Report.find(query).sort({ createdAt: -1 }).limit(200);

    // Resolve submitter names in bulk
    const uids = [...new Set(reports.map((r) => r.submittedBy))];
    const users = await User.find({ firebaseUid: { $in: uids } })
      .select('firebaseUid name')
      .lean();
    const nameMap = Object.fromEntries(users.map((u) => [u.firebaseUid, u.name]));

    const result = reports.map((r) => ({
      ...r.toObject(),
      submitterName: nameMap[r.submittedBy] || null,
    }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function getReportById(req, res) {
  try {
    const report = await Report.findById(req.params.id);
    if (!report) return res.status(404).json({ error: 'Report not found' });

    if (req.userRole === 'resident' && report.submittedBy !== req.firebaseUser.uid) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (!assertCommitteeAccess(req, report.committee)) {
      return res.status(403).json({ error: 'Access denied — committee scope' });
    }

    const submitter = await User.findOne({ firebaseUid: report.submittedBy }).select('name').lean();
    const result = { ...report.toObject(), submitterName: submitter?.name || null };

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function verifyReport(req, res) {
  try {
    if (!canVerifyReports(req.userRole)) {
      return res.status(403).json({ error: 'Only Secretary can verify reports' });
    }

    const report = await Report.findById(req.params.id);
    if (!report) return res.status(404).json({ error: 'Report not found' });
    if (report.status !== 'pending') {
      return res.status(400).json({ error: 'Report is not pending verification' });
    }

    report.status = 'verified';
    report.verifiedBy = req.firebaseUser.uid;
    report.statusHistory.push({
      status: 'verified',
      updatedBy: await resolveActorName(req.firebaseUser.uid),
    });
    await report.save();

    await notifyOnVerification(report);
    await logAudit('report_verified', req, report._id);

    res.json(report);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function flagReport(req, res) {
  try {
    if (!canVerifyReports(req.userRole)) {
      return res.status(403).json({ error: 'Only Secretary can flag reports' });
    }

    const report = await Report.findById(req.params.id);
    if (!report) return res.status(404).json({ error: 'Report not found' });

    report.status = 'flagged';
    report.statusHistory.push({
      status: 'flagged',
      updatedBy: await resolveActorName(req.firebaseUser.uid),
    });
    await report.save();

    const submitter = await User.findOne({ firebaseUid: report.submittedBy });
    if (submitter) {
      submitter.flaggedReportCount += 1;
      if (submitter.flaggedReportCount >= antiAbuseConfig.flaggedReportThreshold) {
        submitter.status = 'suspended';
      }
      await submitter.save();
    }

    await logAudit('report_flagged', req, report._id, {
      submitterUid: report.submittedBy,
    });

    res.json(report);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function updateReportStatus(req, res) {
  try {
    const { status } = req.body;
    const validStatuses = ['en_route', 'on_scene', 'resolved'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const report = await Report.findById(req.params.id);
    if (!report) return res.status(404).json({ error: 'Report not found' });

    if (!assertCommitteeAccess(req, report.committee)) {
      return res.status(403).json({ error: 'Access denied — committee scope' });
    }

    const isResponder = ['tanod', 'responder'].includes(req.userRole);
    const isOfficial = canUpdateStatus(req.userRole);

    if (!isOfficial && !isResponder) {
      return res.status(403).json({ error: 'Insufficient permissions to update status' });
    }

    if (['captain', 'admin'].includes(req.userRole)) {
      return res.status(403).json({ error: 'Oversight only — cannot directly update status' });
    }

    report.status = status;
    report.statusHistory.push({
      status,
      updatedBy: await resolveActorName(req.firebaseUser.uid),
    });
    await report.save();

    await logAudit('status_updated', req, report._id, { status });
    res.json(report);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function acknowledgeReport(req, res) {
  try {
    const report = await Report.findById(req.params.id);
    if (!report) return res.status(404).json({ error: 'Report not found' });

    report.acknowledgedBy = req.firebaseUser.uid;
    if (report.status === 'verified') {
      report.status = 'en_route';
      report.statusHistory.push({
        status: 'en_route',
        updatedBy: await resolveActorName(req.firebaseUser.uid),
      });
    }
    await report.save();

    await logAudit('report_acknowledged', req, report._id);
    res.json(report);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function getCategories(req, res) {
  try {
    const categories = await Category.find().sort({ name: 1 });
    res.json(categories);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function getAnalytics(req, res) {
  try {
    let match = {};
    if (req.userRole === 'kagawad' && req.userCommittee) {
      match.committee = req.userCommittee;
    }

    const byCategory = await Report.aggregate([
      { $match: match },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    const byStatus = await Report.aggregate([
      { $match: match },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    const total = await Report.countDocuments(match);
    const resolved = await Report.countDocuments({
      ...match,
      status: 'resolved',
    });
    const pending = await Report.countDocuments({
      ...match,
      status: 'pending',
    });

    const last30Days = await Report.aggregate([
      {
        $match: {
          ...match,
          createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.json({
      total,
      resolved,
      pending,
      resolutionRate: total > 0 ? Math.round((resolved / total) * 100) : 0,
      byCategory,
      byStatus,
      last30Days,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function getHeatmapData(req, res) {
  try {
    let match = { 'location.coordinates': { $exists: true } };
    if (req.userRole === 'kagawad' && req.userCommittee) {
      match.committee = req.userCommittee;
    }

    const points = await Report.find(match).select('location category status createdAt');
    res.json(
      points.map((p) => ({
        lat: p.location.coordinates[1],
        lng: p.location.coordinates[0],
        category: p.category,
        status: p.status,
      }))
    );
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function classifyReportHandler(req, res) {
  try {
    const description = req.body.description || '';
    let imageBuffer = null;
    let mimeType = null;

    if (req.file) {
      imageBuffer = fs.readFileSync(req.file.path);
      mimeType = req.file.mimetype;
    }

    const result = await classifyReport(description, imageBuffer, mimeType);

    if (result.error === 'classification_unavailable') {
      return res.status(503).json({ error: 'classification_unavailable' });
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
