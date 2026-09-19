import { Tag } from 'antd';

const statusColors: Record<string, string> = {
  pending: 'var(--status-pending-tag)',
  verified: 'var(--status-verified-tag)',
  en_route: 'var(--status-en-route-tag)',
  on_scene: 'var(--status-on-scene-tag)',
  resolved: 'var(--status-resolved-tag)',
  flagged: 'var(--status-flagged-tag)',
};

export default function StatusTag({ status }: { status: string }) {
  const color = statusColors[status] || 'var(--neutral-400)';

  return (
    <Tag color={color} style={{ color: 'var(--neutral-900)' }}>
      {status.replace(/_/g, ' ').toUpperCase()}
    </Tag>
  );
}

export function formatStatus(status: string) {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
