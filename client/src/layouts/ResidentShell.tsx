import {
  UnorderedListOutlined,
  BellOutlined,
  UserOutlined,
  EnvironmentOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import { useLocation } from 'react-router-dom';
import { useMemo } from 'react';
import AppShell from './AppShell';
import { useNotificationFeed } from '../lib/notificationFeed';
import { useAuth } from '../contexts/AuthContext';

export default function ResidentShell() {
  const { profile } = useAuth();
  const suspended = profile?.status === 'suspended';
  const { data: notificationFeed } = useNotificationFeed({ enabled: !suspended });
  const unreadCount = notificationFeed?.pages[0]?.unreadCount ?? 0;

  const location = useLocation();

  const menuItems = useMemo(
    () =>
      suspended
        ? [{ key: '/resident/profile', icon: <UserOutlined />, label: 'Profile' }]
        : [
            { key: '/resident/map', icon: <EnvironmentOutlined />, label: 'Map' },
            { key: '/resident/reports', icon: <UnorderedListOutlined />, label: 'My Reports' },
            {
              key: '/resident/notifications',
              icon: <BellOutlined />,
              label: 'Notifications',
            },
            { key: '/resident/profile', icon: <UserOutlined />, label: 'Profile' },
          ],
    [suspended]
  );

  const mobileMenuItems = useMemo(
    () =>
      suspended
        ? menuItems
        : [
            ...menuItems.slice(0, 2),
            { key: '/resident/report', icon: <PlusOutlined />, label: 'Report' },
            ...menuItems.slice(2),
          ],
    [menuItems, suspended]
  );

  return (
    <AppShell
      menuItems={menuItems}
      mobileMenuItems={mobileMenuItems}
      menuBadgeCounts={{ '/resident/notifications': unreadCount }}
      quietBadgeKeys={['/resident/notifications']}
      siderWidth={220}
      mobileNavigation
      mobilePrimaryAction={suspended ? undefined : '/resident/report'}
      fullWidthContent={
        !suspended && ['/resident/map', '/resident/report'].includes(location.pathname)
      }
    />
  );
}
