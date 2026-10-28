import { Avatar, Badge, Button, Drawer, Dropdown, Grid, Layout, Menu, Segmented } from 'antd';
import type { ItemType } from 'antd/es/menu/interface';
import {
  DownOutlined,
  DoubleLeftOutlined,
  DoubleRightOutlined,
  GlobalOutlined,
  LogoutOutlined,
  MenuOutlined,
  MoonOutlined,
  SunOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useState } from 'react';
import Logo from '../components/Logo';
import MobileBottomNavigation from '../components/MobileBottomNavigation';
import { logout } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { getRoleLabel } from '../lib/roles';
import { useTheme } from '../contexts/ThemeContext';
import { useLang } from '../contexts/LanguageContext';
import './AppShell.css';

const { Header, Content, Sider } = Layout;
const { useBreakpoint } = Grid;

interface AppShellProps {
  menuItems: ItemType[];
  mobileMenuItems?: ItemType[];
  menuBadgeCounts?: Record<string, number>;
  siderWidth?: number;
  collapsible?: boolean;
  fullWidthContent?: boolean;
  mobileNavigation?: boolean;
  mobilePrimaryAction?: string;
  quietBadgeKeys?: string[];
}

interface NavigationEntry {
  key: string;
  title: string;
}

function getNavigationEntries(items: ItemType[]): NavigationEntry[] {
  return items.flatMap((item) => {
    if (!item) return [];
    if ('children' in item && Array.isArray(item.children)) {
      return getNavigationEntries(item.children);
    }
    if (!('key' in item) || typeof item.key !== 'string' || !('label' in item)) return [];

    return [{ key: item.key, title: typeof item.label === 'string' ? item.label : '' }];
  });
}

function addMenuBadges(
  items: ItemType[],
  counts: Record<string, number>,
  quietBadgeKeys: string[]
): ItemType[] {
  return items.map((item) => {
    if (!item) return item;
    if ('children' in item && Array.isArray(item.children)) {
      return { ...item, children: addMenuBadges(item.children, counts, quietBadgeKeys) };
    }
    if (!('key' in item) || typeof item.key !== 'string' || !('label' in item)) return item;

    const count = counts[item.key];
    if (count === undefined) return item;

    return {
      ...item,
      label: (
        <span className="app-shell-menu-label">
          <span>{item.label}</span>
          <Badge count={count} size="small" overflowCount={99} color={'var(--brand-primary)'} />
        </span>
      ),
    };
  });
}

