import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import VerifyEmailGate from '../components/VerifyEmailGate';
import LoadingState from '../components/LoadingState';

interface ProtectedRouteProps {
  allowedRoles?: string[];
  redirectTo?: string;
}

export function ProtectedRoute({ allowedRoles, redirectTo = '/login' }: ProtectedRouteProps) {
  const { firebaseUser, profile, loading, role } = useAuth();

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

  // Officials with an unverified email cannot see any data until they confirm it.
  if (profile && profile.role !== 'resident' && !profile.emailVerified) {
    return <VerifyEmailGate />;
  }

  return <Outlet />;
}

export function PublicRoute() {
  const { firebaseUser, loading, role } = useAuth();

  if (loading) {
    return <LoadingState minHeight="100vh" />;
  }

  if (firebaseUser && role) {
    const path = role === 'resident' ? '/resident' : ['tanod', 'responder'].includes(role) ? '/responder' : '/admin';
    return <Navigate to={path} replace />;
  }

  return <Outlet />;
}