export type BrowserNotificationPermission = NotificationPermission | 'unsupported';

export function getBrowserNotificationPermission(): BrowserNotificationPermission {
  return typeof Notification === 'undefined' ? 'unsupported' : Notification.permission;
}

export async function requestBrowserNotificationPermission(): Promise<BrowserNotificationPermission> {
  if (typeof Notification === 'undefined') return 'unsupported';
  return Notification.requestPermission();
}

interface BrowserNotificationOptions {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

export function showBrowserNotification({
  title,
  body,
  url,
  tag,
}: BrowserNotificationOptions) {
  if (getBrowserNotificationPermission() !== 'granted') return;

  const notification = new Notification(title, { body, tag });
  if (url) {
    notification.onclick = () => {
      window.focus();
      window.location.assign(url);
    };
  }
}
