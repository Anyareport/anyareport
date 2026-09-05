import User from '../models/User.js';
import { getFirebaseAdmin } from '../config/firebase.js';
import { isDisposableEmail } from '../services/disposableEmail.js';

export async function registerProfile(req, res) {
  try {
    const { name, phone, address, email } = req.body;
    const uid = req.firebaseUser.uid;

    if (!name || !phone) {
      return res.status(400).json({ error: 'Name and phone are required' });
    }

    if (email && isDisposableEmail(email)) {
      return res.status(400).json({ error: 'Disposable email addresses are not allowed' });
    }

    const userEmail = email || req.firebaseUser.email;
    if (userEmail && isDisposableEmail(userEmail)) {
      return res.status(400).json({ error: 'Disposable email addresses are not allowed' });
    }

    const existing = await User.findOne({ firebaseUid: uid });
    if (existing) {
      existing.name = name;
      existing.phone = phone;
      existing.address = address || existing.address;
      existing.emailVerified = req.firebaseUser.email_verified || false;
      await existing.save();
      return res.json(existing);
    }

    const user = await User.create({
      firebaseUid: uid,
      email: userEmail,
      name,
      phone,
      address: address || '',
      role: 'resident',
      emailVerified: req.firebaseUser.email_verified || false,
    });

    const admin = getFirebaseAdmin();
    if (admin) {
      await admin.auth().setCustomUserClaims(uid, { role: 'resident', committee: null });
    }

    res.status(201).json(user);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: 'User already registered' });
    }
    res.status(500).json({ error: err.message });
  }
}

export async function getProfile(req, res) {
  try {
    let profile = req.userProfile;
    if (!profile) {
      profile = await User.findOne({ firebaseUid: req.firebaseUser.uid });
    }
    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }
    res.json(profile);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function updateProfile(req, res) {
  try {
    const { name, phone, address } = req.body;
    const profile = await User.findOne({ firebaseUid: req.firebaseUser.uid });
    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    if (name) profile.name = name;
    if (phone) profile.phone = phone;
    if (address !== undefined) profile.address = address;
    profile.emailVerified = req.firebaseUser.email_verified || profile.emailVerified;
    await profile.save();
    res.json(profile);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function syncClaims(req, res) {
  try {
    const profile = await User.findOne({ firebaseUid: req.firebaseUser.uid });
    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    const admin = getFirebaseAdmin();
    if (admin) {
      await admin.auth().setCustomUserClaims(profile.firebaseUid, {
        role: profile.role,
        committee: profile.committee,
      });
    }

    res.json({ role: profile.role, committee: profile.committee });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
