import { Layout, Menu, Button, Drawer, Grid, Badge } from 'antd';
import {
  DashboardOutlined,
  AlertOutlined,
  HistoryOutlined,
  LogoutOutlined,
  MenuOutlined,
} from '@ant-design/icons';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Logo from '../components/Logo';
import ThemeToggle from '../components/ThemeToggle';
import { logout } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { api, type Report } from '../lib/api';

const { Header, Content } = Layout;
const { useBreakpoint } = Grid;

export default function ResponderShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const screens = useBreakpoint();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { profile } = useAuth();

  const { data: reports = [] } = useQuery({
    queryKey: ['responder-reports'],
    queryFn: () => api.get<Report[]>('/api/reports?status=verified'),
    refetchInterval: 30000,
  });

  const alertCount = reports.filter((r) => ['verified', 'en_route'].includes(r.status)).length;

  const menuItems = [
    { key: '/responder', icon: <DashboardOutlined />, label: 'Dashboard' },
    {
      key: '/responder/alerts',
      icon: <AlertOutlined />,
      label: (
        <span>
          Alerts <Badge count={alertCount} size="small" offset={[8, 0]} />
        </span>
      ),
    },
    { key: '/responder/history', icon: <HistoryOutlined />, label: 'History' },
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
    <Layout style={{ minHeight: '100vh' }}>
      <Header
        style={{
          background: 'var(--bg-primary)',
          padding: '0 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid var(--border-default)',
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
          <span style={{ color: 'var(--text-secondary)', fontSize: 12, marginLeft: 8 }}>
            RESPONDER
          </span>
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

      <Layout>
        {screens.md && (
          <Layout.Sider
            width={200}
            style={{
              background: 'var(--bg-secondary)',
              position: 'sticky',
              top: 64,
              height: 'calc(100vh - 64px)',
              overflow: 'auto',
              borderRight: '1px solid var(--border-default)',
            }}
          >
            {menu}
          </Layout.Sider>
        )}
        <Content style={{ padding: screens.md ? 24 : 16, background: 'var(--bg-secondary)' }}>
          <Outlet />
        </Content>
      </Layout>

      {/* <Footer
        style={{
          textAlign: 'center',
          background: 'var(--bg-primary)',
          color: 'var(--text-secondary)',
          padding: '12px',
          borderTop: '1px solid var(--border-default)',
        }}
      >
        Field Responder Interface
      </Footer> */}

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        placement="left"
        styles={{ body: { padding: 0, background: 'var(--bg-secondary)' } }}
      >
        {menu}
      </Drawer>
    </Layout>
  );
}
