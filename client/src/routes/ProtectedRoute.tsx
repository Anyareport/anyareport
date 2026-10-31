import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import VerifyEmailGate from '../components/VerifyEmailGate';
import LoadingState from '../components/LoadingState';
import { getProfilePath } from '../lib/roles';

interface ProtectedRouteProps {
  allowedRoles?: string[];
  redirectTo?: string;
}

export function ProtectedRoute({ allowedRoles, redirectTo = '/login' }: ProtectedRouteProps) {
  const { firebaseUser, profile, loading, role } = useAuth();
  const location = useLocation();

  if (loading) {
    return <LoadingState minHeight="100vh" />;
  }

  if (!firebaseUser) {
    return <Navigate to={redirectTo} replace />;
  }

  if (allowedRoles && role && !allowedRoles.includes(role)) {
    const fallback = role === 'resident' ? '/resident' : role === 'tanod' || role === 'responder' ? '/responder' : '/admin';
    return <Navigate to={fallback} replace />;
  }

  if (!profile && firebaseUser) {
    return <Navigate to="/register" replace />;
  }

  const profilePath = getProfilePath(profile?.role);
  if (profile?.status === 'suspended' && location.pathname !== profilePath) {
    return <Navigate to={profilePath} replace />;
  }

  // Officials with an unverified email cannot see any data until they confirm it.
  if (
    profile &&
    profile.role !== 'resident' &&
    !profile.emailVerified &&
    profile.status !== 'suspended'
  ) {
    return <VerifyEmailGate />;
  }

  return <Outlet />;
}

export function PublicRoute() {
  const { firebaseUser, profile, loading, role } = useAuth();

  if (loading) {
    return <LoadingState minHeight="100vh" />;
  }

  if (firebaseUser && role) {
    if (profile?.status === 'suspended') {
      return <Navigate to={getProfilePath(role)} replace />;
    }
    const path = role === 'resident' ? '/resident' : ['tanod', 'responder'].includes(role) ? '/responder' : '/admin';
    return <Navigate to={path} replace />;
  }

  return <Outlet />;
}