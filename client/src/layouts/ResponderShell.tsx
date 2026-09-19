import { Badge } from 'antd';
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

export default function ResponderShell() {
  const { data: reports = [] } = useQuery({
    queryKey: ['responder-reports'],
    queryFn: () => api.get<Report[]>('/api/reports?status=verified'),
    refetchInterval: 30000,
  });

  const alertCount = reports.filter((r) => ['verified', 'en_route'].includes(r.status)).length;

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
      { key: '/responder/history', icon: <HistoryOutlined />, label: 'History' },
      { key: '/responder/notifications', icon: <BellOutlined />, label: 'Notifications' },
      { key: '/responder/profile', icon: <UserOutlined />, label: 'Profile' },
    ],
    [alertCount]
  );

  return <AppShell menuItems={menuItems} siderWidth={200} roleLabel="RESPONDER" />;
}
