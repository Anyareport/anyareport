import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth';
import { auth, sendVerificationEmail } from '../lib/firebase';
import { api, type UserProfile } from '../lib/api';
import { getSocket, disconnectSocket } from '../lib/socket';
import { notificationFeedQueryKey } from '../lib/notificationFeed';
import { invalidateReportQueries, type ReportChangeEvent } from '../lib/reportUpdates';
import { showBrowserNotification } from '../lib/browserNotifications';
import {
  registerPushToken,
  startForegroundPushNotifications,
  type PushMessagePayload,
} from '../lib/pushNotifications';

interface AuthContextType {
  firebaseUser: FirebaseUser | null;
  profile: UserProfile | null;
  loading: boolean;
  role: string | null;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  firebaseUser: null,
  profile: null,
  loading: true,
  role: null,
  refreshProfile: async () => {},
});

const pwaInstalledStorageKey = 'anyareport:pwa-installed';

function isStandaloneApp() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function hasInstalledPwa() {
  try {
    return localStorage.getItem(pwaInstalledStorageKey) === 'true';
  } catch {
    return false;
  }
}

function getReportBasePath(role: string) {
  if (role === 'resident') return '/resident/reports';
  if (role === 'tanod' || role === 'responder') return '/responder/incidents';
  return '/admin/incidents';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const displayedNotificationIds = useRef(new Set<string>());
  const [installedPwa, setInstalledPwa] = useState(() => isStandaloneApp() || hasInstalledPwa());

  useEffect(() => {
    const markPwaInstalled = () => {
      try {
        localStorage.setItem(pwaInstalledStorageKey, 'true');
      } catch {
        // Notification routing still works for the standalone window.
      }
      setInstalledPwa(true);
    };

    if (isStandaloneApp()) {
      markPwaInstalled();
    }

    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === pwaInstalledStorageKey) {
        setInstalledPwa(event.newValue === 'true');
      }
    };
    window.addEventListener('appinstalled', markPwaInstalled);
    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('appinstalled', markPwaInstalled);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const refreshProfile = useCallback(async () => {
    try {
      const p = await api.get<UserProfile>('/api/auth/profile');
      setProfile(p);
      if (p.status === 'active' && p.role && (p.role === 'resident' || p.emailVerified)) {
        getSocket();
      }
    } catch {
      setProfile(null);
    }
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      disconnectSocket();
      setFirebaseUser(user);
      if (user) {
        try {
          await api.post('/api/auth/sync-claims');
          await refreshProfile();
        } catch {
          setProfile(null);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return unsub;
  }, [refreshProfile]);

  useEffect(() => {
    if (!firebaseUser) return;
    const refreshAccountStatus = () => {
      void refreshProfile();
    };
    const intervalId = window.setInterval(refreshAccountStatus, 30_000);
    window.addEventListener('focus', refreshAccountStatus);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', refreshAccountStatus);
    };
  }, [firebaseUser, refreshProfile]);

  // Officials are created by an admin with an unverified email. Send the
  // verification email once, the first time they log in.
  useEffect(() => {
    if (!firebaseUser || !profile || profile.role === 'resident' || firebaseUser.emailVerified) {
      return;
    }
    const key = `anyareport:verification-sent:${firebaseUser.uid}`;
    try {
      if (localStorage.getItem(key)) return;
      localStorage.setItem(key, 'true');
    } catch {
      return;
    }
    void sendVerificationEmail(firebaseUser).catch(() => {
      try {
        localStorage.removeItem(key);
      } catch {
        // They can still resend it from the profile page.
      }
    });
  }, [firebaseUser, profile]);

  const role = profile?.role || null;
  // Unverified officials get no live data: no socket and no push registration.
  const accessRole =
    profile?.status === 'active' && (profile.role === 'resident' || profile.emailVerified)
      ? profile.role
      : null;

  useEffect(() => {
    if (!accessRole) return;

    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      void registerPushToken().catch((error) => {
        console.error('[Push] Automatic registration failed:', error);
      });
    }

    const socket = getSocket();
    let stopForegroundPush = () => {};
    let disposed = false;
    const handleForegroundPush = (payload: PushMessagePayload) => {
      const notificationId = payload.data?.notificationId;
      if (notificationId && displayedNotificationIds.current.has(notificationId)) return;

      void queryClient.invalidateQueries({ queryKey: notificationFeedQueryKey });
      const title = payload.notification?.title || 'New Anyareport notification';
      const body = payload.notification?.body;
      if (!body) return;
      if (notificationId) displayedNotificationIds.current.add(notificationId);
      if (installedPwa && !isStandaloneApp()) return;

      showBrowserNotification({
        title,
        body,
        tag: notificationId ? `anyareport-notification-${notificationId}` : undefined,
        url: payload.data?.reportId
          ? `${getReportBasePath(accessRole)}/${encodeURIComponent(payload.data.reportId)}`
          : undefined,
      });
    };
    void startForegroundPushNotifications(handleForegroundPush)
      .then((cleanup) => {
        if (disposed) {
          cleanup();
        } else {
          stopForegroundPush = cleanup;
        }
      })
      .catch((error) => {
        if (!disposed) {
          console.error('[Push] Foreground listener failed to start:', error);
        }
      });
    const handleNotification = (notification?: {
      _id?: string;
      type?: string;
      message?: string;
      reportId?: string;
      urgent?: boolean;
    }) => {
      if (notification?._id && displayedNotificationIds.current.has(notification._id)) {
        return;
      }

      void queryClient.invalidateQueries({ queryKey: notificationFeedQueryKey });
      if (!notification?.message) return;
      if (notification._id) displayedNotificationIds.current.add(notification._id);
      if (installedPwa && !isStandaloneApp()) return;

      showBrowserNotification({
        title:
          notification.type === 'public_emergency_resolved'
            ? 'Public emergency update'
            : notification.urgent
              ? 'Urgent Anyareport alert'
              : 'New Anyareport notification',
        body: notification.message,
        tag: notification._id ? `anyareport-notification-${notification._id}` : undefined,
        url: notification.reportId
          ? `${getReportBasePath(accessRole)}/${encodeURIComponent(notification.reportId)}`
          : undefined,
      });
    };
    const handleReportChange = (event: ReportChangeEvent) => {
      void invalidateReportQueries(queryClient, event.reportId);
    };
    const handleReconnect = () => {
      void invalidateReportQueries(queryClient);
    };

    socket.on('notification', handleNotification);
    socket.on('report:changed', handleReportChange);
    socket.on('connect', handleReconnect);
    if (socket.connected) handleReconnect();
    return () => {
      disposed = true;
      stopForegroundPush();
      socket.off('notification', handleNotification);
      socket.off('report:changed', handleReportChange);
      socket.off('connect', handleReconnect);
    };
  }, [installedPwa, queryClient, accessRole]);

  return (
    <AuthContext.Provider value={{ firebaseUser, profile, loading, role, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

export function getRedirectPath(role: string): string {
  switch (role) {
    case 'resident':
      return '/resident';
    case 'tanod':
    case 'responder':
      return '/responder';
    case 'admin':
    case 'captain':
    case 'secretary':
    case 'kagawad':
      return '/admin';
    default:
      return '/login';
  }
}