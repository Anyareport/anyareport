import { Button, Card, Empty, Progress, Space, theme } from 'antd';
import type { Analytics } from '../lib/api';

interface PurokBreakdownCardProps {
  data?: Analytics['byPurok'];
  title?: string;
  actionLabel?: string;
  onViewHeatmap: () => void;
  style?: React.CSSProperties;
}

export default function PurokBreakdownCard({
  data,
  title = 'Top Puroks',
  actionLabel = 'View Heatmap',
  onViewHeatmap,
  style,
}: PurokBreakdownCardProps) {
  const { token } = theme.useToken();
  const entries = data ?? [];

  return (
    <Card
      className="soft-card"
      title={title}
      style={style}
      extra={
        <Button variant="outlined" color="primary" onClick={onViewHeatmap}>
          {actionLabel}
        </Button>
      }
    >
      {entries.length ? (
        <Space direction="vertical" size={10} style={{ width: '100%' }}>
          {entries.map((entry) => (
            <div key={entry._id}>
              <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                <span>{entry._id}</span>
                <span>{entry.count}</span>
              </Space>
              <Progress
                percent={entries[0].count ? Math.round((entry.count / entries[0].count) * 100) : 0}
                showInfo={false}
                strokeColor={token.colorPrimary}
              />
            </div>
          ))}
        </Space>
      ) : (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No Purok data" />
      )}
    </Card>
  );
}
