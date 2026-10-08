import {
  DashboardOutlined,
  UnorderedListOutlined,
  HeatMapOutlined,
  BarChartOutlined,
  AuditOutlined,
  TeamOutlined,
  ExportOutlined,
  InboxOutlined,
  BellOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { useMemo } from 'react';
import type { ItemType } from 'antd/es/menu/interface';
import { useQuery } from '@tanstack/react-query';
import AppShell from './AppShell';
import { useAuth } from '../contexts/AuthContext';
import { api, type Report } from '../lib/api';
import { useNotificationFeed } from '../lib/notificationFeed';

export default function AdminShell() {
  const { role } = useAuth();

  const { data: notificationFeed } = useNotificationFeed();

  const { data: pendingReports = [] } = useQuery({
    queryKey: ['pending-reports'],
    queryFn: () => api.get<Report[]>('/api/reports?status=pending'),
    enabled: role === 'secretary',
    refetchInterval: 30000,
  });

  const unreadCount = notificationFeed?.pages[0]?.unreadCount ?? 0;

  const menuItems = useMemo<ItemType[]>(() => {
    const workItems: ItemType[] = [
      { key: '/admin', icon: <DashboardOutlined />, label: 'Dashboard' },
      { key: '/admin/incidents', icon: <UnorderedListOutlined />, label: 'Incidents' },
    ];
    const insightItems: ItemType[] = [
      { key: '/admin/heatmap', icon: <HeatMapOutlined />, label: 'Safety Heatmap' },
      { key: '/admin/analytics', icon: <BarChartOutlined />, label: 'Analytics' },
      { key: '/admin/export', icon: <ExportOutlined />, label: 'Export' },
    ];
    const accountItems: ItemType[] = [
      { key: '/admin/notifications', icon: <BellOutlined />, label: 'Notifications' },
      { key: '/admin/profile', icon: <UserOutlined />, label: 'Profile' },
    ];

    if (role === 'secretary') {
      workItems.push({ key: '/admin/intake', icon: <InboxOutlined />, label: 'Intake Queue' });
    }

    if (role === 'admin') {
      insightItems.push(
        { key: '/admin/audit', icon: <AuditOutlined />, label: 'Audit Log' },
        { key: '/admin/users', icon: <TeamOutlined />, label: 'User Management' }
      );
    }

    return [
      { type: 'group', label: 'Work', children: workItems },
      { type: 'group', label: 'Insights', children: insightItems },
      { type: 'group', label: 'Account', children: accountItems },
    ];
  }, [role]);

  return (
    <AppShell
      menuItems={menuItems}
      menuBadgeCounts={{
        '/admin/intake': pendingReports.length,
        '/admin/notifications': unreadCount,
      }}
      quietBadgeKeys={['/admin/notifications']}
      siderWidth={240}
    />
  );
}
