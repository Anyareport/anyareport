import mongoose from 'mongoose';
import Report from '../models/Report.js';
import User from '../models/User.js';
import AuditLog from '../models/AuditLog.js';
import Category from '../models/Category.js';
import { classifyReport } from '../services/gemini.js';
import {
  notifyBackupJoined,
  notifyBackupRequest,
  notifyOnStatusUpdate,
  notifyOnVerification,
} from '../services/notifications.js';
import { antiAbuseConfig } from '../config/antiAbuse.js';
import { uploadImage } from '../services/cloudinary.js';
import { canUpdateStatus, canVerifyReports } from '../middleware/rbac.js';

const RESPONDER_CATEGORIES = ['Emergency Situations', 'Public Concerns'];
const BLOTTER_CATEGORY = 'Blotter Cases';

// Resolves a Firebase UID to the user's display name, falling back to the UID
// so statusHistory doesn't become an empty string.
async function resolveActorName(uid) {
  const user = await User.findOne({ firebaseUid: uid }).select('name').lean();
  return user?.name || uid;
}

async function logAudit(action, req, reportId, metadata = {}, session = null) {
  const record = {
    action,
    actorUid: req.firebaseUser?.uid || null,
    reportId,
    ip: req.ip || req.headers['x-forwarded-for'] || null,
    userAgent: req.headers['user-agent'] || null,
    metadata,
  };

  if (session) {
    await AuditLog.create([record], { session });
    return;
  }

  await AuditLog.create(record);
}

async function updateWithAudit(action, req, reportId, metadata, update) {
  const session = await mongoose.startSession();
  let result = null;

  try {
    await session.withTransaction(async () => {
      result = await update(session);
      if (result) await logAudit(action, req, reportId, metadata, session);
    });
    return result;
  } finally {
    await session.endSession();
  }
}

