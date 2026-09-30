import { Table, Card, Grid, Typography, Space } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useNavigate } from 'react-router-dom';
import type { Report } from '../lib/api';
import StatusTag from './StatusTag';
import SeverityTag, { getSeverityStyle } from './SeverityTag';
import { compareSeverity, compareStatus, compareCreatedAt } from '../lib/sortUtils';

const { Text } = Typography;
const { useBreakpoint } = Grid;

const SHORT_CATEGORY_LABELS: Record<string, string> = {
  'Blotter Cases': 'Blotter',
  'Emergency Situations': 'Emergency',
  'Public Concerns': 'Public concern',
};

function getIncidentLabel(report: Report) {
  const aiTitle = report.aiTitle?.trim();
  if (aiTitle) return aiTitle;

  const description = report.description.trim();
  if (description) {
    return description.length > 80 ? `${description.slice(0, 80).trimEnd()}…` : description;
  }

  return report.subcategory || report.category;
}

function getIncidentMeta(report: Report) {
  const category = SHORT_CATEGORY_LABELS[report.category] || report.category;
  const categoryDetail = report.subcategory ? `${category} · ${report.subcategory}` : category;
  return [report.referenceNumber, categoryDetail].filter(Boolean).join(' · ');
}

function getLocationLabel(report: Report) {
  const address = report.location?.address?.trim();
  if (!address) return 'Location unavailable';

  return address.replace(/,?\s*Don Mariano Marcos\s*$/i, '').trim() || 'Location unavailable';
}

function formatRelativeDate(value: string) {
  const date = new Date(value);
  const daysAgo = Math.floor((Date.now() - date.getTime()) / 86_400_000);

  if (!Number.isFinite(daysAgo) || daysAgo < 0) return date.toLocaleDateString();
  if (daysAgo === 0) return 'Today';
  if (daysAgo === 1) return 'Yesterday';
  if (daysAgo < 30) return `${daysAgo} days ago`;
  return date.toLocaleDateString();
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
          <Card
            key={r._id}
            hoverable
            onClick={() => handleClick(r._id)}
            size="small"
            style={{
              borderInlineStart: `4px solid ${getSeverityStyle(r.severity).borderColor || 'var(--border-light)'}`,
            }}
          >
            <Space direction="vertical" size={4} style={{ width: '100%' }}>
              <div
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <Space size={4} wrap>
                  <StatusTag status={r.status} />
                  <SeverityTag severity={r.severity} />
                </Space>
                <Text
                  type="secondary"
                  title={new Date(r.createdAt).toLocaleString()}
                  style={{ fontSize: 12 }}
                >
                  {formatRelativeDate(r.createdAt)}
                </Text>
              </div>
              <Text strong ellipsis={{ tooltip: getIncidentLabel(r) }}>
                {getIncidentLabel(r)}
              </Text>
              <Text
                type="secondary"
                style={{ fontSize: 12 }}
                ellipsis={{ tooltip: getIncidentMeta(r) }}
              >
                {getIncidentMeta(r)}
              </Text>
              <Text type="secondary" ellipsis={{ tooltip: getLocationLabel(r) }}>
                {getLocationLabel(r)}
                {showSubmitter && r.submitterName ? ` · ${r.submitterName}` : ''}
              </Text>
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
          <Text type="secondary" style={{ fontSize: 11 }}>
            {getIncidentMeta(report)}
          </Text>
        </Space>
      ),
    },
    {
      title: 'Severity',
      dataIndex: 'severity',
      key: 'severity',
      sorter: compareSeverity,
      sortDirections: ['ascend', 'descend'],
      render: (severity: string | null) => (severity ? <SeverityTag severity={severity} /> : '—'),
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
      title: 'Location',
      key: 'location',
      render: (_: unknown, r: Report) => getLocationLabel(r),
    },
    {
      title: 'Submitted',
      dataIndex: 'createdAt',
      key: 'createdAt',
      sorter: compareCreatedAt,
      sortDirections: ['descend', 'ascend'],
      render: (createdAt: string) => (
        <Text title={new Date(createdAt).toLocaleString()}>
          {new Date(createdAt).toLocaleString()}
        </Text>
      ),
    },
    ...(showSubmitter
      ? [
          {
            title: 'Submitted By',
            key: 'submittedBy',
            render: (_: unknown, report: Report) => (
              <Space direction="vertical" size={0}>
                <Text type="secondary" title={new Date(report.createdAt).toLocaleString()}>
                  {formatRelativeDate(report.createdAt)}
                </Text>
                <Text>{report.submitterName || '—'}</Text>
              </Space>
            ),
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
