import Notification from '../models/Notification.js';
import User from '../models/User.js';

let ioInstance = null;

export function setSocketIO(io) {
  ioInstance = io;
}

export async function notifyOnNewReport(report) {
  const isEmergency = report.category === 'Emergency Situations';
  const reportTitle = report.aiTitle?.trim() || report.subcategory || report.category;
  const reference = report.referenceNumber ? ` (${report.referenceNumber})` : '';
  const rolesToNotify =
    report.category === 'Blotter Cases'
      ? ['captain', 'secretary']
      : ['tanod', 'responder', 'captain'];
  const users = await User.find({ role: { $in: rolesToNotify }, status: 'active' });

  const notifications = [];
  for (const user of users) {
    const notif = await Notification.create({
      recipientUid: user.firebaseUid,
      recipientRole: user.role,
      reportId: report._id,
      type: 'incident_received',
      message: `New report${reference}: ${reportTitle}`,
      urgent: user.role === 'captain' && isEmergency,
    });
    notifications.push(notif);

    if (ioInstance) {
      ioInstance.to(`role:${user.role}`).emit('notification', notif);
      if (notif.urgent) {
        ioInstance.to('role:captain').emit('urgent_alert', notif);
      }
    }
  }

  // TODO: FCM web push for offline users
  return notifications;
}

export async function notifyOnStatusUpdate(report, status, updatedBy) {
  const user = await User.findOne({ firebaseUid: report.submittedBy });
  if (!user) return null;
  const reference = report.referenceNumber ? ` (${report.referenceNumber})` : '';

  const notification = await Notification.create({
    recipientUid: user.firebaseUid,
    recipientRole: user.role,
    reportId: report._id,
    type: 'report_status_updated',
    message: `Your report${reference} status was updated to ${status.replace(/_/g, ' ')} by ${updatedBy}.`,
  });

  if (ioInstance) {
    ioInstance.to(`role:${user.role}`).emit('notification', notification);
  }

  return notification;
}

export async function notifyBackupRequest(report, requesterName) {
  const reference = report.referenceNumber ? ` (${report.referenceNumber})` : '';
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
      })
    )
  );

  if (ioInstance) {
    notifications.forEach((notification) => {
      ioInstance.to(`role:${notification.recipientRole}`).emit('notification', notification);
    });
  }

  return notifications;
}

export async function notifyBackupJoined(report, helperName) {
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
  });

  if (ioInstance) {
    ioInstance.to(`role:${owner.role}`).emit('notification', notification);
  }

  return notification;
}

export async function getNotificationsForUser(firebaseUid) {
  return Notification.find({ recipientUid: firebaseUid }).sort({ createdAt: -1 }).limit(50);
}

export async function markNotificationRead(id, firebaseUid) {
  return Notification.findOneAndUpdate(
    { _id: id, recipientUid: firebaseUid },
    { read: true },
    { new: true }
  );
}
