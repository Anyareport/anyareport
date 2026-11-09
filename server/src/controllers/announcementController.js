import mongoose from 'mongoose';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import { writeAudit } from '../services/auditLog.js';
import { notifyBarangayAnnouncement } from '../services/notifications.js';

const ANNOUNCEMENT_CATEGORIES = ['SK Programs', 'TUPAD Payout', 'Other'];

function getAnnouncementValues(body) {
  return {
    category: typeof body.category === 'string' ? body.category.trim() : '',
    title: typeof body.title === 'string' ? body.title.trim() : '',
    message: typeof body.message === 'string' ? body.message.trim() : '',
  };
}

function validateAnnouncement({ category, title, message }) {
  if (!ANNOUNCEMENT_CATEGORIES.includes(category)) return 'Select a valid announcement category';
  if (title.length < 3 || title.length > 120) {
    return 'Title must be between 3 and 120 characters';
  }
  if (message.length < 10 || message.length > 2000) {
    return 'Message must be between 10 and 2000 characters';
  }
  return null;
}

export async function createAnnouncement(req, res) {
  const { category, title, message } = getAnnouncementValues(req.body);
  const validationError = validateAnnouncement({ category, title, message });
  if (validationError) return res.status(400).json({ error: validationError });

  try {
    const announcementId = new mongoose.Types.ObjectId().toString();
    const secretary = await User.findOne({ firebaseUid: req.firebaseUser.uid })
      .select('name')
      .lean();
    const residents = await User.find({ role: 'resident', status: 'active' })
      .select('firebaseUid role')
      .lean();
    const notifications = await notifyBarangayAnnouncement({
      announcementId,
      category,
      title,
      message,
      actorUid: req.firebaseUser.uid,
      actorName: secretary?.name || 'Barangay Secretary',
      residents,
    });

    await writeAudit('barangay_announcement_sent', {
      req,
      metadata: {
        category,
        title,
        recipientCount: notifications.length,
        recipientUids: notifications.map((notification) => notification.recipientUid),
      },
    });

    return res.status(201).json({
      category,
      title,
      message,
      announcementId,
      recipientCount: notifications.length,
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

export async function listSecretaryAnnouncements(req, res) {
  try {
    const records = await Notification.aggregate([
      {
        $match: {
          type: 'barangay_announcement',
          announcementAuthorUid: req.firebaseUser.uid,
        },
      },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: '$announcementId',
          category: { $first: '$announcementCategory' },
          title: { $first: '$announcementTitle' },
          message: { $first: '$message' },
          createdAt: { $first: '$createdAt' },
          recipientCount: { $sum: 1 },
        },
      },
      { $sort: { createdAt: -1 } },
    ]);

    res.json(
      records.map((record) => ({
        id: record._id,
        category: record.category,
        title: record.title,
        message: record.message.replace(`${record.title}: `, ''),
        createdAt: record.createdAt,
        recipientCount: record.recipientCount,
      }))
    );
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function updateAnnouncement(req, res) {
  const { category, title, message } = getAnnouncementValues(req.body);
  const validationError = validateAnnouncement({ category, title, message });
  if (validationError) return res.status(400).json({ error: validationError });

  try {
    const result = await Notification.updateMany(
      {
        type: 'barangay_announcement',
        announcementId: req.params.id,
        announcementAuthorUid: req.firebaseUser.uid,
      },
      {
        $set: {
          announcementCategory: category,
          announcementTitle: title,
          message: `${title}: ${message}`,
        },
      }
    );
    if (!result.matchedCount) return res.status(404).json({ error: 'Announcement not found' });
    await writeAudit('barangay_announcement_updated', {
      req,
      metadata: { announcementId: req.params.id, category, title },
    });
    res.json({ id: req.params.id, category, title, message });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export async function deleteAnnouncement(req, res) {
  try {
    const result = await Notification.deleteMany({
      type: 'barangay_announcement',
      announcementId: req.params.id,
      announcementAuthorUid: req.firebaseUser.uid,
    });
    if (!result.deletedCount) return res.status(404).json({ error: 'Announcement not found' });
    await writeAudit('barangay_announcement_deleted', {
      req,
      metadata: { announcementId: req.params.id, deletedCount: result.deletedCount },
    });
    res.json({ deletedCount: result.deletedCount });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