async function notifyBestEffort(notification, context) {
  try {
    await notification;
  } catch (error) {
    console.error(`[${context}] Notification failed:`, error.message);
  }
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

    if (['tanod', 'responder'].includes(req.userRole)) {
      query.category = { $in: RESPONDER_CATEGORIES };
    }

    if (req.query.status) query.status = req.query.status;
    if (req.query.handledByMe === 'true' && ['tanod', 'responder'].includes(req.userRole)) {
      query.$or = [
        { acknowledgedBy: req.firebaseUser.uid },
        { 'backupRequests.joinedBy': req.firebaseUser.uid },
      ];
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

    if (
      ['tanod', 'responder'].includes(req.userRole) &&
      !RESPONDER_CATEGORIES.includes(report.category)
    ) {
      return res.status(404).json({ error: 'Report not found' });
    }

    if (req.userRole === 'resident' && report.submittedBy !== req.firebaseUser.uid) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const reportData = report.toObject();
    const participantUids = [
      report.submittedBy,
      report.acknowledgedBy,
      ...report.backupRequests.flatMap((request) => request.joinedBy || []),
    ].filter(Boolean);
    const users = await User.find({ firebaseUid: { $in: participantUids } })
      .select('firebaseUid name')
      .lean();
    const nameByUid = Object.fromEntries(users.map((user) => [user.firebaseUid, user.name]));
    const result = {
      ...reportData,
      submitterName: nameByUid[report.submittedBy] || null,
      acknowledgedByName: report.acknowledgedBy ? nameByUid[report.acknowledgedBy] || null : null,
      backupRequests: reportData.backupRequests.map((request) => ({
        ...request,
        joinedBy: request.joinedBy || [],
        joinedByNames: (request.joinedBy || []).map((uid) => nameByUid[uid] || uid),
      })),
    };

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
    const validStatuses = ['in_progress', 'resolved'];
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

    if (['captain', 'secretary'].includes(req.userRole) && status !== 'resolved') {
      return res.status(403).json({ error: 'Captain and Secretary can only resolve incidents' });
    }

    if (req.userRole === 'admin') {
      return res.status(403).json({ error: 'Oversight only — cannot directly update status' });
    }

    if (isResponder && !RESPONDER_CATEGORIES.includes(report.category)) {
      return res.status(404).json({ error: 'Report not found' });
    }

    if (req.userRole === 'secretary' && report.category !== BLOTTER_CATEGORY) {
      return res.status(403).json({ error: 'Secretary can only resolve blotter cases' });
    }

    const actorUid = req.firebaseUser.uid;
    const isOwner = report.acknowledgedBy === actorUid;
    const isBackupResponder = report.backupRequests.some((request) =>
      (request.joinedBy || []).includes(actorUid)
    );

    if (isResponder && !isOwner && !isBackupResponder) {
      return res.status(403).json({ error: 'Only incident participants can update this status' });
    }

    if (isResponder && status === 'in_progress' && !isOwner) {
      return res.status(403).json({ error: 'Only the incident owner can mark it in progress' });
    }

    if (isResponder && status === 'in_progress' && report.status !== 'acknowledged') {
      return res.status(409).json({ error: 'Acknowledge the incident before starting work' });
    }

    if (
      isResponder &&
      status === 'resolved' &&
      !['in_progress', 'en_route', 'on_scene'].includes(report.status)
    ) {
      return res.status(409).json({ error: 'Mark the incident in progress before resolving it' });
    }

    if (report.status === 'resolved') {
      return res.status(409).json({ error: 'Incident is already resolved' });
    }

    const updatedBy = await resolveActorName(actorUid);
    const updateFilter = {
      _id: report._id,
      status:
        isResponder && status === 'in_progress'
          ? 'acknowledged'
          : isResponder
            ? { $in: ['in_progress', 'en_route', 'on_scene'] }
            : { $ne: 'resolved' },
    };

    if (isResponder) {
      updateFilter.category = { $in: RESPONDER_CATEGORIES };
      if (status === 'in_progress') {
        updateFilter.acknowledgedBy = actorUid;
      } else {
        updateFilter.$or = [{ acknowledgedBy: actorUid }, { 'backupRequests.joinedBy': actorUid }];
      }
    } else if (req.userRole === 'secretary') {
      updateFilter.category = BLOTTER_CATEGORY;
    }

    const update = {
      $set: { status },
      $push: { statusHistory: { status, updatedBy } },
    };
    const options = { new: true };

    const hasOpenBackupRequest = report.backupRequests.some(
      (request) => request.status === 'pending'
    );

    if (status === 'resolved' && hasOpenBackupRequest) {
      const closedAt = new Date();
      update.$set['backupRequests.$[request].status'] = 'closed';
      update.$set['backupRequests.$[request].closedBy'] = actorUid;
      update.$set['backupRequests.$[request].closedAt'] = closedAt;
      update.$set['backupRequests.$[request].closeReason'] = 'resolved';
      options.arrayFilters = [{ 'request.status': 'pending' }];
    }

    const updatedReport = await updateWithAudit(
      'status_updated',
      req,
      report._id,
      { status },
      (session) => Report.findOneAndUpdate(updateFilter, update, { ...options, session })
    );

    if (!updatedReport) {
      return res.status(409).json({ error: 'Incident status changed before your update' });
    }

    await notifyBestEffort(notifyOnStatusUpdate(updatedReport, status, updatedBy), 'Status update');
    res.json(updatedReport);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function acknowledgeReport(req, res) {
  try {
    if (!['tanod', 'responder'].includes(req.userRole)) {
      return res.status(403).json({ error: 'Only responders can acknowledge incidents' });
    }

    const report = await Report.findById(req.params.id);
    if (!report) return res.status(404).json({ error: 'Report not found' });

    if (!RESPONDER_CATEGORIES.includes(report.category)) {
      return res.status(404).json({ error: 'Report not found' });
    }

    if (report.acknowledgedBy && report.acknowledgedBy !== req.firebaseUser.uid) {
      return res.status(409).json({ error: 'Incident is already reserved by another responder' });
    }

    if (report.acknowledgedBy === req.firebaseUser.uid) {
      return res.json(report);
    }

    if (!['pending', 'verified'].includes(report.status)) {
      return res.status(409).json({ error: 'This incident can no longer be acknowledged' });
    }

    const updatedBy = await resolveActorName(req.firebaseUser.uid);
    const acknowledgedReport = await updateWithAudit(
      'report_acknowledged',
      req,
      report._id,
      {},
      (session) =>
        Report.findOneAndUpdate(
          {
            _id: report._id,
            category: { $in: RESPONDER_CATEGORIES },
            acknowledgedBy: null,
            status: { $in: ['pending', 'verified'] },
          },
          {
            $set: { acknowledgedBy: req.firebaseUser.uid, status: 'acknowledged' },
            $push: { statusHistory: { status: 'acknowledged', updatedBy } },
          },
          { new: true, session }
        )
    );

    if (!acknowledgedReport) {
      const latestReport = await Report.findById(report._id);
      if (latestReport?.acknowledgedBy === req.firebaseUser.uid) {
        return res.json(latestReport);
      }
      return res.status(409).json({ error: 'Incident was just acknowledged by another responder' });
    }

    await notifyBestEffort(
      notifyOnStatusUpdate(acknowledgedReport, 'acknowledged', updatedBy),
      'Incident acknowledgement'
    );
    res.json(acknowledgedReport);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function requestBackup(req, res) {
  try {
    if (!['tanod', 'responder'].includes(req.userRole)) {
      return res.status(403).json({ error: 'Only responders can request backup' });
    }

    const report = await Report.findById(req.params.id);
    if (!report) return res.status(404).json({ error: 'Report not found' });
    if (!RESPONDER_CATEGORIES.includes(report.category)) {
      return res.status(404).json({ error: 'Report not found' });
    }
    if (report.acknowledgedBy !== req.firebaseUser.uid) {
      return res.status(403).json({ error: 'Only the assigned responder can request backup' });
    }
    if (report.status === 'resolved') {
      return res.status(409).json({ error: 'Resolved incidents cannot request backup' });
    }

    const openRequest = report.backupRequests.find(
      (request) => request.requestedBy === req.firebaseUser.uid && request.status === 'pending'
    );
    if (openRequest) {
      return res.json({ report: report.toObject(), alreadyRequested: true });
    }

    const updatedReport = await updateWithAudit(
      'backup_requested',
      req,
      report._id,
      {},
      (session) =>
        Report.findOneAndUpdate(
          {
            _id: report._id,
            category: { $in: RESPONDER_CATEGORIES },
            status: { $ne: 'resolved' },
            acknowledgedBy: req.firebaseUser.uid,
            backupRequests: { $not: { $elemMatch: { status: 'pending' } } },
          },
          { $push: { backupRequests: { requestedBy: req.firebaseUser.uid } } },
          { new: true, session }
        )
    );

    if (!updatedReport) {
      const latestReport = await Report.findById(report._id);
      const wasRequested = latestReport?.backupRequests.some(
        (request) => request.requestedBy === req.firebaseUser.uid && request.status === 'pending'
      );
      if (wasRequested) {
        return res.json({ report: latestReport, alreadyRequested: true });
      }
      return res
        .status(409)
        .json({ error: 'The incident changed before backup could be requested' });
    }

    const requesterName = await resolveActorName(req.firebaseUser.uid);
    await notifyBestEffort(notifyBackupRequest(updatedReport, requesterName), 'Backup request');
    res.json({ report: updatedReport, alreadyRequested: false });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function joinBackupRequest(req, res) {
  try {
    if (!['tanod', 'responder'].includes(req.userRole)) {
      return res.status(403).json({ error: 'Only responders can join a backup request' });
    }

    const report = await Report.findById(req.params.id);
    if (!report) return res.status(404).json({ error: 'Report not found' });
    if (!RESPONDER_CATEGORIES.includes(report.category)) {
      return res.status(404).json({ error: 'Report not found' });
    }
    if (!report.acknowledgedBy || report.acknowledgedBy === req.firebaseUser.uid) {
      return res.status(409).json({ error: 'This incident has no open backup request for you' });
    }
    const alreadyJoined = report.backupRequests.some((request) =>
      (request.joinedBy || []).includes(req.firebaseUser.uid)
    );
    if (alreadyJoined) {
      return res.json({ report: report.toObject(), alreadyJoined: true });
    }
    if (report.status === 'resolved') {
      return res.status(409).json({ error: 'Resolved incidents cannot accept backup responders' });
    }

    const ownerUid = report.acknowledgedBy;
    const updatedReport = await updateWithAudit(
      'backup_joined',
      req,
      report._id,
      { ownerUid },
      (session) =>
        Report.findOneAndUpdate(
          {
            _id: report._id,
            category: { $in: RESPONDER_CATEGORIES },
            status: { $ne: 'resolved' },
            acknowledgedBy: ownerUid,
            backupRequests: {
              $elemMatch: {
                requestedBy: ownerUid,
                status: 'pending',
                joinedBy: { $ne: req.firebaseUser.uid },
              },
            },
          },
          {
            $addToSet: { 'backupRequests.$[request].joinedBy': req.firebaseUser.uid },
          },
          {
            new: true,
            session,
            arrayFilters: [
              {
                'request.requestedBy': ownerUid,
                'request.status': 'pending',
                'request.joinedBy': { $ne: req.firebaseUser.uid },
              },
            ],
          }
        )
    );

    if (!updatedReport) {
      const latestReport = await Report.findById(report._id);
      const joinedDuringRequest = latestReport?.backupRequests.some((request) =>
        (request.joinedBy || []).includes(req.firebaseUser.uid)
      );
      if (joinedDuringRequest) {
        return res.json({ report: latestReport, alreadyJoined: true });
      }
      return res.status(409).json({ error: 'The backup request was closed or has changed' });
    }

    const helperName = await resolveActorName(req.firebaseUser.uid);
    await notifyBestEffort(notifyBackupJoined(updatedReport, helperName), 'Backup join');
    res.json({ report: updatedReport, alreadyJoined: false });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function closeBackupRequest(req, res) {
  try {
    if (!['tanod', 'responder'].includes(req.userRole)) {
      return res.status(403).json({ error: 'Only responders can close a backup request' });
    }

    const report = await Report.findById(req.params.id);
    if (!report) return res.status(404).json({ error: 'Report not found' });
    if (!RESPONDER_CATEGORIES.includes(report.category)) {
      return res.status(404).json({ error: 'Report not found' });
    }
    if (report.acknowledgedBy !== req.firebaseUser.uid) {
      return res
        .status(403)
        .json({ error: 'Only the incident owner can close the backup request' });
    }

    const isOpen = report.backupRequests.some(
      (request) => request.requestedBy === req.firebaseUser.uid && request.status === 'pending'
    );
    if (!isOpen) {
      return res.json({ report: report.toObject(), alreadyClosed: true });
    }

    const closedAt = new Date();
    const closedReport = await updateWithAudit(
      'backup_request_closed',
      req,
      report._id,
      { closeReason: 'enough_help' },
      (session) =>
        Report.findOneAndUpdate(
          {
            _id: report._id,
            category: { $in: RESPONDER_CATEGORIES },
            status: { $ne: 'resolved' },
            acknowledgedBy: req.firebaseUser.uid,
            backupRequests: {
              $elemMatch: { requestedBy: req.firebaseUser.uid, status: 'pending' },
            },
          },
          {
            $set: {
              'backupRequests.$[request].status': 'closed',
              'backupRequests.$[request].closedBy': req.firebaseUser.uid,
              'backupRequests.$[request].closedAt': closedAt,
              'backupRequests.$[request].closeReason': 'enough_help',
            },
          },
          {
            new: true,
            session,
            arrayFilters: [
              {
                'request.requestedBy': req.firebaseUser.uid,
                'request.status': 'pending',
              },
            ],
          }
        )
    );

    if (!closedReport) {
      const latestReport = await Report.findById(report._id);
      const stillOpen = latestReport?.backupRequests.some(
        (request) => request.requestedBy === req.firebaseUser.uid && request.status === 'pending'
      );
      if (!stillOpen && latestReport) {
        return res.json({ report: latestReport, alreadyClosed: true });
      }
      return res
        .status(409)
        .json({ error: 'The incident changed before the backup request closed' });
    }

    res.json({ report: closedReport, alreadyClosed: false });
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
