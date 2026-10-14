import { Button, Card, Space, Typography } from 'antd';
import type { NotificationFeedItem } from '../lib/api';
import NotificationCard from './NotificationCard';

const { Text } = Typography;

interface RecentActivityPanelProps {
  items: NotificationFeedItem[];
  role: string | null;
  onOpenReport: (reportId: string) => void;
  onViewAll: () => void;
}

export default function RecentActivityPanel({
  items,
  role,
  onOpenReport,
  onViewAll,
}: RecentActivityPanelProps) {
  return (
    <Card
      className="soft-card"
      title="Recent activity"
      extra={
        <Button color="primary" variant="outlined" type="link" onClick={onViewAll}>
          View all
        </Button>
      }
    >
      {items.length ? (
        <Space direction="vertical" size={8} style={{ width: '100%' }}>
          {items.map((item) => (
            <NotificationCard
              key={item.id}
              item={item}
              role={role}
              to={item.reportId ? `/admin/incidents/${item.reportId}` : null}
              onOpen={() => {
                if (item.reportId) onOpenReport(item.reportId);
              }}
            />
          ))}
        </Space>
      ) : (
        <Text type="secondary">No recent activity.</Text>
      )}
    </Card>
  );
}