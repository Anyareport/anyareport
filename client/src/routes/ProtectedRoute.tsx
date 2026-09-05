import { Navigate, Outlet } from 'react-router-dom';
import { Spin } from 'antd';
import { useAuth } from '../contexts/AuthContext';

interface ProtectedRouteProps {
  allowedRoles?: string[];
  redirectTo?: string;
}

export function ProtectedRoute({ allowedRoles, redirectTo = '/login' }: ProtectedRouteProps) {
  const { firebaseUser, profile, loading, role } = useAuth();

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size="large" />
      </div>
    );
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

  return <Outlet />;
}

export function PublicRoute() {
  const { firebaseUser, loading, role } = useAuth();

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (firebaseUser && role) {
    const path = role === 'resident' ? '/resident' : ['tanod', 'responder'].includes(role) ? '/responder' : '/admin';
    return <Navigate to={path} replace />;
  }

  return <Outlet />;
}
