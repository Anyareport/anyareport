import Report from '../models/Report.js';
import { exportToCSV, exportToPDF } from '../services/export.js';
import { scopeToCommittee } from '../middleware/rbac.js';
import {
  getNotificationsForUser,
  markNotificationRead,
} from '../services/notifications.js';

export async function exportReports(req, res) {
  try {
    const format = req.query.format || 'csv';
    let query = {};
    query = scopeToCommittee(query, req.userRole, req.userCommittee);

    const reports = await Report.find(query).sort({ createdAt: -1 });

    if (format === 'pdf') {
      const pdf = await exportToPDF(reports);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename=anyareport-export.pdf');
      return res.send(pdf);
    }

    const csv = exportToCSV(reports);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=anyareport-export.csv');
    res.send(csv);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function getNotifications(req, res) {
  try {
    const notifications = await getNotificationsForUser(req.firebaseUser.uid);
    res.json(notifications);
  } catch (err) {
    res.status(500).json({ error: err.message });
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
