import {
  DashboardOutlined,
  AlertOutlined,
  HistoryOutlined,
  BellOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import AppShell from './AppShell';
import { api, type Report } from '../lib/api';
import { useNotificationFeed } from '../lib/notificationFeed';

export default function ResponderShell() {
  const { data: reports = [] } = useQuery({
    queryKey: ['responder-reports'],
    queryFn: () => api.get<Report[]>('/api/reports'),
    refetchInterval: 30000,
  });

  const alertCount = reports.filter(
    (report) => report.status === 'pending' && !report.acknowledgedBy
  ).length;

  const { data: notificationFeed } = useNotificationFeed();
  const unreadCount = notificationFeed?.pages[0]?.unreadCount ?? 0;

  const menuItems = useMemo(
    () => [
      { key: '/responder', icon: <DashboardOutlined />, label: 'Dashboard' },
      {
        key: '/responder/alerts',
        icon: <AlertOutlined />,
        label: 'Alerts',
      },
      { key: '/responder/history', icon: <HistoryOutlined />, label: 'History' },
      {
        key: '/responder/notifications',
        icon: <BellOutlined />,
        label: 'Notifications',
      },
      { key: '/responder/profile', icon: <UserOutlined />, label: 'Profile' },
    ],
    []
  );

  return (
    <AppShell
      menuItems={menuItems}
      menuBadgeCounts={{ '/responder/alerts': alertCount, '/responder/notifications': unreadCount }}
      quietBadgeKeys={['/responder/notifications']}
      siderWidth={200}
      mobileNavigation
    />
  );
}
