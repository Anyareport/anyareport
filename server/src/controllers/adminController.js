import User from '../models/User.js';
import { getFirebaseAdmin } from '../config/firebase.js';

export async function listUsers(req, res) {
  try {
    const users = await User.find().select('-__v').sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
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
      emailVerified: true,
    });

    await admin.auth().setCustomUserClaims(firebaseUser.uid, { role });

    const user = await User.create({
      firebaseUid: firebaseUser.uid,
      email,
      name,
      phone,
      address: address || '',
      role,
      emailVerified: true,
    });

    res.status(201).json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function updateUserStatus(req, res) {
  try {
    const { status } = req.body;
    const user = await User.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function updateUserRole(req, res) {
  try {
    const { role } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    user.role = role || user.role;
    await user.save();

    const admin = getFirebaseAdmin();
    if (admin) {
      await admin.auth().setCustomUserClaims(user.firebaseUid, { role: user.role });
    }

    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
