import { Table, Card, Grid, Typography, Space } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useNavigate } from 'react-router-dom';
import type { Report } from '../lib/api';
import StatusTag from './StatusTag';
import SeverityTag from './SeverityTag';
import { compareSeverity, compareStatus, compareCreatedAt } from '../lib/sortUtils';

const { Text } = Typography;
const { useBreakpoint } = Grid;

function getIncidentLabel(report: Report) {
  const aiTitle = report.aiTitle?.trim();
  if (aiTitle) return aiTitle;

  const description = report.description.trim();
  if (description) {
    return description.length > 80 ? `${description.slice(0, 80).trimEnd()}…` : description;
  }

  return report.subcategory || report.category;
}

interface IncidentListProps {
  reports: Report[];
  loading?: boolean;
  onRowClick?: (id: string) => void;
  basePath?: string;
  showSubmitter?: boolean;
}

export default function IncidentList({
  reports,
  loading,
  onRowClick,
  basePath = '/admin/incidents',
  showSubmitter = true,
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
              <Text strong ellipsis={{ tooltip: getIncidentLabel(r) }}>
                {getIncidentLabel(r)}
              </Text>
              {r.referenceNumber && (
                <Text type="secondary" style={{ fontSize: 11 }}>
                  Reference {r.referenceNumber}
                </Text>
              )}
              <Text type="secondary" style={{ fontSize: 12 }}>
                {r.category}
                {r.subcategory ? ` · ${r.subcategory}` : ''}
              </Text>
              {showSubmitter && r.submitterName && (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  By {r.submitterName}
                </Text>
              )}
              <Text type="secondary" ellipsis>
                {r.location?.address ||
                  `${r.location?.coordinates?.[1]?.toFixed(4)}, ${r.location?.coordinates?.[0]?.toFixed(4)}`}
              </Text>
              {r.aiTitle?.trim() && r.description.trim() && (
                <Text ellipsis={{ tooltip: r.description }}>{r.description}</Text>
              )}
            </Space>
          </Card>
        ))}
      </div>
    );
  }

  const columns: ColumnsType<Report> = [
    {
      title: 'Incident',
      key: 'aiTitle',
      render: (_: unknown, report: Report) => (
        <Space direction="vertical" size={0}>
          <Text ellipsis={{ tooltip: report.description }}>{getIncidentLabel(report)}</Text>
          {report.referenceNumber && (
            <Text type="secondary" style={{ fontSize: 11 }}>
              Reference {report.referenceNumber}
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      sorter: compareStatus,
      sortDirections: ['ascend', 'descend'],
      render: (s: string) => <StatusTag status={s} />,
    },
    {
      title: 'Severity',
      dataIndex: 'severity',
      key: 'severity',
      sorter: compareSeverity,
      sortDirections: ['ascend', 'descend'],
      render: (s: string | null) => <SeverityTag severity={s} />,
    },
    { title: 'Category', dataIndex: 'category', key: 'category' },
    {
      title: 'Location',
      key: 'location',
      render: (_: unknown, r: Report) => r.location?.address || '—',
    },
    {
      title: 'Submitted',
      dataIndex: 'createdAt',
      key: 'createdAt',
      sorter: compareCreatedAt,
      sortDirections: ['descend', 'ascend'],
      render: (d: string) => new Date(d).toLocaleString(),
    },
    ...(showSubmitter
      ? [
          {
            title: 'Submitted By',
            key: 'submitterName',
            render: (_: unknown, r: Report) => r.submitterName || '—',
          },
        ]
      : []),
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
