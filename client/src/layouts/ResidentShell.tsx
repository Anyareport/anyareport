import { Badge } from 'antd';
import {
  HomeOutlined,
  FileAddOutlined,
  UnorderedListOutlined,
  BellOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import AppShell from './AppShell';
import { api, type Notification } from '../lib/api';

export default function ResidentShell() {
  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get<Notification[]>('/api/notifications'),
    staleTime: 30_000,
  });

  const unreadCount = notifications.filter((n) => !n.read).length;

  const menuItems = useMemo(
    () => [
      { key: '/resident', icon: <HomeOutlined />, label: 'Home' },
      { key: '/resident/submit', icon: <FileAddOutlined />, label: 'Report Incident' },
      { key: '/resident/reports', icon: <UnorderedListOutlined />, label: 'My Reports' },
      {
        key: '/resident/notifications',
        icon: <BellOutlined />,
        label: (
          <Badge count={unreadCount} offset={[8, 0]}>
            Notifications
          </Badge>
        ),
      },
      { key: '/resident/profile', icon: <UserOutlined />, label: 'Profile' },
    ],
    [unreadCount]
  );

  return <AppShell menuItems={menuItems} siderWidth={220} />;
}
