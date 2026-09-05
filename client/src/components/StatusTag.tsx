import { Tag } from 'antd';

const statusColors: Record<string, string> = {
  pending: 'orange',
  verified: 'blue',
  en_route: 'cyan',
  on_scene: 'purple',
  resolved: 'green',
  flagged: 'red',
};

export default function StatusTag({ status }: { status: string }) {
  return (
    <Tag color={statusColors[status] || 'default'}>
      {status.replace(/_/g, ' ').toUpperCase()}
    </Tag>
  );
}

export function formatStatus(status: string) {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
