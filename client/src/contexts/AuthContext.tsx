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
import { auth } from '../lib/firebase';
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
      if (p.role) getSocket();
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

  const role = profile?.role || null;

  useEffect(() => {
    if (!role) return;

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
          ? `${getReportBasePath(role)}/${encodeURIComponent(payload.data.reportId)}`
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
        title: notification.urgent ? 'Urgent Anyareport alert' : 'New Anyareport notification',
        body: notification.message,
        tag: notification._id ? `anyareport-notification-${notification._id}` : undefined,
        url: notification.reportId
          ? `${getReportBasePath(role)}/${encodeURIComponent(notification.reportId)}`
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
  }, [installedPwa, queryClient, role]);

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
