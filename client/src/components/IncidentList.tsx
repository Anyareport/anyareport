import { Table, Grid, Typography, Space } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useNavigate } from 'react-router-dom';
import type { Report } from '../lib/api';
import StatusTag from './StatusTag';
import SeverityTag from './SeverityTag';
import { compareSeverity, compareStatus, compareCreatedAt } from '../lib/sortUtils';
import IncidentCard from './IncidentCard';
import {
  formatRelativeDate,
  getIncidentLabel,
  getIncidentMeta,
  getLocationLabel,
} from '../lib/incidentUtils';
import { useAuth } from '../contexts/AuthContext';
import { useLang } from '../contexts/LanguageContext';
import { getLocalizedCategory } from '../i18n/labels';

const { Text } = Typography;
const { useBreakpoint } = Grid;

interface IncidentListProps {
  reports: Report[];
  loading?: boolean;
  onRowClick?: (id: string) => void;
  basePath?: string;
  showSubmitter?: boolean;
  layout?: 'responsive' | 'cards' | 'table';
}

export default function IncidentList({
  reports,
  loading,
  onRowClick,
  basePath = '/admin/incidents',
  showSubmitter = true,
  layout = 'responsive',
}: IncidentListProps) {
  const screens = useBreakpoint();
  const navigate = useNavigate();
  const { role } = useAuth();
  const { lang, t } = useLang();
  const translate = lang === 'fil' && ['tanod', 'responder'].includes(role || '');
  const isMobile = !screens.md;

  const getListTitle = (report: Report) => {
    if (!translate || report.aiTitle?.trim() || report.description.trim()) {
      return getIncidentLabel(report);
    }
    const categoryLabels = getLocalizedCategory(report.category, report.subcategory, t);
    return categoryLabels.subcategory || categoryLabels.category;
  };

  const getListMeta = (report: Report) => {
    if (!translate) return getIncidentMeta(report);
    const categoryLabels = getLocalizedCategory(report.category, report.subcategory, t);
    const categoryDetail = report.subcategory
      ? `${categoryLabels.category} · ${categoryLabels.subcategory}`
      : categoryLabels.category;
    return [report.referenceNumber, categoryDetail].filter(Boolean).join(' · ');
  };

  const handleClick = (id: string) => {
    if (onRowClick) onRowClick(id);
    else navigate(`${basePath}/${id}`);
  };

  if (layout === 'cards' || (layout === 'responsive' && isMobile)) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {reports.map((r) => (
          <IncidentCard
            key={r._id}
            report={r}
            onClick={() => handleClick(r._id)}
            showSubmitter={showSubmitter}
          />
        ))}
      </div>
    );
  }

  const columns: ColumnsType<Report> = [
    {
      title: translate ? t('incident') : 'Incident',
      key: 'aiTitle',
      render: (_: unknown, report: Report) => (
        <Space direction="vertical" size={0}>
          <Text strong ellipsis={{ tooltip: report.description }}>
            {getListTitle(report)}
          </Text>
          <Text type="secondary" style={{ fontSize: 11 }}>
            {getListMeta(report)}
          </Text>
        </Space>
      ),
    },
    {
      title: translate ? t('severity') : 'Severity',
      dataIndex: 'severity',
      key: 'severity',
      sorter: compareSeverity,
      sortDirections: ['ascend', 'descend'],
      render: (severity: string | null) => (severity ? <SeverityTag severity={severity} /> : '—'),
    },
    {
      title: translate ? t('status') : 'Status',
      dataIndex: 'status',
      key: 'status',
      sorter: compareStatus,
      sortDirections: ['ascend', 'descend'],
      render: (s: string) => <StatusTag status={s} />,
    },
    {
      title: translate ? t('location') : 'Location',
      key: 'location',
      render: (_: unknown, r: Report) => getLocationLabel(r),
    },
    {
      title: translate ? t('submitted') : 'Submitted',
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
            title: translate ? t('submittedBy') : 'Submitted By',
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
