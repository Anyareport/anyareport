import mongoose from 'mongoose';
import { Parser } from 'json2csv';
import Report from '../models/Report.js';
import User from '../models/User.js';
import AuditLog from '../models/AuditLog.js';
import Notification from '../models/Notification.js';
import Category from '../models/Category.js';
import { classifyReport } from '../services/gemini.js';
import {
  disconnectUserSockets,
  emitReportChanged,
  notifyBackupJoined,
  notifyBackupRequest,
  notifyOnNewReport,
  notifyOnStatusUpdate,
  notifyRespondersDispatched,
  notifyDispatchResponse,
} from '../services/notifications.js';
import { antiAbuseConfig } from '../config/antiAbuse.js';
import { workflowConfig } from '../config/workflow.js';
import { uploadImage } from '../services/cloudinary.js';
import { getNextReportReference } from '../services/reportReference.js';
import { canVerifyReports } from '../middleware/rbac.js';
import {
  BLOTTER_REPORT_CATEGORY,
  CRIMINAL_BLOTTER_SUBCATEGORY,
  canResponderViewReport,
  canSubmitResolution,
  FIELD_REPORT_CATEGORIES,
  canViewReporter,
  canViewReporterContact,
  getJoinDecision,
  isTerminalReportStatus,
  getTransitionDecision,
  normalizeHistoryStatus,
  normalizeReportStatus,
  serializeReport,
  statusFilterValues,
  supportsBackupRequests,
  validateResolutionDetails,
} from '../services/reportWorkflow.js';

const RESPONDER_CATEGORIES = FIELD_REPORT_CATEGORIES;
const BLOTTER_CATEGORY = BLOTTER_REPORT_CATEGORY;

function canDispatchReport(report) {
  return (
    FIELD_REPORT_CATEGORIES.includes(report.category) ||
    (report.category === BLOTTER_REPORT_CATEGORY &&
      ['Criminal', 'Civil'].includes(report.subcategory))
  );
}

function getDispatchValidationError(report, { requireLead = true } = {}) {
  if (!canDispatchReport(report)) {
    return { statusCode: 400, message: 'This incident type cannot be dispatched' };
  }

  const currentStatus = normalizeReportStatus(report.status);
  const isCivilBlotter =
    report.category === BLOTTER_REPORT_CATEGORY && report.subcategory === 'Civil';
  if (!['pending', 'in_progress'].includes(currentStatus)) {
    return {
      statusCode: 409,
      message: 'Only pending or in-progress incidents can be dispatched',
    };
  }
  if (isCivilBlotter && currentStatus === 'pending') {
    return {
      statusCode: 409,
      message: 'Civil blotter cases can only be dispatched after processing starts',
    };
  }
  if (currentStatus === 'pending' && report.acknowledgedBy) {
    return { statusCode: 409, message: 'Only unassigned pending incidents can be dispatched' };
  }
  if (requireLead && currentStatus === 'in_progress' && !report.acknowledgedBy) {
    return { statusCode: 409, message: 'In-progress incidents must have a lead responder' };
  }

  return null;
}

function isActiveDispatchInvite(invite) {
  return Boolean(invite?.responderUid) && invite.status !== 'declined';
}

function responderReportFilter(report) {
  return report.category === BLOTTER_CATEGORY
    ? { category: BLOTTER_CATEGORY, subcategory: CRIMINAL_BLOTTER_SUBCATEGORY }
    : { category: { $in: RESPONDER_CATEGORIES } };
}

export function buildReportQuery({ userRole, firebaseUserUid, status, handledByMe }) {
  const query = {};

  if (['tanod', 'responder'].includes(userRole)) {
    query.$and = [
      {
        $or: [
          { category: { $in: RESPONDER_CATEGORIES } },
          { category: BLOTTER_CATEGORY, subcategory: CRIMINAL_BLOTTER_SUBCATEGORY },
          {
            category: BLOTTER_CATEGORY,
            subcategory: 'Civil',
            status: { $ne: 'resolved' },
            $or: [
              { acknowledgedBy: firebaseUserUid },
              { 'backupRequests.joinedBy': firebaseUserUid },
            ],
          },
        ],
      },
    ];
  }

  if (status) query.status = { $in: statusFilterValues(status) };

  if (handledByMe === 'true' && ['tanod', 'responder'].includes(userRole)) {
    query.$and = query.$and || [];
    query.$and.push({
      $or: [{ acknowledgedBy: firebaseUserUid }, { 'backupRequests.joinedBy': firebaseUserUid }],
    });
  }

  return query;
}

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

