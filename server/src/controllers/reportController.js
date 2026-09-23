import Report from '../models/Report.js';
import User from '../models/User.js';
import AuditLog from '../models/AuditLog.js';
import Category from '../models/Category.js';
import { classifyReport } from '../services/gemini.js';
import { notifyOnStatusUpdate, notifyOnVerification } from '../services/notifications.js';
import { antiAbuseConfig } from '../config/antiAbuse.js';
import { uploadImage } from '../services/cloudinary.js';
import { canUpdateStatus, canVerifyReports } from '../middleware/rbac.js';

// Resolves a Firebase UID to the user's display name, falling back to the UID
// so statusHistory doesn't become an empty string.
async function resolveActorName(uid) {
  const user = await User.findOne({ firebaseUid: uid }).select('name').lean();
  return user?.name || uid;
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

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const reportCount = await Report.countDocuments({
      submittedBy: req.firebaseUser.uid,
      createdAt: { $gte: startOfDay },
    });

    if (reportCount >= antiAbuseConfig.maxReportsPerDay) {
      return res.status(429).json({
        error: `Daily report limit reached (${antiAbuseConfig.maxReportsPerDay} per day)`,
      });
    }

    const { category, subcategory, description, latitude, longitude, address, severity } = req.body;
    const trimmedDescription = (description || '').trim();
    const hasPhoto = Array.isArray(req.files) && req.files.length > 0;

    // Validate max 3 photos
    if (Array.isArray(req.files) && req.files.length > 3) {
      return res.status(400).json({ error: 'Maximum 3 photos allowed per report' });
    }

    if (!category || !latitude || !longitude) {
      return res.status(400).json({ error: 'Category and location are required' });
    }
    if (!hasPhoto && trimmedDescription.length < 10) {
      return res
        .status(400)
        .json({ error: 'Provide a description (min. 10 characters) or attach a photo' });
    }

    const uploadedPhotos = await Promise.all(
      (req.files || []).map((file) => uploadImage(file.buffer, file.mimetype))
    );
    const photos = uploadedPhotos.map((photo) => photo.secure_url);

    let aiSuggestedCategory = null;
    let aiSummary = null;
    try {
      const classificationResult = await classifyReport(trimmedDescription, req.files || null);
      if (!classificationResult.error) {
        aiSuggestedCategory = classificationResult.category;
        aiSummary = classificationResult.summary;
      }
    } catch (classifyErr) {
      console.error('[Report Creation] AI classification failed:', classifyErr.message);
    }

    const report = await Report.create({
      submittedBy: req.firebaseUser.uid,
      category,
      subcategory: subcategory || null,
      severity: severity || null,
      description: trimmedDescription,
      photos,
      location: {
        type: 'Point',
        coordinates: [parseFloat(longitude), parseFloat(latitude)],
        address: address || '',
      },
      aiSuggestedCategory,
      aiSummary,
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

    if (req.query.status) query.status = req.query.status;
    if (req.query.handledByMe === 'true' && ['tanod', 'responder'].includes(req.userRole)) {
      query.acknowledgedBy = req.firebaseUser.uid;
    }

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
    const updatedBy = await resolveActorName(req.firebaseUser.uid);
    report.statusHistory.push({ status: 'verified', updatedBy });
    await report.save();

    await notifyOnVerification(report);
    await notifyOnStatusUpdate(report, 'verified', updatedBy);
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
    const updatedBy = await resolveActorName(req.firebaseUser.uid);
    report.statusHistory.push({ status: 'flagged', updatedBy });
    await report.save();

    const submitter = await User.findOne({ firebaseUid: report.submittedBy });
    if (submitter) {
      submitter.flaggedReportCount += 1;
      if (submitter.flaggedReportCount >= antiAbuseConfig.flaggedReportThreshold) {
        submitter.status = 'suspended';
      }
      await submitter.save();
    }

    await notifyOnStatusUpdate(report, 'flagged', updatedBy);

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
    const validStatuses = ['en_route', 'on_scene', 'resolved', 'verified'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const report = await Report.findById(req.params.id);
    if (!report) return res.status(404).json({ error: 'Report not found' });

    const isResponder = ['tanod', 'responder'].includes(req.userRole);
    const isOfficial = canUpdateStatus(req.userRole);

    if (!isOfficial && !isResponder) {
      return res.status(403).json({ error: 'Insufficient permissions to update status' });
    }

    if (['captain', 'admin'].includes(req.userRole)) {
      return res.status(403).json({ error: 'Oversight only — cannot directly update status' });
    }

    const updatedBy = await resolveActorName(req.firebaseUser.uid);
    if (isResponder && !report.acknowledgedBy) {
      report.acknowledgedBy = req.firebaseUser.uid;
    }
    const statusChanged = report.status !== status;
    report.status = status;
    if (status === 'verified' && isResponder) {
      report.verifiedBy = req.firebaseUser.uid;
    }
    report.statusHistory.push({ status, updatedBy });
    await report.save();

    if (statusChanged) {
      await notifyOnStatusUpdate(report, status, updatedBy);
    }
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
    let statusChanged = false;
    let updatedBy;
    if (report.status === 'verified') {
      report.status = 'en_route';
      updatedBy = await resolveActorName(req.firebaseUser.uid);
      report.statusHistory.push({ status: 'en_route', updatedBy });
      statusChanged = true;
    }
    await report.save();

    if (statusChanged) {
      await notifyOnStatusUpdate(report, 'en_route', updatedBy);
    }
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
    const match = {};

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
    const resolved = await Report.countDocuments({ ...match, status: 'resolved' });
    const pending = await Report.countDocuments({ ...match, status: 'pending' });

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
    const match = { 'location.coordinates': { $exists: true } };

    const points = await Report.find(match).select('_id location category status createdAt');
    res.json(
      points.map((p) => ({
        id: p._id.toString(),
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

    // Handle multiple photos (max 3)
    let files = null;
    if (Array.isArray(req.files) && req.files.length > 0) {
      files = req.files;
    } else if (req.file) {
      files = [req.file];
    } else if (req.body.photo) {
      // Handle Base64 from client-side compression
      const photoData = req.body.photo;
      if (typeof photoData === 'string' && photoData.startsWith('data:')) {
        const base64Data = photoData.split(',')[1];
        const imageBuffer = Buffer.from(base64Data, 'base64');
        const mimeType = photoData.split(',')[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
        files = [{ buffer: imageBuffer, mimetype: mimeType }];
      }
    }

    const result = await classifyReport(description, files);

    if (result.error === 'classification_unavailable') {
      return res.status(503).json({ error: 'classification_unavailable' });
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
