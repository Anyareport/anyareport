import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Spin } from 'antd';
import { ProtectedRoute, PublicRoute } from './routes/ProtectedRoute';
import { useAuth, getRedirectPath } from './contexts/AuthContext';
import ResidentShell from './layouts/ResidentShell';
import ResponderShell from './layouts/ResponderShell';
import AdminShell from './layouts/AdminShell';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';
import LandingPage from './pages/resident/LandingPage';
import SubmitReportPage from './pages/resident/SubmitReportPage';
import MyReportsPage from './pages/resident/MyReportsPage';
import ReportDetailPage from './pages/resident/ReportDetailPage';
import NotificationsPage from './pages/shared/NotificationsPage';
import ProfilePage from './pages/shared/ProfilePage';
import ResponderDashboardPage from './pages/responder/DashboardPage';
import ResponderAlertsPage from './pages/responder/AlertsPage';
import ResponderRoutingPage from './pages/responder/RoutingPage';
import ResponderHistoryPage from './pages/responder/HistoryPage';
import IncidentDetailPage from './pages/shared/IncidentDetailPage';
import AdminDashboardPage from './pages/admin/DashboardPage';
import AdminIncidentsPage from './pages/admin/IncidentsPage';
import AdminMapPage from './pages/admin/MapPage';
import AdminHeatmapPage from './pages/admin/HeatmapPage';
import AdminAnalyticsPage from './pages/admin/AnalyticsPage';
import AdminAuditLogPage from './pages/admin/AuditLogPage';
import AdminUsersPage from './pages/admin/UsersPage';
import AdminExportPage from './pages/admin/ExportPage';
import SecretaryIntakePage from './pages/admin/IntakeQueuePage';

function HomeRedirect() {
  const { firebaseUser, loading, role } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!firebaseUser) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (!role) {
    return <Navigate to="/register" replace />;
  }

  return <Navigate to={getRedirectPath(role)} replace />;
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomeRedirect />} />

      <Route element={<PublicRoute />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      </Route>

      <Route element={<ProtectedRoute allowedRoles={['resident']} />}>
        <Route element={<ResidentShell />}>
          <Route path="/resident" element={<LandingPage />} />
          <Route path="/resident/submit" element={<SubmitReportPage />} />
          <Route path="/resident/reports" element={<MyReportsPage />} />
          <Route path="/resident/reports/:id" element={<ReportDetailPage />} />
          <Route path="/resident/notifications" element={<NotificationsPage title="Resident Notifications" />} />
          <Route path="/resident/profile" element={<ProfilePage title="Resident Profile" />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute allowedRoles={['tanod', 'responder']} />}>
        <Route element={<ResponderShell />}>
          <Route path="/responder" element={<ResponderDashboardPage />} />
          <Route path="/responder/alerts" element={<ResponderAlertsPage />} />
          <Route path="/responder/routing" element={<ResponderRoutingPage />} />
          <Route path="/responder/history" element={<ResponderHistoryPage />} />
          <Route path="/responder/incidents/:id" element={<IncidentDetailPage variant="responder" />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute allowedRoles={['admin', 'captain', 'secretary', 'kagawad']} />}>
        <Route element={<AdminShell />}>
          <Route path="/admin" element={<AdminDashboardPage />} />
          <Route path="/admin/incidents" element={<AdminIncidentsPage />} />
          <Route path="/admin/incidents/:id" element={<IncidentDetailPage variant="admin" />} />
          <Route path="/admin/map" element={<AdminMapPage />} />
          <Route path="/admin/heatmap" element={<AdminHeatmapPage />} />
          <Route path="/admin/analytics" element={<AdminAnalyticsPage />} />
          <Route path="/admin/audit" element={<AdminAuditLogPage />} />
          <Route path="/admin/export" element={<AdminExportPage />} />
          <Route path="/admin/intake" element={<SecretaryIntakePage />} />
          <Route path="/admin/users" element={<AdminUsersPage />} />
          <Route path="/admin/notifications" element={<NotificationsPage title="Official Notifications" />} />
          <Route path="/admin/profile" element={<ProfilePage title="Official Profile" />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
