import Notification from '../models/Notification.js';
import PushToken from '../models/PushToken.js';
import Report from '../models/Report.js';
import User from '../models/User.js';
import { getFirebaseAdmin } from '../config/firebase.js';
import {
  buildNotificationFeedPipeline,
  decodeNotificationCursor,
  encodeNotificationCursor,
  parseLegacyStatusNotification,
} from './notificationFeed.js';
import {
  BLOTTER_REPORT_CATEGORY,
  CRIMINAL_BLOTTER_SUBCATEGORY,
  FIELD_REPORT_CATEGORIES,
  normalizeReportStatus,
} from './reportWorkflow.js';

let ioInstance = null;
const NOTIFICATION_ROLES_BY_CATEGORY = {
  'Public Concerns': ['tanod', 'responder'],
  'Emergency Situations': ['captain', 'tanod', 'responder'],
};

export function getNotificationRecipientRoles(category, subcategory) {
  if (category === BLOTTER_REPORT_CATEGORY) {
    return subcategory === CRIMINAL_BLOTTER_SUBCATEGORY
      ? ['captain', 'secretary', 'tanod', 'responder']
      : ['captain', 'secretary'];
  }
  return [...(NOTIFICATION_ROLES_BY_CATEGORY[category] || [])];
}

function getReportSnapshot(report) {
  return {
    referenceNumber: report.referenceNumber || null,
    category: report.category || null,
    subcategory: report.subcategory || null,
    title: report.aiTitle?.trim() || report.subcategory || report.category || null,
    severity: report.severity || null,
    location: report.location?.address || null,
  };
}

function serializeEvent(event) {
  const legacy = parseLegacyStatusNotification(event.message || '');
  const status = event.statusSnapshot || legacy.statusSnapshot;

  return {
    id: String(event._id),
    type: event.type,
    message: event.message,
    read: Boolean(event.read),
    urgent: Boolean(event.urgent),
    createdAt: new Date(event.createdAt).toISOString(),
    status: status ? normalizeReportStatus(status) : null,
    actorRole: event.actorRole || null,
    actorName: event.actorName || legacy.actorName || null,
  };
}

function mergeReportSnapshot(snapshot, report) {
  const fallback = report ? getReportSnapshot(report) : {};
  const source = snapshot || {};

  return {
    referenceNumber: source.referenceNumber || fallback.referenceNumber || null,
    category: source.category || fallback.category || null,
    subcategory: source.subcategory || fallback.subcategory || null,
    title: source.title || fallback.title || null,
    severity: source.severity || fallback.severity || null,
    location: source.location || fallback.location || null,
  };
}

export function setSocketIO(io) {
  ioInstance = io;
}

export function getReportChangeRooms(report) {
  const rooms = ['role:admin', 'role:captain'];
  if (report.category === BLOTTER_REPORT_CATEGORY) {
    rooms.push('role:secretary');
    if (report.subcategory === CRIMINAL_BLOTTER_SUBCATEGORY) {
      rooms.push('role:tanod', 'role:responder');
    }
  }
  if (FIELD_REPORT_CATEGORIES.includes(report.category)) {
    rooms.push('role:tanod', 'role:responder');
  }
  if (report.submittedBy) rooms.push(`user:${report.submittedBy}`);
  return rooms;
}

export function emitReportChanged(report, changeType) {
  if (!ioInstance) return;
  const event = {
    reportId: String(report._id),
    category: report.category,
    changeType,
  };
  getReportChangeRooms(report).forEach((room) => {
    ioInstance.to(room).emit('report:changed', event);
  });
}

export function disconnectUserSockets(firebaseUid) {
  ioInstance?.in(`user:${firebaseUid}`).disconnectSockets(true);
}

async function sendPushNotifications(notifications) {
  const admin = getFirebaseAdmin();
  if (!admin) return;
  const items = Array.isArray(notifications) ? notifications : [notifications];
  const recipientUids = [...new Set(items.map((item) => item.recipientUid).filter(Boolean))];
  const tokens = await PushToken.find({ firebaseUid: { $in: recipientUids } }).lean();
  if (!tokens.length) return;

  const itemByUid = new Map(items.map((item) => [item.recipientUid, item]));
  const response = await admin.messaging().sendEach(
    tokens.map((token) => {
      const item = itemByUid.get(token.firebaseUid);
      return {
        token: token.token,
        notification: {
          title: item.urgent ? 'Urgent Anyareport alert' : 'New Anyareport notification',
          body: item.message,
        },
        data: {
          notificationId: String(item._id),
          reportId: item.reportId ? String(item.reportId) : '',
          recipientRole: item.recipientRole || '',
        },
      };
    })
  );

  const invalidTokens = response.responses
    .map((result, index) =>
      result.success || !['messaging/registration-token-not-registered', 'messaging/invalid-registration-token'].includes(result.error?.code)
        ? null
        : tokens[index].token
    )
    .filter(Boolean);
  if (invalidTokens.length) await PushToken.deleteMany({ token: { $in: invalidTokens } });
}

