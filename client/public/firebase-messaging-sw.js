/* Firebase Messaging background worker. Configuration is supplied in the registration URL. */
importScripts('https://www.gstatic.com/firebasejs/12.18.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.18.0/firebase-messaging-compat.js');

const config = Object.fromEntries(new URL(self.location.href).searchParams.entries());
firebase.initializeApp(config);

firebase.messaging().onBackgroundMessage((payload) => {
  const notification = payload.notification || {};
  self.registration.showNotification(notification.title || 'Anyareport notification', {
    body: notification.body || 'You have a new Anyareport update.',
    icon: '/favicon.svg',
    data: payload.data || {},
    tag: payload.data?.notificationId || undefined,
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const reportId = event.notification.data?.reportId;
  const role = event.notification.data?.recipientRole;
  const basePath =
    role === 'resident'
      ? '/resident/reports'
      : ['tanod', 'responder'].includes(role)
        ? '/responder/incidents'
        : '/admin/incidents';
  const notificationsPath =
    role === 'resident'
      ? '/resident/notifications'
      : ['tanod', 'responder'].includes(role)
        ? '/responder/notifications'
        : '/admin/notifications';
  const url = reportId
    ? `${basePath}/${encodeURIComponent(reportId)}`
    : notificationsPath;
  event.waitUntil(clients.openWindow(url));
});
