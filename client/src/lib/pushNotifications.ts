import { getToken, isSupported, onMessage } from 'firebase/messaging';
import { api } from './api';
import { getFirebaseMessaging } from './firebase';

const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;

export async function registerPushToken() {
  if (!window.isSecureContext && window.location.hostname !== 'localhost') {
    throw new Error('Push notifications require an HTTPS site on mobile.');
  }
  if (!vapidKey) throw new Error('VITE_FIREBASE_VAPID_KEY is not configured.');
  if (!(await isSupported())) {
    throw new Error('This browser does not support Firebase web push.');
  }

  const messaging = await getFirebaseMessaging();
  if (!messaging || !('Notification' in window)) {
    throw new Error('Firebase Messaging is unavailable in this browser.');
  }

  if (Notification.permission !== 'granted') {
    throw new Error('Browser notification permission was not granted.');
  }

  const registration = await navigator.serviceWorker.register(
    `/firebase-messaging-sw.js?apiKey=${encodeURIComponent(import.meta.env.VITE_FIREBASE_API_KEY)}&authDomain=${encodeURIComponent(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN)}&projectId=${encodeURIComponent(import.meta.env.VITE_FIREBASE_PROJECT_ID)}&storageBucket=${encodeURIComponent(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET)}&messagingSenderId=${encodeURIComponent(import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID)}&appId=${encodeURIComponent(import.meta.env.VITE_FIREBASE_APP_ID)}`,
    { scope: '/firebase-cloud-messaging-push-scope' }
  );
  await registration.update();
  if (registration.installing) {
    await new Promise<void>((resolve, reject) => {
      const worker = registration.installing;
      if (!worker) {
        resolve();
        return;
      }
      const handleStateChange = () => {
        if (worker.state === 'activated') {
          worker.removeEventListener('statechange', handleStateChange);
          resolve();
        } else if (worker.state === 'redundant') {
          worker.removeEventListener('statechange', handleStateChange);
          reject(new Error('Firebase messaging service worker failed to activate.'));
        }
      };
      worker.addEventListener('statechange', handleStateChange);
    });
  }

  let token: string;
  try {
    token = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration: registration,
    });
  } catch (error) {
    const code = (error as { code?: string }).code;
    throw new Error(
      `Firebase push registration failed${code ? ` (${code})` : ''}: ${
        error instanceof Error ? error.message : 'unknown error'
      }`
    );
  }
  if (!token) throw new Error('Firebase did not return a device token.');

  await api.post('/api/notifications/push-tokens', { token });
  return true;
}

export interface PushMessagePayload {
  notification?: {
    title?: string;
    body?: string;
  };
  data?: {
    notificationId?: string;
    reportId?: string;
    recipientRole?: string;
  };
}

export async function startForegroundPushNotifications(
  onMessageReceived: (payload: PushMessagePayload) => void
) {
  if (!(await isSupported())) return () => {};
  const messaging = await getFirebaseMessaging();
  return messaging ? onMessage(messaging, onMessageReceived) : () => {};
}