async function deliverPushNotifications(notifications) {
  try {
    await sendPushNotifications(notifications);
  } catch (error) {
    console.error('[Push] Delivery failed:', error);
  }
}

export async function notifyOnNewReport(report) {
  const isEmergency = report.category === 'Emergency Situations';
  const isCriminalBlotter =
    report.category === BLOTTER_REPORT_CATEGORY &&
    report.subcategory === CRIMINAL_BLOTTER_SUBCATEGORY;
  const reportTitle = report.aiTitle?.trim() || report.subcategory || report.category;
  const reference = report.referenceNumber ? ` (${report.referenceNumber})` : '';
  const rolesToNotify = getNotificationRecipientRoles(report.category, report.subcategory);
  const users = await User.find({ role: { $in: rolesToNotify }, status: 'active' });
  const reportSnapshot = getReportSnapshot(report);

  const notifications = [];
  for (const user of users) {
    const notif = await Notification.create({
      recipientUid: user.firebaseUid,
      recipientRole: user.role,
      reportId: report._id,
      type: 'incident_received',
      message: `New report${reference}: ${reportTitle}`,
      urgent: isEmergency || isCriminalBlotter,
      reportSnapshot,
      actorRole: 'resident',
    });
    notifications.push(notif);

    if (ioInstance) {
      ioInstance.to(`role:${user.role}`).emit('notification', notif);
      if (notif.urgent) {
        ioInstance.to('role:captain').emit('urgent_alert', notif);
      }
    }
    await deliverPushNotifications(notif);
  }

  return notifications;
}

export async function notifyOnStatusUpdate(report, status, updatedBy, updatedByRole) {
  const user = await User.findOne({ firebaseUid: report.submittedBy });
  if (!user) return null;
  const reference = report.referenceNumber ? ` (${report.referenceNumber})` : '';

  const notification = await Notification.create({
    recipientUid: user.firebaseUid,
    recipientRole: user.role,
    reportId: report._id,
    type: 'report_status_updated',
    message: `Your report${reference} status was updated to ${status.replace(/_/g, ' ')} by ${updatedBy}.`,
    reportSnapshot: getReportSnapshot(report),
    statusSnapshot: normalizeReportStatus(status),
    actorRole: updatedByRole || null,
    actorName: updatedBy,
  });

  if (ioInstance) {
    ioInstance.to(`role:${user.role}`).emit('notification', notification);
  }
  await deliverPushNotifications(notification);

  return notification;
}

export async function notifyRespondersDispatched(report, responderUids, dispatcherName) {
  const uids = [...new Set(Array.isArray(responderUids) ? responderUids : [])].filter(Boolean);
  if (!uids.length) return [];

  const users = await User.find({
    firebaseUid: { $in: uids },
    role: /^\s*(tanod|responder)\s*$/i,
    status: 'active',
  })
    .select('firebaseUid role')
    .lean();
  const reference = report.referenceNumber ? ` (${report.referenceNumber})` : '';
  const reportTitle = report.aiTitle?.trim() || report.subcategory || report.category;
  const reportSnapshot = getReportSnapshot(report);
  const notifications = await Promise.all(
    users.map((user) =>
      Notification.create({
        recipientUid: user.firebaseUid,
        recipientRole: user.role,
        reportId: report._id,
        type: 'incident_dispatched',
        message: `${dispatcherName || 'The Secretary'} dispatched you to ${reportTitle}${reference}.`,
        urgent: true,
        reportSnapshot,
        actorRole: 'secretary',
        actorName: dispatcherName || null,
      })
    )
  );

  if (ioInstance) {
    notifications.forEach((notification) => {
      ioInstance.to(`user:${notification.recipientUid}`).emit('notification', notification);
    });
  }
  await deliverPushNotifications(notifications);

  return notifications;
}

