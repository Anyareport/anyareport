import admin from 'firebase-admin';
import { readFileSync } from 'fs';

let initialized = false;

export function initFirebase() {
  if (initialized) return admin;

  const keyEnv = process.env.FIREBASE_ADMIN_SDK_KEY;
  if (!keyEnv || keyEnv.includes('PLACEHOLDER')) {
    console.warn(
      '[Firebase] Admin SDK not configured. Auth verification will fail until FIREBASE_ADMIN_SDK_KEY is set.'
    );
    return null;
  }

  try {
    let credential;
    if (keyEnv.trim().startsWith('{')) {
      credential = admin.credential.cert(JSON.parse(keyEnv));
    } else {
      const serviceAccount = JSON.parse(readFileSync(keyEnv, 'utf8'));
      credential = admin.credential.cert(serviceAccount);
    }

    admin.initializeApp({ credential });
    initialized = true;
    console.log('[Firebase] Admin SDK initialized');
    return admin;
  } catch (err) {
    console.error('[Firebase] Admin SDK init failed:', err.message);
    return null;
  }
}

export function getFirebaseAdmin() {
  return initialized ? admin : null;
}
