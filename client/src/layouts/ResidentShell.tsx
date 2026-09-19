import { Layout, Menu, Button, Drawer, Grid, Badge } from 'antd';
import {
  HomeOutlined,
  FileAddOutlined,
  UnorderedListOutlined,
  BellOutlined,
  UserOutlined,
  MenuOutlined,
  LogoutOutlined,
} from '@ant-design/icons';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Logo from '../components/Logo';
import ThemeToggle from '../components/ThemeToggle';
import { logout } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { api, type Notification } from '../lib/api';

const { Header, Content, Footer } = Layout;
const { useBreakpoint } = Grid;

export default function ResidentShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const screens = useBreakpoint();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { profile } = useAuth();
  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get<Notification[]>('/api/notifications'),
    staleTime: 30_000,
  });
  const unreadCount = notifications.filter((notification) => !notification.read).length;

  const menuItems = [
    { key: '/resident', icon: <HomeOutlined />, label: 'Home' },
    { key: '/resident/submit', icon: <FileAddOutlined />, label: 'Report Incident' },
    { key: '/resident/reports', icon: <UnorderedListOutlined />, label: 'My Reports' },
    {
      key: '/resident/notifications',
      icon: <BellOutlined />,
      label: (
        <Badge count={unreadCount} offset={[8, 0]}>
          Notifications
        </Badge>
      ),
    },
    { key: '/resident/profile', icon: <UserOutlined />, label: 'Profile' },
  ];

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const menu = (
    <Menu
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
    <Layout style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header
        style={{
          background: 'var(--bg-primary)',
          padding: '0 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid var(--border-default)',
          position: 'sticky',
          top: 0,
          zIndex: 1000,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {!screens.md && (
            <Button
              type="text"
              icon={<MenuOutlined style={{ color: 'var(--text-primary)' }} />}
              onClick={() => setDrawerOpen(true)}
            />
          )}
          <Logo light size="sm" />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: 'var(--text-primary)', fontSize: 13 }}>{profile?.name}</span>
          <ThemeToggle />
          <Button
            type="text"
            icon={<LogoutOutlined style={{ color: 'var(--text-primary)' }} />}
            onClick={handleLogout}
          />
        </div>
      </Header>

      <Layout style={{ height: 'calc(100vh - 64px)', overflow: 'hidden', flex: 1 }}>
        {screens.md && (
          <Layout.Sider
            width={220}
            style={{
              background: 'var(--bg-secondary)',
              position: 'sticky',
              top: 64,
              height: 'calc(100vh - 64px)',
              overflow: 'hidden',
              borderRight: '1px solid var(--border-default)',
            }}
          >
            {menu}
          </Layout.Sider>
        )}
        <Content
          style={{
            padding: screens.md ? 24 : 16,
            background: 'var(--bg-secondary)',
            overflowY: 'auto',
            height: '100%',
          }}
        >
          <Outlet />
        </Content>
      </Layout>

      {/* <Footer
        style={{
          textAlign: 'center',
          background: 'var(--bg-primary)',
          color: 'var(--text-secondary)',
          padding: screens.md ? '12px' : '8px 12px',
          borderTop: '1px solid var(--border-default)',
          fontSize: screens.md ? 14 : 11,
          lineHeight: 1.4,
        }}
      >
        {screens.md ? (
          '© 2026 Anyareport. All Rights Reserved. | Barangay Don Mariano Marcos, Nueva Vizcaya'
        ) : (
          <>
            © 2026 Anyareport. All Rights Reserved.
            <br />
            Barangay Don Mariano Marcos, Nueva Vizcaya
          </>
        )}
      </Footer> */}

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        placement="left"
        styles={{ body: { padding: 0, background: 'var(--bg-secondary)' } }}
      >
        <div style={{ padding: 16 }}>
          <Logo light size="sm" />
        </div>
        {menu}
      </Drawer>
    </Layout>
  );
}
