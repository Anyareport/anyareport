import { Layout, Menu, Button, Drawer, Grid, Badge } from 'antd';
import {
  DashboardOutlined,
  UnorderedListOutlined,
  EnvironmentOutlined,
  HeatMapOutlined,
  BarChartOutlined,
  AuditOutlined,
  TeamOutlined,
  ExportOutlined,
  InboxOutlined,
  BellOutlined,
  UserOutlined,
  LogoutOutlined,
  MenuOutlined,
} from '@ant-design/icons';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import Logo from '../components/Logo';
import { logout } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { api, type Notification, type Report } from '../lib/api';

const { Header, Sider, Content } = Layout;
const { useBreakpoint } = Grid;

export default function AdminShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const screens = useBreakpoint();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const { profile, role } = useAuth();

  const { data: notifications = [] } = useQuery({
    queryKey: ['admin-notifications'],
    queryFn: () => api.get<Notification[]>('/api/notifications'),
    refetchInterval: 30000,
  });

  const { data: pendingReports = [] } = useQuery({
    queryKey: ['pending-reports'],
    queryFn: () => api.get<Report[]>('/api/reports?status=pending'),
    enabled: role === 'secretary',
    refetchInterval: 30000,
  });

  const unreadCount = notifications.filter((n) => !n.read).length;

  const menuItems = useMemo(() => {
    const items = [
      { key: '/admin', icon: <DashboardOutlined />, label: 'Dashboard' },
      { key: '/admin/incidents', icon: <UnorderedListOutlined />, label: 'Incidents' },
      { key: '/admin/map', icon: <EnvironmentOutlined />, label: 'Map View' },
      { key: '/admin/heatmap', icon: <HeatMapOutlined />, label: 'Safety Heatmap' },
      { key: '/admin/analytics', icon: <BarChartOutlined />, label: 'Analytics' },
      {
        key: '/admin/notifications',
        icon: <BellOutlined />,
        label: (
          <span>
            Notifications <Badge count={unreadCount} size="small" offset={[8, 0]} />
          </span>
        ),
      },
      { key: '/admin/export', icon: <ExportOutlined />, label: 'Export' },
      { key: '/admin/profile', icon: <UserOutlined />, label: 'Profile' },
    ];

    if (role === 'secretary') {
      items.splice(2, 0, {
        key: '/admin/intake',
        icon: <InboxOutlined />,
        label: (
          <span>
            Intake Queue <Badge count={pendingReports.length} size="small" offset={[8, 0]} />
          </span>
        ),
      });
    }

    if (role === 'admin') {
      items.push({ key: '/admin/users', icon: <TeamOutlined />, label: 'User Management' });
    }

    if (['admin', 'captain', 'secretary', 'kagawad'].includes(role || '')) {
      items.splice(items.length - 2, 0, {
        key: '/admin/audit',
        icon: <AuditOutlined />,
        label: 'Audit Log',
      });
    }

    return items;
  }, [role, unreadCount, pendingReports.length]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const menu = (
    <Menu
      theme="dark"
      mode="inline"
      selectedKeys={[location.pathname]}
      items={menuItems}
      onClick={({ key }) => {
        navigate(key);
        setDrawerOpen(false);
      }}
    />
  );

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {screens.md ? (
        <Sider collapsible collapsed={collapsed} onCollapse={setCollapsed} width={240}>
          <div style={{ padding: '16px 12px', textAlign: 'center' }}>
            <Logo light size="sm" showIcon={!collapsed} />
          </div>
          {menu}
        </Sider>
      ) : null}

      <Layout>
        <Header style={{ background: '#fff', padding: '0 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #f0f0f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {!screens.md && (
              <Button icon={<MenuOutlined />} onClick={() => setDrawerOpen(true)} />
            )}
            {!screens.md && <Logo size="sm" />}
            <span style={{ color: '#666', fontSize: 13 }}>
              {role?.toUpperCase()} {profile?.committee ? `— ${profile.committee}` : ''}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13 }}>{profile?.name}</span>
            <Button type="text" icon={<LogoutOutlined />} onClick={handleLogout} />
          </div>
        </Header>

        <Content style={{ margin: screens.md ? 24 : 12, minHeight: 280 }}>
          <Outlet />
        </Content>
      </Layout>

      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} placement="left" styles={{ body: { padding: 0, background: '#282F49' } }}>
        <div style={{ padding: 16 }}>
          <Logo light size="sm" />
        </div>
        {menu}
      </Drawer>
    </Layout>
  );
}
