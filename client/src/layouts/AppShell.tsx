import { Layout, Menu, Button, Drawer, Grid, Badge } from 'antd';
import type { ItemType } from 'antd/es/menu/interface';
import { LogoutOutlined, MenuOutlined } from '@ant-design/icons';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useState } from 'react';
import Logo from '../components/Logo';
import MobileBottomNavigation from '../components/MobileBottomNavigation';
import ThemeToggle from '../components/ThemeToggle';
import { logout } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';

const { Header, Content, Sider } = Layout;
const { useBreakpoint } = Grid;

interface AppShellProps {
  menuItems: ItemType[];
  mobileMenuItems?: ItemType[];
  menuBadgeCounts?: Record<string, number>;
  siderWidth?: number;
  roleLabel?: string;
  collapsible?: boolean;
  fullWidthContent?: boolean;
  mobileNavigation?: boolean;
  mobilePrimaryAction?: string;
}

export default function AppShell({
  menuItems,
  mobileMenuItems,
  menuBadgeCounts = {},
  siderWidth = 220,
  roleLabel,
  collapsible = false,
  fullWidthContent = false,
  mobileNavigation = false,
  mobilePrimaryAction,
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
      items={menuItems.map((item) => {
        if (!item || !('key' in item) || typeof item.key !== 'string' || !('label' in item)) {
          return item;
        }

        const count = menuBadgeCounts[item.key];
        return count === undefined
          ? item
          : {
              ...item,
              label: (
                <span>
                  {item.label} <Badge count={count} size="small" offset={[8, 0]} />
                </span>
              ),
            };
      })}
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
            padding: '0 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: fullWidthContent ? undefined : '1px solid var(--border-default)',
            position: fullWidthContent ? 'absolute' : 'sticky',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 1000,
            background: fullWidthContent ? 'transparent' : 'var(--bg-primary)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {!screens.md && !mobileNavigation && (
              <Button
                type="text"
                icon={<MenuOutlined style={{ color: 'var(--text-primary)' }} />}
                onClick={() => setDrawerOpen(true)}
              />
            )}
            {!screens.md && !fullWidthContent && <Logo size="sm" />}
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
            margin: fullWidthContent ? 0 : screens.md ? 24 : 16,
            height: fullWidthContent ? '100dvh' : undefined,
            minHeight: fullWidthContent ? 0 : 280,
            paddingBottom:
              mobileNavigation && !screens.md && !fullWidthContent
                ? 'var(--mobile-navigation-height)'
                : undefined,
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

      {mobileNavigation && !screens.md && (
        <MobileBottomNavigation
          menuItems={mobileMenuItems ?? menuItems}
          badgeCounts={menuBadgeCounts}
          currentPath={location.pathname}
          primaryAction={mobilePrimaryAction}
          onNavigate={navigate}
        />
      )}
    </Layout>
  );
}
