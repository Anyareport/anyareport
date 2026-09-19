import { Layout, Menu, Button, Drawer, Grid } from 'antd';
import type { ItemType } from 'antd/es/menu/interface';
import { LogoutOutlined, MenuOutlined } from '@ant-design/icons';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useState } from 'react';
import Logo from '../components/Logo';
import ThemeToggle from '../components/ThemeToggle';
import { logout } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';

const { Header, Content, Sider } = Layout;
const { useBreakpoint } = Grid;

interface AppShellProps {
  menuItems: ItemType[];
  siderWidth?: number;
  roleLabel?: string;
  collapsible?: boolean;
}

export default function AppShell({
  menuItems,
  siderWidth = 220,
  roleLabel,
  collapsible = false,
}: AppShellProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const screens = useBreakpoint();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const { profile } = useAuth();

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
      {screens.md && (
        <Sider
          theme="light"
          width={siderWidth}
          collapsible={collapsible}
          collapsed={collapsed}
          onCollapse={setCollapsed}
          style={{
            position: 'sticky',
            top: 0,
            height: '100vh',
            overflow: 'auto',
            borderRight: '1px solid var(--border-default)',
          }}
        >
          <div style={{ padding: '16px 12px', textAlign: 'center' }}>
            <Logo size={collapsed ? 'sm' : 'md'} />
          </div>
          {menu}
        </Sider>
      )}

      <Layout>
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
            {!screens.md && <Logo size="sm" />}
            {roleLabel && (
              <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{roleLabel}</span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13 }}>{profile?.name}</span>
            <ThemeToggle />
            <Button type="text" icon={<LogoutOutlined />} onClick={handleLogout} />
          </div>
        </Header>

        <Content
          style={{
            margin: screens.md ? 24 : 16,
            minHeight: 280,
          }}
        >
          <Outlet />
        </Content>
      </Layout>

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        placement="left"
        styles={{ body: { padding: 0 } }}
      >
        <div style={{ padding: 16 }}>
          <Logo size="sm" />
        </div>
        {menu}
      </Drawer>
    </Layout>
  );
}
