import { Badge } from 'antd';
import {
  DashboardOutlined,
  AlertOutlined,
  HistoryOutlined,
  EnvironmentOutlined,
  BellOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import AppShell from './AppShell';
import { api, type Notification, type Report } from '../lib/api';

export default function ResponderShell() {
  const { data: reports = [] } = useQuery({
    queryKey: ['responder-reports'],
    queryFn: () => api.get<Report[]>('/api/reports'),
    refetchInterval: 30000,
  });

  const alertCount = reports.filter((r) => ['verified', 'en_route'].includes(r.status)).length;

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get<Notification[]>('/api/notifications'),
    refetchInterval: 30000,
  });

  const unreadCount = notifications.filter((notification) => !notification.read).length;

  const menuItems = useMemo(
    () => [
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
      { key: '/responder/routing', icon: <EnvironmentOutlined />, label: 'Routing' },
      { key: '/responder/history', icon: <HistoryOutlined />, label: 'History' },
      {
        key: '/responder/notifications',
        icon: <BellOutlined />,
        label: (
          <span>
            Notifications <Badge count={unreadCount} size="small" offset={[8, 0]} />
          </span>
        ),
      },
      { key: '/responder/profile', icon: <UserOutlined />, label: 'Profile' },
    ],
    [alertCount, unreadCount]
  );

  return <AppShell menuItems={menuItems} siderWidth={200} roleLabel="RESPONDER" />;
}
