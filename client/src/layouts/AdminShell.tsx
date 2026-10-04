import { Badge } from 'antd';
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

  const menuItems = useMemo(() => {
    const items = [
      { key: '/admin', icon: <DashboardOutlined />, label: 'Dashboard' },
      { key: '/admin/incidents', icon: <UnorderedListOutlined />, label: 'Incidents' },
      { key: '/admin/heatmap', icon: <HeatMapOutlined />, label: 'Safety Heatmap' },
      { key: '/admin/analytics', icon: <BarChartOutlined />, label: 'Analytics' },
      {
        key: '/admin/notifications',
        icon: <BellOutlined />,
        label: (
          <span>
            Notifications <Badge count={unreadCount} size="small" offset={[8, 0]} />
          </span>
        ),
      },
      { key: '/admin/export', icon: <ExportOutlined />, label: 'Export' },
      { key: '/admin/profile', icon: <UserOutlined />, label: 'Profile' },
    ];

    if (role === 'secretary') {
      items.splice(2, 0, {
        key: '/admin/intake',
        icon: <InboxOutlined />,
        label: (
          <span>
            Intake Queue <Badge count={pendingReports.length} size="small" offset={[8, 0]} />
          </span>
        ),
      });
    }

    if (role === 'admin') {
      items.push({ key: '/admin/users', icon: <TeamOutlined />, label: 'User Management' });
    }

    if (role === 'admin') {
      items.splice(items.length - 2, 0, {
        key: '/admin/audit',
        icon: <AuditOutlined />,
        label: 'Audit Log',
      });
    }

    return items;
  }, [role, unreadCount, pendingReports.length]);

  return (
    <AppShell menuItems={menuItems} siderWidth={240} roleLabel={role?.toUpperCase()} collapsible />
  );
}
