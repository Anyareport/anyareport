import mongoose from 'mongoose';
import Report from '../models/Report.js';
import { exportToCSV, exportToPDF } from '../services/export.js';
import {
  getNotificationsForUser,
  markAllNotificationsRead,
  markNotificationGroupRead,
  markNotificationRead,
} from '../services/notifications.js';

export async function exportReports(req, res) {
  try {
    const format = req.query.format || 'csv';
    const reports = await Report.find({}).sort({ createdAt: -1 });

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
    res.status(500).json({ error: err.message });
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
