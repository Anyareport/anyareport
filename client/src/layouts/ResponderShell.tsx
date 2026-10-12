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
import { useLang } from '../contexts/LanguageContext';

export default function ResponderShell() {
  const { t } = useLang();
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
      { key: '/responder', icon: <DashboardOutlined />, label: t('dashboard') },
      {
        key: '/responder/alerts',
        icon: <AlertOutlined />,
        label: t('alerts'),
      },
      { key: '/responder/history', icon: <HistoryOutlined />, label: t('history') },
      {
        key: '/responder/notifications',
        icon: <BellOutlined />,
        label: t('notifications'),
      },
      { key: '/responder/profile', icon: <UserOutlined />, label: t('profile') },
    ],
    [t]
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
