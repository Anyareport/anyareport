import { Table, Card, Grid, Typography, Space } from 'antd';
import { useNavigate } from 'react-router-dom';
import type { Report } from '../lib/api';
import StatusTag from './StatusTag';
import SeverityTag from './SeverityTag';

const { Text } = Typography;
const { useBreakpoint } = Grid;

interface IncidentListProps {
  reports: Report[];
  loading?: boolean;
  onRowClick?: (id: string) => void;
  basePath?: string;
}

export default function IncidentList({
  reports,
  loading,
  onRowClick,
  basePath = '/admin/incidents',
}: IncidentListProps) {
  const screens = useBreakpoint();
  const navigate = useNavigate();
  const isMobile = !screens.md;

  const handleClick = (id: string) => {
    if (onRowClick) onRowClick(id);
    else navigate(`${basePath}/${id}`);
  };

  if (isMobile) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {reports.map((r) => (
          <Card key={r._id} hoverable onClick={() => handleClick(r._id)} size="small">
            <Space direction="vertical" size={4} style={{ width: '100%' }}>
              <div
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <Space size={4}>
                  <StatusTag status={r.status} />
                  <SeverityTag severity={r.severity} />
                </Space>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {new Date(r.createdAt).toLocaleDateString()}
                </Text>
              </div>
              <Text strong>{r.category}</Text>
              {r.submitterName && (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  By {r.submitterName}
                </Text>
              )}
              <Text type="secondary" ellipsis>
                {r.location?.address ||
                  `${r.location?.coordinates?.[1]?.toFixed(4)}, ${r.location?.coordinates?.[0]?.toFixed(4)}`}
              </Text>
              <Text ellipsis={{ tooltip: r.description }}>{r.description}</Text>
            </Space>
          </Card>
        ))}
      </div>
    );
  }

  const columns = [
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (s: string) => <StatusTag status={s} />,
    },
    {
      title: 'Severity',
      dataIndex: 'severity',
      key: 'severity',
      render: (s: string | null) => <SeverityTag severity={s} />,
    },
    { title: 'Category', dataIndex: 'category', key: 'category' },
    {
      title: 'Submitted By',
      key: 'submitterName',
      render: (_: unknown, r: Report) => r.submitterName || '—',
    },
    {
      title: 'Location',
      key: 'location',
      render: (_: unknown, r: Report) => r.location?.address || '—',
    },
    {
      title: 'Submitted',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (d: string) => new Date(d).toLocaleString(),
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
  ];

  return (
    <Table
      dataSource={reports}
      columns={columns}
      rowKey="_id"
      loading={loading}
      onRow={(record) => ({
        onClick: () => handleClick(record._id),
        style: { cursor: 'pointer' },
      })}
      pagination={{ pageSize: 10 }}
    />
  );
}
