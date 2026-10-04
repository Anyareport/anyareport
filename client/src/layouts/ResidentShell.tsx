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

export default function ResidentShell() {
  const { data: notificationFeed } = useNotificationFeed();
  const unreadCount = notificationFeed?.pages[0]?.unreadCount ?? 0;

  const location = useLocation();

  const menuItems = useMemo(
    () => [
      { key: '/resident/map', icon: <EnvironmentOutlined />, label: 'Map' },
      { key: '/resident/reports', icon: <UnorderedListOutlined />, label: 'My Reports' },
      {
        key: '/resident/notifications',
        icon: <BellOutlined />,
        label: 'Notifications',
      },
      { key: '/resident/profile', icon: <UserOutlined />, label: 'Profile' },
    ],
    []
  );

  const mobileMenuItems = useMemo(
    () => [
      ...menuItems.slice(0, 2),
      { key: '/resident/report', icon: <PlusOutlined />, label: 'Report' },
      ...menuItems.slice(2),
    ],
    [menuItems]
  );

  return (
    <AppShell
      menuItems={menuItems}
      mobileMenuItems={mobileMenuItems}
      menuBadgeCounts={{ '/resident/notifications': unreadCount }}
      siderWidth={220}
      mobileNavigation
      mobilePrimaryAction="/resident/report"
      fullWidthContent={['/resident/map', '/resident/report'].includes(location.pathname)}
    />
  );
}