export async function notifyBackupRequest(report, requesterName, requesterRole) {
  const reference = report.referenceNumber ? ` (${report.referenceNumber})` : '';
  const reportSnapshot = getReportSnapshot(report);
  const users = await User.find({
    role: { $in: ['tanod', 'responder'] },
    status: 'active',
    firebaseUid: { $ne: report.acknowledgedBy },
  });

  const notifications = await Promise.all(
    users.map((user) =>
      Notification.create({
        recipientUid: user.firebaseUid,
        recipientRole: user.role,
        reportId: report._id,
        type: 'backup_requested',
        message: `${requesterName} requested backup for ${report.category}${reference}.`,
        urgent: true,
        reportSnapshot,
        actorRole: requesterRole || null,
        actorName: requesterName,
      })
    )
  );

  if (ioInstance) {
    notifications.forEach((notification) => {
      ioInstance.to(`role:${notification.recipientRole}`).emit('notification', notification);
    });
  }
  await deliverPushNotifications(notifications);

  return notifications;
}

export async function notifyBackupJoined(report, helperName, helperRole) {
  const owner = await User.findOne({ firebaseUid: report.acknowledgedBy })
    .select('firebaseUid role')
    .lean();
  if (!owner) return null;
  const reference = report.referenceNumber ? ` (${report.referenceNumber})` : '';

  const notification = await Notification.create({
    recipientUid: owner.firebaseUid,
    recipientRole: owner.role,
    reportId: report._id,
    type: 'backup_joined',
    message: `${helperName} joined your incident${reference} as backup.`,
    reportSnapshot: getReportSnapshot(report),
    actorRole: helperRole || null,
    actorName: helperName,
  });

  if (ioInstance) {
    ioInstance.to(`role:${owner.role}`).emit('notification', notification);
  }
  await deliverPushNotifications(notification);

  return notification;
}

export async function getNotificationsForUser(
  firebaseUid,
  { cursor: cursorValue, limit = 20 } = {}
) {
  const cursor = decodeNotificationCursor(cursorValue);
  const [result] = await Notification.aggregate(
    buildNotificationFeedPipeline(firebaseUid, limit, cursor)
  ).allowDiskUse(true);
  const groupedItems = result?.items || [];
  const hasMore = groupedItems.length > limit;
  const pageItems = hasMore ? groupedItems.slice(0, limit) : groupedItems;
  const reportIds = [
    ...new Set(pageItems.map((item) => item.latest.reportId?.toString()).filter(Boolean)),
  ];
  const reports = reportIds.length
    ? await Report.find({ _id: { $in: reportIds } })
        .select('referenceNumber category subcategory aiTitle severity location')
        .lean()
    : [];
  const reportById = new Map(reports.map((report) => [String(report._id), report]));
  const items = pageItems.map((item) => {
    const latest = serializeEvent(item.latest);
    const reportId = item.latest.reportId?.toString() || null;
    const report = reportId ? reportById.get(reportId) : null;
    const eventDetails = item.kind === 'status_group' ? item.events.map(serializeEvent) : [latest];

    return {
      id: item._id,
      kind: item.kind,
      bucket: item.bucket,
      type: latest.type,
      latestEventId: latest.id,
      message: latest.message,
      reportId,
      report: mergeReportSnapshot(item.latest.reportSnapshot, report),
      status: latest.status,
      actorRole: latest.actorRole,
      actorName: latest.actorName,
      read: Boolean(item.read),
      unreadEventCount: item.unreadEventCount,
      eventCount: item.eventCount,
      urgent: Boolean(item.urgent),
      createdAt: latest.createdAt,
      earlierUpdates: item.kind === 'status_group' ? eventDetails.slice(1) : [],
    };
  });
  const countData = result?.counts?.[0] || {};
  const lastItem = pageItems[pageItems.length - 1];

  return {
    items,
    unreadCount: countData.unread || 0,
    unreadEventCount: countData.unreadEvents || 0,
    counts: {
      all: countData.all || 0,
      unread: countData.unread || 0,
      alerts: countData.alerts || 0,
      updates: countData.updates || 0,
    },
    nextCursor:
      hasMore && lastItem ? encodeNotificationCursor(lastItem.createdAt, lastItem._id) : null,
  };
}

export async function markNotificationRead(id, firebaseUid) {
  return Notification.findOneAndUpdate(
    { _id: id, recipientUid: firebaseUid },
    { read: true },
    { new: true }
  );
}

export async function markNotificationGroupRead(reportId, firebaseUid) {
  return Notification.updateMany(
    { recipientUid: firebaseUid, reportId, type: 'report_status_updated', read: false },
    { $set: { read: true } }
  );
}

export async function markAllNotificationsRead(firebaseUid) {
  return Notification.updateMany(
    { recipientUid: firebaseUid, read: false },
    { $set: { read: true } }
  );
}
