import 'dotenv/config';
import { initFirebase, getFirebaseAdmin } from '../config/firebase.js';
import User from '../models/User.js';

const OFFICIALS = [
  { email: 'admin@anyareport.local', password: 'Admin123!', name: 'System Admin', phone: '09191234567', role: 'admin' },
  { email: 'captain@anyareport.local', password: 'Captain123!', name: 'Barangay Captain', phone: '09201234567', role: 'captain' },
  { email: 'secretary@anyareport.local', password: 'Secretary123!', name: 'Barangay Secretary', phone: '09211234567', role: 'secretary' },
  { email: 'kagawad.po@anyareport.local', password: 'Kagawad123!', name: 'Kagawad Peace & Order', phone: '09221234567', role: 'kagawad', committee: 'Peace and Order' },
  { email: 'tanod@anyareport.local', password: 'Tanod123!', name: 'Tanod Officer', phone: '09241234567', role: 'tanod' },
  { email: 'responder@anyareport.local', password: 'Responder123!', name: 'Emergency Responder', phone: '09251234567', role: 'responder' },
];

async function seedOfficials() {
  initFirebase();
  const admin = getFirebaseAdmin();

  if (!admin) {
    console.warn('[Seed Officials] Firebase Admin SDK not configured — skipping.');
    console.warn('Set FIREBASE_ADMIN_SDK_KEY in server/.env and run again.');
    process.exit(0);
  }

  for (const official of OFFICIALS) {
    try {
      let firebaseUser;
      try {
        firebaseUser = await admin.auth().getUserByEmail(official.email);
        console.log(`[Seed Officials] ${official.email} already exists in Firebase`);
      } catch {
        firebaseUser = await admin.auth().createUser({
          email: official.email,
          password: official.password,
          displayName: official.name,
          emailVerified: true,
        });
        console.log(`[Seed Officials] Created Firebase user: ${official.email}`);
      }

      await admin.auth().setCustomUserClaims(firebaseUser.uid, {
        role: official.role,
        committee: official.committee || null,
      });

      await User.findOneAndUpdate(
        { email: official.email },
        {
          firebaseUid: firebaseUser.uid,
          email: official.email,
          name: official.name,
          phone: official.phone,
          role: official.role,
          committee: official.committee || null,
          emailVerified: true,
          status: 'active',
        },
        { upsert: true }
      );
    } catch (err) {
      console.error(`[Seed Officials] Failed for ${official.email}:`, err.message);
    }
  }

  console.log('[Seed Officials] Done!');
  process.exit(0);
}

seedOfficials();
