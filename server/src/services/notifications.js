import Notification from '../models/Notification.js';
import User from '../models/User.js';

let ioInstance = null;

export function setSocketIO(io) {
  ioInstance = io;
}

export async function notifyOnVerification(report) {
  const isEmergency = report.category === 'Emergency Situations';
  const rolesToNotify = ['tanod', 'responder', 'captain'];
  const users = await User.find({ role: { $in: rolesToNotify }, status: 'active' });

  const notifications = [];
  for (const user of users) {
    const notif = await Notification.create({
      recipientUid: user.firebaseUid,
      recipientRole: user.role,
      reportId: report._id,
      type: 'incident_verified',
      message: `Verified incident: ${report.category} — ${report.description.slice(0, 80)}`,
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