async function logSystemAudit(action, reportId, metadata = {}) {
  await AuditLog.create({ action, actorUid: null, reportId, metadata });
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
    return await notification;
  } catch (error) {
    console.error(`[${context}] Notification failed:`, error.message);
    return null;
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
    if (Array.isArray(req.files) && req.files.length > 3) {
      return res.status(400).json({ error: 'Maximum 3 photos allowed per report' });
    }
    if (!category || !latitude || !longitude) {
      return res.status(400).json({ error: 'Category and location are required' });
    }
    if (!hasPhoto && trimmedDescription.length < 10) {
      return res.status(400).json({
        error: 'Provide a description (min. 10 characters) or attach a photo',
      });
    }

    const uploadedPhotos = await Promise.all(
      (req.files || []).map((file) => uploadImage(file.buffer, file.mimetype))
    );
    const photos = uploadedPhotos.map((photo) => photo.secure_url);
    let aiSuggestedCategory = null;
    let aiTitle = null;
    let aiSummary = null;
    try {
      const classificationResult = await classifyReport(trimmedDescription, req.files || null);
      if (!classificationResult.error) {
        aiSuggestedCategory = classificationResult.category;
        aiTitle = classificationResult.title;
        aiSummary = classificationResult.summary;
      }
    } catch (classifyErr) {
      console.error('[Report Creation] AI classification failed:', classifyErr.message);
    }

    const referenceNumber = await getNextReportReference();
    const report = await Report.create({
      submittedBy: req.firebaseUser.uid,
      referenceNumber,
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
      aiTitle,
      aiSuggestedCategory,
      aiSummary,
      status: 'pending',
      statusHistory: [
        { status: 'pending', updatedBy: await resolveActorName(req.firebaseUser.uid) },
      ],
    });
    await logAudit('report_submitted', req, report._id, { category });
    if (aiSuggestedCategory) {
      await logSystemAudit('report_classified', report._id, {
        suggestedCategory: aiSuggestedCategory,
      });
    }
    const notifications = await notifyBestEffort(notifyOnNewReport(report), 'Report intake');
    if (notifications?.length) {
      await logSystemAudit('report_recipients_notified', report._id, {
        recipientCount: notifications.length,
        recipientRoles: [
          ...new Set(notifications.map((notification) => notification.recipientRole)),
        ],
      });
    }
    emitReportChanged(report, 'created');
    res.status(201).json(serializeReport(report));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function getMyReports(req, res) {
  try {
    const reports = await Report.find({ submittedBy: req.firebaseUser.uid }).sort({
      createdAt: -1,
    });
    res.json(reports.map(serializeReport));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function getAvailableResponders(reportId) {
  const responders = await User.find({
    role: /^\s*(tanod|responder)\s*$/i,
    status: { $ne: 'suspended' },
  })
    .select('firebaseUid name role')
    .sort({ name: 1 })
    .lean();
  if (!responders.length) return [];

  const activeReports = await Report.find({
    _id: { $ne: reportId },
    status: { $nin: ['resolved', 'flagged'] },
    $or: [
      { acknowledgedBy: { $in: responders.map((responder) => responder.firebaseUid) } },
      { 'backupRequests.joinedBy': { $in: responders.map((responder) => responder.firebaseUid) } },
      {
        dispatchInvites: {
          $elemMatch: {
            responderUid: { $in: responders.map((responder) => responder.firebaseUid) },
            status: { $ne: 'declined' },
          },
        },
      },
    ],
  })
    .select('acknowledgedBy backupRequests dispatchInvites')
    .lean();
  const assigned = new Set();
  activeReports.forEach((activeReport) => {
    if (activeReport.acknowledgedBy) assigned.add(activeReport.acknowledgedBy);
    (activeReport.backupRequests || []).forEach((request) =>
      (request.joinedBy || []).forEach((uid) => assigned.add(uid))
    );
    (activeReport.dispatchInvites || [])
      .filter(isActiveDispatchInvite)
      .forEach((invite) => assigned.add(invite.responderUid));
  });
  return responders.filter((responder) => !assigned.has(responder.firebaseUid));
}

export async function getDispatchOptions(req, res) {
  try {
    const report = await Report.findById(req.params.id).select(
      '_id category subcategory status acknowledgedBy backupRequests dispatchInvites'
    );
    if (!report) return res.status(404).json({ error: 'Report not found' });
    const dispatchValidationError = getDispatchValidationError(report, { requireLead: false });
    if (dispatchValidationError) {
      return res
        .status(dispatchValidationError.statusCode)
        .json({ error: dispatchValidationError.message });
    }
    const assignedUids = new Set(
      [
        report.acknowledgedBy,
        ...(report.backupRequests || []).flatMap((request) => request.joinedBy || []),
        ...(report.dispatchInvites || [])
          .filter(isActiveDispatchInvite)
          .map((invite) => invite.responderUid),
      ].filter(Boolean)
    );
    res.json({
      responders: (await getAvailableResponders(report._id)).filter(
        (responder) => !assignedUids.has(responder.firebaseUid)
      ),
    });
  } catch (err) {
    console.error(`[Dispatch Options] Failed for report ${req.params.id}:`, err.message);
    res.status(500).json({ error: err.message });
  }
}

export async function dispatchReport(req, res) {
  try {
    const responderUids = [
      ...new Set(Array.isArray(req.body.responderUids) ? req.body.responderUids : []),
    ]
      .filter((uid) => typeof uid === 'string' && uid.trim())
      .map((uid) => uid.trim());
    if (!responderUids.length)
      return res.status(400).json({ error: 'Select at least one responder' });

    const report = await Report.findById(req.params.id);
    if (!report) return res.status(404).json({ error: 'Report not found' });
    const dispatchValidationError = getDispatchValidationError(report, { requireLead: false });
    if (dispatchValidationError) {
      return res
        .status(dispatchValidationError.statusCode)
        .json({ error: dispatchValidationError.message });
    }
    const currentStatus = normalizeReportStatus(report.status);

    const isAdditionalDispatch = currentStatus === 'in_progress';
    const isCivilBlotter =
      report.category === BLOTTER_REPORT_CATEGORY && report.subcategory === 'Civil';
    const hasLeadResponder = Boolean(report.acknowledgedBy);
    const available = await getAvailableResponders(report._id);
    const availableUids = new Set(available.map((responder) => responder.firebaseUid));
    if (responderUids.some((uid) => !availableUids.has(uid))) {
      return res
        .status(409)
        .json({ error: 'One or more selected responders are no longer available' });
    }

    const openBackupRequest = (report.backupRequests || []).find(
      (request) =>
        !isCivilBlotter &&
        request.status === 'pending' &&
        request.requestedBy === report.acknowledgedBy
    );
    const updatedReport = await updateWithAudit(
      'incident_dispatched',
      req,
      report._id,
      { responderUids, additionalDispatch: isAdditionalDispatch },
      (session) =>
        Report.findOneAndUpdate(
          isAdditionalDispatch
            ? {
                _id: report._id,
                status: { $in: ['in_progress', 'en_route', 'on_scene'] },
                ...(hasLeadResponder
                  ? { acknowledgedBy: report.acknowledgedBy }
                  : { acknowledgedBy: null }),
                ...(openBackupRequest ? { 'backupRequests._id': openBackupRequest._id } : {}),
              }
            : { _id: report._id, status: 'pending', acknowledgedBy: null },
          isAdditionalDispatch
            ? isCivilBlotter
              ? {
                  $addToSet: {
                    dispatchInvites: {
                      $each: responderUids.map((responderUid) => ({ responderUid })),
                    },
                  },
                }
              : !hasLeadResponder
                ? {
                    $set: { acknowledgedBy: responderUids[0] },
                    ...(responderUids.length > 1
                      ? {
                          $push: {
                            backupRequests: {
                              requestedBy: responderUids[0],
                              joinedBy: responderUids.slice(1),
                            },
                          },
                        }
                      : {}),
                  }
                : openBackupRequest
                  ? { $addToSet: { 'backupRequests.$.joinedBy': { $each: responderUids } } }
                  : {
                      $push: {
                        backupRequests: {
                          requestedBy: report.acknowledgedBy,
                          joinedBy: responderUids,
                        },
                      },
                    }
            : {
                $set: {
                  status: 'coordinating',
                  ...(isCivilBlotter ? {} : { acknowledgedBy: responderUids[0] }),
                },
                $push: {
                  statusHistory: { status: 'coordinating', updatedBy: req.firebaseUser.uid },
                  ...(responderUids.length > 1
                    ? {
                        backupRequests: {
                          requestedBy: req.firebaseUser.uid,
                          joinedBy: isCivilBlotter ? responderUids : responderUids.slice(1),
                        },
                      }
                    : {}),
                },
              },
          { new: true, session }
        )
    );
    if (!updatedReport) {
      return res.status(409).json({ error: 'The incident changed before dispatch completed' });
    }
    emitReportChanged(updatedReport, 'updated');
    const dispatcherName = await resolveActorName(req.firebaseUser.uid);
    await notifyBestEffort(
      notifyRespondersDispatched(updatedReport, responderUids, dispatcherName),
      'Responder dispatch'
    );
    res.json({ report: serializeReport(updatedReport) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function respondToDispatch(req, res) {
  try {
    const accepted = req.body?.accepted;
    const notificationId = req.body?.notificationId;
    if (typeof accepted !== 'boolean') {
      return res.status(400).json({ error: 'Dispatch response must be accepted or declined' });
    }

    const report = await Report.findById(req.params.id);
    if (!report || report.category !== BLOTTER_REPORT_CATEGORY || report.subcategory !== 'Civil') {
      return res.status(404).json({ error: 'Dispatch invitation not found' });
    }

    const uid = req.firebaseUser.uid;

    const myInvites = (report.dispatchInvites || []).filter(
      (entry) => entry.responderUid === uid
    );
    const invite =
      myInvites.find((entry) => entry.status === 'pending') ||
      myInvites[myInvites.length - 1];
    if (!invite) return res.status(404).json({ error: 'Dispatch invitation not found' });
    if (invite.status !== 'pending') {
      return res.json({ accepted: invite.status === 'accepted', report: serializeReport(report) });
    }
    if (report.status === 'resolved') {
      return res.status(409).json({ error: 'Resolved incidents cannot accept responders' });
    }

    const responseStatus = accepted ? 'accepted' : 'declined';

    const update = {
      $set: {
        'dispatchInvites.$[invite].status': responseStatus,
        'dispatchInvites.$[invite].respondedAt': new Date(),
      },
    };

    
    const alreadyJoined = (report.backupRequests || []).some((request) =>
      (request.joinedBy || []).includes(uid)
    );
    if (accepted && !alreadyJoined) {
      update.$push = {
        backupRequests: {
          requestedBy: uid,
          joinedBy: [uid],
        },
      };
    }

    const updatedReport = await Report.findOneAndUpdate(
      {
        _id: report._id,
        dispatchInvites: {
          $elemMatch: { responderUid: uid, status: 'pending' },
        },
      },
      update,
      {
        new: true,
        arrayFilters: [{ 'invite.responderUid': uid, 'invite.status': 'pending' }],
      }
    );
    if (!updatedReport) {
      return res.status(409).json({ error: 'The dispatch invitation was already answered' });
    }

    emitReportChanged(updatedReport, 'updated');
    const responder = await User.findOne({ firebaseUid: uid })
      .select('firebaseUid name role')
      .lean();
    if (responder) {
      await notifyBestEffort(
        notifyDispatchResponse(updatedReport, responder, accepted),
        'Dispatch response'
      );
    }
    if (notificationId) {
      await Notification.findOneAndUpdate(
        {
          _id: notificationId,
          recipientUid: uid,
          type: 'incident_dispatched',
        },
        { $set: { dispatchResponse: responseStatus, read: true } }
      );
    }
    res.json({ accepted, report: serializeReport(updatedReport) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function getReports(req, res) {
  try {
    const query = buildReportQuery({
      userRole: req.userRole,
      firebaseUserUid: req.firebaseUser.uid,
      status: req.query.status,
      handledByMe: req.query.handledByMe,
    });

    const reports = await Report.find(query).sort({ createdAt: -1 }).limit(200);
    const submitterUids = [...new Set(reports.map((report) => report.submittedBy))];
    const submitters = await User.find({ firebaseUid: { $in: submitterUids } })
      .select('firebaseUid name')
      .lean();
    const nameByUid = Object.fromEntries(submitters.map((user) => [user.firebaseUid, user.name]));

    res.json(
      reports.map((report) => {
        const canSeeReporter = canViewReporter(req.userRole, report, req.firebaseUser.uid);
        return {
          ...serializeReport(report),
          submittedBy: null,
          submitterName: canSeeReporter ? nameByUid[report.submittedBy] || null : null,
        };
      })
    );
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function getReportCount(req, res) {
  try {
    const query = buildReportQuery({
      userRole: req.userRole,
      firebaseUserUid: req.firebaseUser.uid,
      status: req.query.status,
      handledByMe: req.query.handledByMe,
    });

    const count = await Report.countDocuments(query);
    res.json({ count });
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
      !canResponderViewReport(report, req.firebaseUser.uid)
    ) {
      return res.status(404).json({ error: 'Report not found' });
    }

    if (req.userRole === 'resident' && report.submittedBy !== req.firebaseUser.uid) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const reportData = serializeReport(report);
    const participantUids = [
      report.submittedBy,
      report.acknowledgedBy,
      ...report.backupRequests.flatMap((request) => request.joinedBy || []),
    ].filter(Boolean);
    const users = await User.find({ firebaseUid: { $in: participantUids } })
      .select('firebaseUid name phone')
      .lean();
    const nameByUid = Object.fromEntries(users.map((user) => [user.firebaseUid, user.name]));
    const phoneByUid = Object.fromEntries(users.map((user) => [user.firebaseUid, user.phone]));
    const canSeeReporter = canViewReporter(req.userRole, report, req.firebaseUser.uid);
    const canSeeReporterContact = canViewReporterContact(
      req.userRole,
      report,
      req.firebaseUser.uid
    );
    const result = {
      ...reportData,
      submittedBy: req.userRole === 'resident' ? report.submittedBy : null,
      submitterName: canSeeReporter ? nameByUid[report.submittedBy] || null : null,
      submitterPhone: canSeeReporterContact ? phoneByUid[report.submittedBy] || null : null,
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

export async function logHotlineOpened(req, res) {
  const agencyNames = {
    bfp: 'Bureau of Fire Protection',
    pnp: 'Philippine National Police',
    'red-cross': 'Philippine Red Cross',
    911: 'National Emergency Hotline',
  };

  try {
    const agency = req.body?.agency;
    if (!Object.hasOwn(agencyNames, agency)) {
      return res.status(400).json({ error: 'Select a valid hotline agency' });
    }

    const report = await Report.findById(req.params.id).select('_id category subcategory');
    if (!report) return res.status(404).json({ error: 'Report not found' });

    const isEligibleReport =
      report.category === 'Emergency Situations' ||
      (report.category === BLOTTER_REPORT_CATEGORY &&
        report.subcategory === CRIMINAL_BLOTTER_SUBCATEGORY);
    if (!isEligibleReport) {
      return res.status(403).json({ error: 'Hotlines are unavailable for this report' });
    }

    if (
      ['tanod', 'responder'].includes(req.userRole) &&
      !canResponderViewReport(report, req.firebaseUser.uid)
    ) {
      return res.status(404).json({ error: 'Report not found' });
    }

    await logAudit('hotline_opened', req, report._id, { agency: agencyNames[agency] });
    return res.status(201).json({ logged: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

export async function getReportAudit(req, res) {
  try {
    const report = await Report.findById(req.params.id).select('_id category referenceNumber');
    if (!report) return res.status(404).json({ error: 'Report not found' });
    if (!['admin', 'secretary'].includes(req.userRole)) {
      return res.status(403).json({ error: 'Insufficient permissions to view this report audit' });
    }

    const logs = await AuditLog.find({ reportId: report._id }).sort({ timestamp: 1 });
    const actorUids = [...new Set(logs.map((entry) => entry.actorUid).filter(Boolean))];
    const users = await User.find({ firebaseUid: { $in: actorUids } })
      .select('firebaseUid name')
      .lean();
    const namesByUid = Object.fromEntries(users.map((user) => [user.firebaseUid, user.name]));
    const rows = logs.map((entry) => ({
      ...entry.toObject(),
      reportReferenceNumber: report.referenceNumber || null,
      actorName: entry.actorUid ? namesByUid[entry.actorUid] || null : null,
    }));

    if (req.query.format === 'csv') {
      const parser = new Parser({
        fields: ['reportReferenceNumber', 'timestamp', 'action', 'actorName', 'metadata'],
      });
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename=report-${report.referenceNumber || report._id}-audit.csv`
      );
      return res.send(`\uFEFF${parser.parse(rows)}`);
    }

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function getCaptainInactiveReports(req, res) {
  try {
    const openReports = await Report.find({ status: { $nin: ['resolved', 'flagged'] } })
      .sort({ createdAt: -1 })
      .limit(200);
    if (openReports.length === 0) {
      return res.json({ thresholdHours: workflowConfig.captainInactivityHours, reports: [] });
    }

    const reportIds = openReports.map((report) => report._id);
    const lastActivity = await AuditLog.aggregate([
      { $match: { reportId: { $in: reportIds } } },
      { $sort: { timestamp: -1 } },
      { $group: { _id: '$reportId', lastActivityAt: { $first: '$timestamp' } } },
    ]);
    const lastActivityByReport = new Map(
      lastActivity.map((entry) => [String(entry._id), entry.lastActivityAt])
    );
    const thresholdMs = workflowConfig.captainInactivityHours * 60 * 60 * 1000;
    const now = Date.now();
    const staleReports = openReports.flatMap((report) => {
      const lastActivityAt = lastActivityByReport.get(String(report._id)) || report.createdAt;
      const inactiveMs = now - new Date(lastActivityAt).getTime();
      if (inactiveMs < thresholdMs) return [];
      return [
        {
          ...serializeReport(report),
          lastActivityAt,
          inactiveHours: Math.floor(inactiveMs / (60 * 60 * 1000)),
        },
      ];
    });

    res.json({ thresholdHours: workflowConfig.captainInactivityHours, reports: staleReports });
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
    if (req.userRole === 'secretary' && report.category !== BLOTTER_CATEGORY) {
      return res.status(404).json({ error: 'Report not found' });
    }

    report.status = 'flagged';
    const flaggedAt = new Date();
    for (const request of report.backupRequests || []) {
      if (request.status !== 'pending') continue;
      request.status = 'closed';
      request.closedBy = req.firebaseUser.uid;
      request.closedAt = flaggedAt;
      request.closeReason = 'flagged';
    }
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

    await notifyOnStatusUpdate(report, 'flagged', updatedBy, req.userRole);

    await logAudit('report_flagged', req, report._id, {
      submitterUid: report.submittedBy,
    });
    emitReportChanged(report, 'updated');
    if (submitter?.status === 'suspended') {
      disconnectUserSockets(submitter.firebaseUid);
    }

    res.json(report);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function applyReportTransition(
  req,
  report,
  toStatus,
  { extraSet = {}, action = null, auditMetadata = {} } = {}
) {
  const actorUid = req.firebaseUser.uid;
  const helperUids = (report.backupRequests || []).flatMap((request) => request.joinedBy || []);
  const decision = getTransitionDecision({
    category: report.category,
    subcategory: report.subcategory,
    role: req.userRole,
    fromStatus: report.status,
    toStatus,
    actorUid,
    ownerUid: report.acknowledgedBy,
    helperUids,
  });

  if (!decision.allowed) return { statusCode: decision.statusCode, error: decision.error };

  const updatedBy = await resolveActorName(actorUid);
  const update = {
    $set: { ...decision.update, ...extraSet },
    $push: { statusHistory: { status: decision.update.status, updatedBy } },
  };
  const options = { new: true };
  const hasOpenBackupRequest = (report.backupRequests || []).some(
    (request) => request.status === 'pending'
  );

  if (decision.update.status === 'resolved' && hasOpenBackupRequest) {
    const closedAt = new Date();
    update.$set['backupRequests.$[request].status'] = 'closed';
    update.$set['backupRequests.$[request].closedBy'] = actorUid;
    update.$set['backupRequests.$[request].closedAt'] = closedAt;
    update.$set['backupRequests.$[request].closeReason'] = 'resolved';
    options.arrayFilters = [{ 'request.status': 'pending' }];
  }

  const updatedReport = await updateWithAudit(
    action || decision.action,
    req,
    report._id,
    { status: decision.update.status, ...auditMetadata },
    (session) =>
      Report.findOneAndUpdate({ _id: report._id, ...decision.filter }, update, {
        ...options,
        session,
      })
  );

  if (!updatedReport) {
    return { statusCode: 409, error: 'The report changed before your action completed' };
  }

  emitReportChanged(updatedReport, 'updated');
  await notifyBestEffort(
    notifyOnStatusUpdate(updatedReport, decision.update.status, updatedBy, req.userRole),
    'Report status update'
  );
  return { report: updatedReport };
}

export async function updateReportStatus(req, res) {
  try {
    const { status } = req.body;
    if (!['in_progress', 'resolved'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status transition' });
    }

    const report = await Report.findById(req.params.id);
    if (!report) return res.status(404).json({ error: 'Report not found' });
    if (
      status === 'resolved' &&
      ['captain', 'secretary', 'tanod', 'responder'].includes(req.userRole)
    ) {
      return res
        .status(400)
        .json({ error: 'Submit resolution details before resolving this incident' });
    }
    const result = await applyReportTransition(req, report, status);
    if (result.error) return res.status(result.statusCode).json({ error: result.error });
    res.json(serializeReport(result.report));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

function parseBoolean(value) {
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return undefined;
}

export async function submitResolution(req, res) {
  try {
    const furtherActionRequired = parseBoolean(req.body.furtherActionRequired);
    const assistanceRequested = parseBoolean(req.body.assistanceRequested);
    const details = {
      summary: req.body.summary,
      actionsTaken: req.body.actionsTaken,
      outcome: req.body.outcome,
      furtherActionRequired,
      furtherActionRecommendation: req.body.furtherActionRecommendation,
      assistanceRequested,
    };
    const validationError = validateResolutionDetails(details);
    if (validationError) return res.status(400).json({ error: validationError });

    const report = await Report.findById(req.params.id);
    if (!report) return res.status(404).json({ error: 'Report not found' });
    const canResolveAsBlotterOfficial =
      report.category === BLOTTER_REPORT_CATEGORY &&
      ['captain', 'secretary'].includes(req.userRole);
    if (
      !canResolveAsBlotterOfficial &&
      !canSubmitResolution(req.firebaseUser.uid, report.acknowledgedBy)
    ) {
      return res
        .status(403)
        .json({ error: 'Only the assigned responder can submit the resolution' });
    }
    if (report.resolution?.resolvedAt || report.status === 'resolved') {
      return res.status(409).json({ error: 'Resolution details have already been submitted' });
    }

    const uploadedEvidence = await Promise.all(
      (req.files || []).map((file) => uploadImage(file.buffer, file.mimetype))
    );
    const resolvedByName = await resolveActorName(req.firebaseUser.uid);
    const resolution = {
      summary: details.summary.trim(),
      actionsTaken: details.actionsTaken.trim(),
      outcome: details.outcome.trim(),
      furtherActionRequired,
      furtherActionRecommendation: furtherActionRequired
        ? details.furtherActionRecommendation.trim()
        : null,
      assistanceRequested,
      supportingEvidence: uploadedEvidence.map((file) => file.secure_url),
      resolvedBy: req.firebaseUser.uid,
      resolvedByName,
      resolvedAt: new Date(),
      verificationStatus: 'pending',
    };

    const result = await applyReportTransition(req, report, 'resolved', {
      extraSet: { resolution },
      action: 'resolution_submitted',
      auditMetadata: { evidenceCount: resolution.supportingEvidence.length },
    });
    if (result.error) return res.status(result.statusCode).json({ error: result.error });
    res.json(serializeReport(result.report));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function verifyResolution(req, res) {
  try {
    if (!['captain', 'secretary'].includes(req.userRole)) {
      return res
        .status(403)
        .json({ error: 'Only the Captain or Secretary can verify resolutions' });
    }
    const report = await Report.findById(req.params.id);
    if (!report) return res.status(404).json({ error: 'Report not found' });
    if (!report.resolution?.resolvedAt) {
      return res
        .status(409)
        .json({ error: 'Resolution details must be submitted before verification' });
    }
    if (report.resolution.verificationStatus === 'verified') {
      return res.json(serializeReport(report));
    }

    const verifiedByName = await resolveActorName(req.firebaseUser.uid);
    const verifiedAt = new Date();
    const updatedReport = await updateWithAudit(
      'resolution_verified',
      req,
      report._id,
      {},
      (session) =>
        Report.findOneAndUpdate(
          {
            _id: report._id,
            'resolution.resolvedAt': { $ne: null },
            'resolution.verificationStatus': { $ne: 'verified' },
          },
          {
            $set: {
              'resolution.verificationStatus': 'verified',
              'resolution.verifiedBy': req.firebaseUser.uid,
              'resolution.verifiedByName': verifiedByName,
              'resolution.verifiedAt': verifiedAt,
            },
          },
          { new: true, session }
        )
    );
    if (!updatedReport)
      return res.status(409).json({ error: 'Resolution changed before verification completed' });
    emitReportChanged(updatedReport, 'updated');
    res.json(serializeReport(updatedReport));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function acknowledgeReport(req, res) {
  try {
    const report = await Report.findById(req.params.id);
    if (!report) return res.status(404).json({ error: 'Report not found' });
    if (report.acknowledgedBy === req.firebaseUser.uid) {
      return res.json(serializeReport(report));
    }

    const result = await applyReportTransition(req, report, 'coordinating');
    if (result.error) {
      const latestReport = await Report.findById(report._id);
      if (latestReport?.acknowledgedBy === req.firebaseUser.uid) {
        return res.json(serializeReport(latestReport));
      }
      return res.status(result.statusCode).json({ error: result.error });
    }
    res.json(serializeReport(result.report));
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
    if (!canResponderViewReport(report)) {
      return res.status(404).json({ error: 'Report not found' });
    }
    if (!supportsBackupRequests(report.category, report.subcategory)) {
      return res.status(404).json({ error: 'Report not found' });
    }
    if (report.acknowledgedBy !== req.firebaseUser.uid) {
      return res.status(403).json({ error: 'Only the assigned responder can request backup' });
    }
    if (isTerminalReportStatus(report.status)) {
      return res.status(409).json({ error: 'Closed incidents cannot request backup' });
    }

    const openRequest = (report.backupRequests || []).find(
      (request) => request.requestedBy === req.firebaseUser.uid && request.status === 'pending'
    );
    if (openRequest) {
      return res.json({ report: serializeReport(report), alreadyRequested: true });
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
            ...responderReportFilter(report),
            status: { $nin: ['resolved', 'flagged'] },
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
        return res.json({ report: serializeReport(latestReport), alreadyRequested: true });
      }
      return res
        .status(409)
        .json({ error: 'The incident changed before backup could be requested' });
    }

    emitReportChanged(updatedReport, 'updated');
    const requesterName = await resolveActorName(req.firebaseUser.uid);
    await notifyBestEffort(
      notifyBackupRequest(updatedReport, requesterName, req.userRole),
      'Backup request'
    );
    res.json({ report: serializeReport(updatedReport), alreadyRequested: false });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function joinBackupRequest(req, res) {
  try {
    const report = await Report.findById(req.params.id);
    if (!report) return res.status(404).json({ error: 'Report not found' });
    const ownerUid = report.acknowledgedBy;
    const decision = getJoinDecision({
      category: report.category,
      subcategory: report.subcategory,
      status: report.status,
      ownerUid,
      actorUid: req.firebaseUser.uid,
      backupRequests: report.backupRequests || [],
    });
    if (!decision.allowed) {
      return res.status(decision.statusCode).json({ error: decision.error });
    }
    if (decision.alreadyJoined) {
      return res.json({ report: serializeReport(report), alreadyJoined: true });
    }

    const updatedReport = await updateWithAudit(
      'backup_joined',
      req,
      report._id,
      { ownerUid },
      (session) =>
        Report.findOneAndUpdate(
          {
            _id: report._id,
            ...decision.filter,
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
        return res.json({ report: serializeReport(latestReport), alreadyJoined: true });
      }
      return res.status(409).json({ error: 'The backup request was closed or has changed' });
    }

    emitReportChanged(updatedReport, 'updated');
    const helperName = await resolveActorName(req.firebaseUser.uid);
    await notifyBestEffort(
      notifyBackupJoined(updatedReport, helperName, req.userRole),
      'Backup join'
    );
    res.json({ report: serializeReport(updatedReport), alreadyJoined: false });
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
    if (!canResponderViewReport(report)) {
      return res.status(404).json({ error: 'Report not found' });
    }
    if (!supportsBackupRequests(report.category, report.subcategory)) {
      return res.status(404).json({ error: 'Report not found' });
    }
    if (isTerminalReportStatus(report.status)) {
      return res.status(409).json({ error: 'Closed incidents cannot accept backup responders' });
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
            ...responderReportFilter(report),
            status: { $nin: ['resolved', 'flagged'] },
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

    emitReportChanged(closedReport, 'updated');
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
    const period = ['all', 'week', 'month', 'year'].includes(req.query.period)
      ? req.query.period
      : 'month';
    if (period !== 'all') {
      const periodDays = { week: 7, month: 30, year: 365 }[period];
      match.createdAt = { $gte: new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000) };
    }

    const byCategory = await Report.aggregate([
      { $match: match },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    const rawStatusCounts = await Report.aggregate([
      { $match: match },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);
    const statusCounts = new Map();
    for (const item of rawStatusCounts) {
      const status = normalizeReportStatus(item._id);
      statusCounts.set(status, (statusCounts.get(status) || 0) + item.count);
    }
    const byStatus = [...statusCounts].map(([_id, count]) => ({ _id, count }));

    const total = await Report.countDocuments(match);
    const resolved = await Report.countDocuments({ ...match, status: 'resolved' });
    const pending = await Report.countDocuments({
      ...match,
      status: { $in: ['pending', 'verified'] },
    });

    const last30Days = await Report.aggregate([
      {
        $match: {
          ...match,
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

    const points = await Report.find(match).select('_id location category status severity');
    res.json(
      points.map((p) => ({
        id: p._id.toString(),
        lat: p.location.coordinates[1],
        lng: p.location.coordinates[0],
        category: p.category,
        status: normalizeReportStatus(p.status),
        severity: p.severity,
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
