import { getToken, isSupported, onMessage } from 'firebase/messaging';
import { api } from './api';
import { getFirebaseMessaging } from './firebase';

const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;

export async function registerPushToken() {
  if (!vapidKey || !(await isSupported())) return false;

  const messaging = await getFirebaseMessaging();
  if (!messaging || !('Notification' in window)) return false;

  if (Notification.permission !== 'granted') return false;

  const registration = await navigator.serviceWorker.register(
    `/firebase-messaging-sw.js?apiKey=${encodeURIComponent(import.meta.env.VITE_FIREBASE_API_KEY)}&authDomain=${encodeURIComponent(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN)}&projectId=${encodeURIComponent(import.meta.env.VITE_FIREBASE_PROJECT_ID)}&storageBucket=${encodeURIComponent(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET)}&messagingSenderId=${encodeURIComponent(import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID)}&appId=${encodeURIComponent(import.meta.env.VITE_FIREBASE_APP_ID)}`,
    { scope: '/' }
  );
  const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: registration });
  if (!token) return false;

  await api.post('/api/notifications/push-tokens', { token });
  return true;
}

export async function startForegroundPushNotifications(onMessageReceived: () => void) {
  if (!(await isSupported())) return () => {};
  const messaging = await getFirebaseMessaging();
  return messaging ? onMessage(messaging, onMessageReceived) : () => {};
}
