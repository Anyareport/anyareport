import { getFirebaseAdmin } from '../config/firebase.js';
import User from '../models/User.js';

export async function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }

  const token = authHeader.split('Bearer ')[1];
  const admin = getFirebaseAdmin();

  if (!admin) {
    return res.status(503).json({ error: 'Auth service unavailable — configure Firebase Admin SDK' });
  }

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    req.firebaseUser = decoded;
    req.userRole = decoded.role || 'resident';
    req.userCommittee = decoded.committee || null;

    const profile = await User.findOne({ firebaseUid: decoded.uid });
    req.userProfile = profile;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function optionalVerifyToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return next();
  }
  return verifyToken(req, res, next);
}
