import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { api, type UserProfile } from '../lib/api';
import { getSocket, disconnectSocket } from '../lib/socket';
import { notificationFeedQueryKey } from '../lib/notificationFeed';
import { invalidateReportQueries, type ReportChangeEvent } from '../lib/reportUpdates';
import { showBrowserNotification } from '../lib/browserNotifications';

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

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

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

    const socket = getSocket();
    const handleNotification = (notification?: {
      _id?: string;
      message?: string;
      reportId?: string;
      urgent?: boolean;
    }) => {
      void queryClient.invalidateQueries({ queryKey: notificationFeedQueryKey });
      if (!notification?.message) return;

      const incidentPath = notification.reportId
        ? `/${['tanod', 'responder'].includes(role) ? 'responder/incidents' : role === 'resident' ? 'resident/reports' : 'admin/incidents'}/${encodeURIComponent(notification.reportId)}`
        : undefined;
      showBrowserNotification({
        title: notification.urgent ? 'Urgent Anyareport alert' : 'New Anyareport notification',
        body: notification.message,
        tag: notification._id ? `anyareport-notification-${notification._id}` : undefined,
        url: incidentPath,
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
      socket.off('notification', handleNotification);
      socket.off('report:changed', handleReportChange);
      socket.off('connect', handleReconnect);
    };
  }, [queryClient, role]);

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