export default function AppShell({
  menuItems,
  mobileMenuItems,
  menuBadgeCounts = {},
  siderWidth = 220,
  collapsible = true,
  fullWidthContent = false,
  mobileNavigation = false,
  mobilePrimaryAction,
  quietBadgeKeys = [],
}: AppShellProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const screens = useBreakpoint();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const { profile, role } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { lang, setLang } = useLang();
  const showLanguageToggle = ['tanod', 'responder'].includes(role || '');
  const navigationEntries = getNavigationEntries(menuItems);
  const normalizedPath = location.pathname.replace(/\/$/, '') || '/';
  const isResidentMapPage =
    role === 'resident' &&
    ['/resident/map', '/resident/report', '/resident/submit'].includes(normalizedPath);
  const menuPath =
    normalizedPath === '/resident/report' || normalizedPath === '/resident/submit'
      ? '/resident/map'
      : normalizedPath;
  const activeEntry = navigationEntries
    .filter(({ key }) => menuPath === key || menuPath.startsWith(`${key}/`))
    .sort((first, second) => second.key.length - first.key.length)[0];
  const pageTitle =
    normalizedPath === '/resident/report' || normalizedPath === '/resident/submit'
      ? 'Report an incident'
      : /\/(incidents|reports)\/[^/]+$/.test(normalizedPath)
        ? 'Incident details'
        : activeEntry?.title || 'Dashboard';
  const profilePath =
    role === 'resident'
      ? '/resident/profile'
      : role === 'tanod' || role === 'responder'
        ? '/responder/profile'
        : '/admin/profile';
  const displayName = profile?.name || 'Account';
  const roleName = getRoleLabel(role);
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const decoratedMenuItems = addMenuBadges(menuItems, menuBadgeCounts, quietBadgeKeys);
  const accountMenuItems: ItemType[] = [
    { key: 'profile', icon: <UserOutlined />, label: 'Profile' },
    ...(showLanguageToggle
      ? [
          {
            key: 'language-toggle',
            icon: <GlobalOutlined />,
            className: 'app-shell-language-toggle-item',
            label: (
              <Segmented
                block
                size={screens.md ? 'small' : 'large'}
                aria-label="Language"
                value={lang}
                options={[
                  { label: 'English', value: 'en' },
                  { label: 'Filipino', value: 'fil' },
                ]}
                onChange={(value) => setLang(value as typeof lang)}
                onClick={(event) => event.stopPropagation()}
              />
            ),
          },
        ]
      : []),
    {
      key: 'theme',
      icon: theme === 'light' ? <MoonOutlined /> : <SunOutlined />,
      label: theme === 'light' ? 'Dark mode' : 'Light mode',
    },
    { type: 'divider' as const },
    { key: 'logout', icon: <LogoutOutlined />, label: 'Log out', danger: true },
  ];

  const menu = (
    <Menu
      className="app-shell-menu"
      mode="inline"
      selectedKeys={activeEntry ? [activeEntry.key] : []}
      items={decoratedMenuItems}
      onClick={({ key }) => {
        if (key.startsWith('/')) {
          navigate(key);
          setDrawerOpen(false);
        }
      }}
    />
  );

  return (
    <Layout className="app-shell" style={{ minHeight: '100vh' }}>
      {screens.md && (
        <Sider
          className="app-shell-sider"
          theme="light"
          width={siderWidth}
          collapsible={collapsible}
          collapsed={collapsed}
          collapsedWidth={72}
          onCollapse={setCollapsed}
          trigger={
            collapsible ? (
              <span className="app-shell-collapse-trigger">
                {collapsed ? <DoubleRightOutlined /> : <DoubleLeftOutlined />}
                <span>{collapsed ? 'Expand' : 'Collapse'}</span>
              </span>
            ) : null
          }
        >
          <div className="app-shell-brand">
            <Logo size={collapsed ? 'sm' : 'md'} />
          </div>
          <div className="app-shell-sider-nav">{menu}</div>
        </Sider>
      )}

      <Layout className={`app-shell-main${fullWidthContent ? ' is-full-width' : ''}`}>
        <Header
          className={`app-shell-header${fullWidthContent ? ' is-overlay' : ''}${isResidentMapPage ? ' is-map' : ''}`}
        >
          <div className="app-shell-header__leading">
            {!screens.md && !mobileNavigation && (
              <Button
                type="text"
                className="app-shell-icon-button"
                aria-label="Open navigation"
                icon={<MenuOutlined />}
                onClick={() => setDrawerOpen(true)}
              />
            )}
            {!screens.md && (
              <span className="app-shell-header__brand">
                <Logo size="sm" />
              </span>
            )}
          </div>
          <h1 className="app-shell-header__title">{pageTitle}</h1>
          <Dropdown
            trigger={['click']}
            menu={{
              className: `app-shell-account-menu${showLanguageToggle ? ' app-shell-account-menu--language' : ''}`,
              items: accountMenuItems,
              onClick: ({ key }) => {
                if (key === 'profile') navigate(profilePath);
                if (key === 'theme') toggleTheme();
                if (key === 'logout') void handleLogout();
              },
            }}
          >
            <button
              className={`app-shell-user-trigger${isResidentMapPage ? ' is-map' : ''}`}
              type="button"
              aria-label="Open account menu"
            >
              <Avatar size={32}>{initials || 'U'}</Avatar>
              <span className="app-shell-user-trigger__identity">
                <strong>{displayName}</strong>
                <small>{roleName}</small>
              </span>
              <DownOutlined className="app-shell-user-trigger__chevron" />
            </button>
          </Dropdown>
        </Header>

        <Content
          className={`app-shell-content${fullWidthContent ? ' app-shell-content--full-width' : ''}`}
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
        className="app-shell-drawer"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        placement="left"
        width={288}
        styles={{ body: { padding: 0, display: 'flex', flexDirection: 'column' } }}
      >
        <div className="app-shell-drawer__content">
          <div className="app-shell-brand app-shell-drawer__brand">
            <Logo size="sm" />
          </div>
          <div className="app-shell-drawer__nav">{menu}</div>
          <div className="app-shell-drawer__account">
            <Avatar size={34}>{initials || 'U'}</Avatar>
            <span className="app-shell-drawer__identity">
              <strong>{displayName}</strong>
              <small>{roleName}</small>
            </span>
            <Button
              type="text"
              aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
              icon={theme === 'light' ? <MoonOutlined /> : <SunOutlined />}
              onClick={toggleTheme}
            />
            <Button
              type="text"
              aria-label="Log out"
              icon={<LogoutOutlined />}
              onClick={() => void handleLogout()}
            />
          </div>
        </div>
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
