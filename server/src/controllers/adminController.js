import mongoose from 'mongoose';
import User from '../models/User.js';
import AuditLog from '../models/AuditLog.js';
import { getFirebaseAdmin } from '../config/firebase.js';
import { disconnectUserSockets, notifyAdmins } from '../services/notifications.js';
import { writeAudit } from '../services/auditLog.js';
import {
  buildUserCreatedEvent,
  buildUserRoleEvent,
  buildUserStatusEvent,
} from '../services/adminNotificationEvents.js';
import { applyResidentReactivation } from '../services/residentReactivation.js';

const USER_STATUSES = ['active', 'suspended'];
const USER_ROLES = ['resident', 'tanod', 'responder', 'captain', 'secretary', 'admin'];

// Audits an admin action on a user account, then tells the other admins about it.
async function auditAndNotify(req, event) {
  const actorUid = req.firebaseUser.uid;
  await writeAudit(event.auditAction, { req, metadata: event.auditMetadata });
  try {
    await notifyAdmins({
      type: event.type,
      message: event.message,
      urgent: event.urgent,
      actorUid,
      actorName: event.actorName,
      actorRole: 'admin',
      excludeUid: actorUid,
      auditMetadata: { action: event.auditAction },
    });
  } catch (error) {
    console.error('[Admin notification] Failed:', error.message);
  }
}

function getActorName(req) {
  return req.userProfile?.name || req.firebaseUser?.email || req.firebaseUser.uid;
}

export async function listUsers(req, res) {
  try {
    const users = await User.find().select('-__v').sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function getUserSummary(req, res) {
  try {
    // One document per account (unique firebaseUid/email), so countDocuments
    // cannot double-count a user regardless of role.
    // "Active" mirrors the enforcement in index.js and notifications.js: status === 'active'.
    const [total, active, suspended] = await Promise.all([
      User.countDocuments({}),
      User.countDocuments({ status: 'active' }),
      User.countDocuments({ status: 'suspended' }),
    ]);
    res.json({ total, active, suspended });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function listResidentAccounts(_req, res) {
  try {
    const residents = await User.find({ role: 'resident' })
      .select('name email status flaggedReportCount')
      .sort({ createdAt: -1 })
      .lean();
    res.json(residents);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function reactivateResident(req, res) {
  const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
  if (!reason || reason.length > 500) {
    return res.status(400).json({ error: 'A reactivation reason of 1–500 characters is required' });
  }
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ error: 'Invalid resident account ID' });
  }

  let session;
  let reactivatedUser = null;
  let failure = null;
  try {
    session = await mongoose.startSession();
    await session.withTransaction(async () => {
      const user = await User.findOne({
        _id: req.params.id,
        role: 'resident',
        status: 'suspended',
      }).session(session);

      if (!user) {
        const existing = await User.findById(req.params.id).session(session);
        failure = existing
          ? { status: 409, error: 'Only suspended resident accounts can be reactivated here' }
          : { status: 404, error: 'Resident account not found' };
        return;
      }

      const auditRecord = applyResidentReactivation(user, {
        actorUid: req.firebaseUser.uid,
        reason,
      });
      await user.save({ session });
      await AuditLog.create([auditRecord], { session });
      reactivatedUser = user;
    });

    if (failure) return res.status(failure.status).json({ error: failure.error });
    if (!reactivatedUser) {
      return res.status(409).json({ error: 'Resident account changed before reactivation completed' });
    }
    res.json({
      _id: reactivatedUser._id,
      name: reactivatedUser.name,
      email: reactivatedUser.email,
      status: reactivatedUser.status,
      flaggedReportCount: reactivatedUser.flaggedReportCount,
    });
  } catch (err) {
    console.error('[Resident reactivation] Failed:', err);
    res.status(500).json({ error: 'Could not reactivate resident account' });
  } finally {
    if (session) await session.endSession();
  }
}

export async function createOfficial(req, res) {
  try {
    const { email, password, name, phone, address, role } = req.body;

    if (!email || !password || !name || !phone || !role) {
      return res.status(400).json({ error: 'Email, password, name, phone, and role are required' });
    }

    const validRoles = ['tanod', 'responder', 'captain', 'secretary', 'admin'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: 'Invalid official role' });
    }

    const admin = getFirebaseAdmin();
    if (!admin) {
      return res.status(503).json({ error: 'Firebase Admin SDK not configured' });
    }

    const firebaseUser = await admin.auth().createUser({
      email,
      password,
      displayName: name,
      emailVerified: false,
    });

    await admin.auth().setCustomUserClaims(firebaseUser.uid, { role });

    const user = await User.create({
      firebaseUid: firebaseUser.uid,
      email,
      name,
      phone,
      address: address || '',
      role,
      emailVerified: false,
    });

    await auditAndNotify(req, {
      ...buildUserCreatedEvent({ actorName: getActorName(req), target: user }),
      actorName: getActorName(req),
    });

    res.status(201).json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function updateUserStatus(req, res) {
  try {
    const { status } = req.body;
    if (!USER_STATUSES.includes(status)) {
      return res.status(400).json({ error: 'Status must be active or suspended' });
    }
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.firebaseUid === req.firebaseUser.uid) {
      return res.status(403).json({ error: 'You cannot change your own account status' });
    }
    const previousStatus = user.status;
    if (status === 'active' && user.role === 'resident' && previousStatus === 'suspended') {
      return res.status(400).json({
        error: 'Use the resident reactivation action and provide an appeal reason',
      });
    }
    user.status = status;
    await user.save();
    disconnectUserSockets(user.firebaseUid);

    if (previousStatus !== status) {
      await auditAndNotify(req, {
        ...buildUserStatusEvent({ actorName: getActorName(req), target: user, previousStatus }),
        actorName: getActorName(req),
      });
    }
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function updateUserRole(req, res) {
  try {
    const { role } = req.body;
    if (!USER_ROLES.includes(role)) {
      return res.status(400).json({ error: 'Invalid user role' });
    }
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.firebaseUid === req.firebaseUser.uid) {
      return res.status(403).json({ error: 'You cannot change your own account role' });
    }

    const previousRole = user.role;
    user.role = role;
    await user.save();
    disconnectUserSockets(user.firebaseUid);

    const admin = getFirebaseAdmin();
    if (admin) {
      await admin.auth().setCustomUserClaims(user.firebaseUid, { role: user.role });
    }

    if (previousRole !== user.role) {
      await auditAndNotify(req, {
        ...buildUserRoleEvent({ actorName: getActorName(req), target: user, previousRole }),
        actorName: getActorName(req),
      });
    }

    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}