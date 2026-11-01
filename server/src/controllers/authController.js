import User from '../models/User.js';
import { getFirebaseAdmin } from '../config/firebase.js';
import { isDisposableEmail } from '../services/disposableEmail.js';
import { getUsernameByUid as lookupUsernameByUid } from '../services/userLookup.js';
import { PH_MOBILE_REGEX } from '../services/phone.js';

export async function registerProfile(req, res) {
  try {
    if (req.body?.consent !== true) {
      return res.status(400).json({ error: 'Privacy acknowledgement is required' });
    }

    const { name, phone, address, email } = req.body || {};
    const uid = req.firebaseUser.uid;
    const cleanName = typeof name === 'string' ? name.trim() : '';
    const cleanPhone = typeof phone === 'string' ? phone.trim() : '';

    if (!cleanName || !cleanPhone) {
      return res.status(400).json({ error: 'Name and phone are required' });
    }
    if (!PH_MOBILE_REGEX.test(cleanPhone)) {
      return res.status(400).json({ error: 'Phone must use the format 09XXXXXXXXX' });
    }

    const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    if (cleanEmail && isDisposableEmail(cleanEmail)) {
      return res.status(400).json({ error: 'Disposable email addresses are not allowed' });
    }

    const userEmail = cleanEmail || req.firebaseUser.email?.trim().toLowerCase();
    if (userEmail && isDisposableEmail(userEmail)) {
      return res.status(400).json({ error: 'Disposable email addresses are not allowed' });
    }

    const existing = await User.findOne({ firebaseUid: uid });
    const phoneInUse = await User.exists({ phone: cleanPhone, firebaseUid: { $ne: uid } });
    if (phoneInUse) {
      return res.status(409).json({ error: 'That phone number is already registered.' });
    }
    if (existing) {
      existing.name = cleanName;
      existing.phone = cleanPhone;
      existing.address =
        typeof address === 'string' && address.trim() ? address.trim() : existing.address;
      existing.emailVerified = req.firebaseUser.email_verified || false;
      await existing.save();
      return res.json(existing);
    }

    const user = await User.create({
      firebaseUid: uid,
      email: userEmail,
      name: cleanName,
      phone: cleanPhone,
      address: typeof address === 'string' ? address.trim() : '',
      role: 'resident',
      emailVerified: req.firebaseUser.email_verified || false,
    });

    const admin = getFirebaseAdmin();
    if (admin) {
      await admin.auth().setCustomUserClaims(uid, { role: 'resident' });
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
    const { name, phone, address } = req.body || {};
    const cleanName = typeof name === 'string' ? name.trim() : '';
    const cleanPhone = typeof phone === 'string' ? phone.trim() : '';

    if (name !== undefined && !cleanName) {
      return res.status(400).json({ error: 'Name cannot be empty' });
    }
    if (phone !== undefined && !PH_MOBILE_REGEX.test(cleanPhone)) {
      return res.status(400).json({ error: 'Phone must use the format 09XXXXXXXXX' });
    }

    const profile = await User.findOne({ firebaseUid: req.firebaseUser.uid });
    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    if (
      phone !== undefined &&
      (await User.exists({ phone: cleanPhone, firebaseUid: { $ne: req.firebaseUser.uid } }))
    ) {
      return res.status(409).json({ error: 'That phone number is already registered.' });
    }

    if (name !== undefined) profile.name = cleanName;
    if (phone !== undefined) profile.phone = cleanPhone;
    if (address !== undefined) {
      profile.address = typeof address === 'string' ? address.trim() : address;
    }
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

    // Sync emailVerified from the Firebase token on every claims sync
    if (req.firebaseUser.email_verified && !profile.emailVerified) {
      profile.emailVerified = true;
      await profile.save();
    }

    const admin = getFirebaseAdmin();
    if (admin) {
      await admin.auth().setCustomUserClaims(profile.firebaseUid, {
        role: profile.role,
      });
    }

    res.json({ role: profile.role });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function getUsernameByUid(req, res) {
  try {
    const firebaseUid = req.query.uid;
    if (!firebaseUid) {
      return res.status(400).json({ error: 'Firebase UID is required' });
    }

    const username = await lookupUsernameByUid(firebaseUid);
    if (!username) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ username });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}