import {
  EnvironmentOutlined,
  FileAddOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons';
import { useLocation } from 'react-router-dom';
import { useMemo } from 'react';
import AppShell from './AppShell';

export default function GuestShell() {
  const location = useLocation();
  const menuItems = useMemo(
    () => [
      { key: '/report/map', icon: <EnvironmentOutlined />, label: 'Map' },
      { key: '/report/reports', icon: <UnorderedListOutlined />, label: 'My Reports' },
    ],
    []
  );
  const mobileMenuItems = [
    ...menuItems,
    { key: '/report', icon: <FileAddOutlined />, label: 'Report' },
  ];

  return (
    <AppShell
      menuItems={menuItems}
      mobileMenuItems={mobileMenuItems}
      siderWidth={220}
      mobileNavigation
      mobilePrimaryAction="/report"
      fullWidthContent={['/report', '/report/map'].includes(location.pathname)}
      guest
    />
  );
}
