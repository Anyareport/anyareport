import {
  UnorderedListOutlined,
  BellOutlined,
  UserOutlined,
  EnvironmentOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import { useLocation } from 'react-router-dom';
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import AppShell from './AppShell';
import { api, type Notification } from '../lib/api';

export default function ResidentShell() {
  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get<Notification[]>('/api/notifications'),
    staleTime: 30_000,
    refetchInterval: 30000,
  });

  const unreadCount = notifications.filter((n) => !n.read).length;

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
