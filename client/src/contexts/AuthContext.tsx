import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { api, type UserProfile } from '../lib/api';
import { getSocket, disconnectSocket } from '../lib/socket';

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
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = useCallback(async () => {
    try {
      const p = await api.get<UserProfile>('/api/auth/profile');
      setProfile(p);
      if (p.role) getSocket(p.role);
    } catch {
      setProfile(null);
    }
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
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
        disconnectSocket();
      }
      setLoading(false);
    });
    return unsub;
  }, [refreshProfile]);

  const role = profile?.role || null;

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
