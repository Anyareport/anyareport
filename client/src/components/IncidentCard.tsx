import type { ReactNode } from 'react';
import { Card, Space, Typography } from 'antd';
import type { Report } from '../lib/api';
import { UserOutlined, EnvironmentOutlined } from '@ant-design/icons';
import SeverityTag, { getSeverityStyle } from './SeverityTag';
import StatusTag from './StatusTag';

const { Text } = Typography;

const SHORT_CATEGORY_LABELS: Record<string, string> = {
  'Blotter Cases': 'Blotter',
  'Emergency Situations': 'Emergency',
  'Public Concerns': 'Public concern',
};

export function getIncidentLabel(report: Report) {
  const aiTitle = report.aiTitle?.trim();
  if (aiTitle) return aiTitle;

  const description = report.description.trim();
  if (description) {
    return description.length > 80 ? `${description.slice(0, 80).trimEnd()}…` : description;
  }

  return report.subcategory || report.category;
}

export function getIncidentMeta(report: Report) {
  const category = SHORT_CATEGORY_LABELS[report.category] || report.category;
  const categoryDetail = report.subcategory ? `${category} · ${report.subcategory}` : category;
  return [report.referenceNumber, categoryDetail].filter(Boolean).join(' · ');
}

export function getLocationLabel(report: Report) {
  const address = report.location?.address?.trim();
  if (!address) return 'Location unavailable';

  return address.replace(/,?\s*Don Mariano Marcos\s*$/i, '').trim() || 'Location unavailable';
}

export function formatRelativeDate(value: string) {
  const date = new Date(value);
  const daysAgo = Math.floor((Date.now() - date.getTime()) / 86_400_000);

  if (!Number.isFinite(daysAgo) || daysAgo < 0) return date.toLocaleDateString();
  if (daysAgo === 0) return 'Today';
  if (daysAgo === 1) return 'Yesterday';
  if (daysAgo < 30) return `${daysAgo} days ago`;
  return date.toLocaleDateString();
}

interface IncidentCardProps {
  report: Report;
  onClick?: () => void;
  showSubmitter?: boolean;
  showDescription?: boolean;
  descriptionMaxLength?: number;
  dateFormat?: 'relative' | 'absolute' | 'hidden';
  extra?: ReactNode;
  children?: ReactNode;
  actions?: ReactNode[];
  className?: string;
}

export default function IncidentCard({
  report,
  onClick,
  showSubmitter = false,
  showDescription = false,
  descriptionMaxLength,
  dateFormat = 'relative',
  extra,
  children,
  actions,
  className,
}: IncidentCardProps) {
  const title = getIncidentLabel(report);
  const description = report.description.trim();
  const displayedDescription =
    descriptionMaxLength && description.length > descriptionMaxLength
      ? `${description.slice(0, descriptionMaxLength).trimEnd()}…`
      : description;

  return (
    <Card
      className={className}
      hoverable={Boolean(onClick)}
      onClick={onClick}
      size="small"
      actions={actions}
      style={{
        borderInlineStart: `4px solid ${getSeverityStyle(report.severity).borderColor || 'var(--border-light)'}`,
      }}
    >
      <Space direction="vertical" size={6} style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
          <Space size={4} wrap>
            <SeverityTag severity={report.severity} />
            <StatusTag status={report.status} />
          </Space>
          <Space size={8}>
            {extra}
            {dateFormat !== 'hidden' && (
              <Text
                type="secondary"
                title={new Date(report.createdAt).toLocaleString()}
                style={{ fontSize: 12, whiteSpace: 'nowrap' }}
              >
                {dateFormat === 'absolute'
                  ? new Date(report.createdAt).toLocaleString()
                  : formatRelativeDate(report.createdAt)}
              </Text>
            )}
          </Space>
        </div>
        <Text strong style={{ overflowWrap: 'anywhere' }}>
          {title}
        </Text>
        <Text type="secondary" style={{ fontSize: 12 }}>
          {getIncidentMeta(report)}
        </Text>
        {showDescription && displayedDescription && (
          <Text style={{ overflowWrap: 'anywhere' }}>{displayedDescription}</Text>
        )}
        {children}
        <Text type="secondary" style={{ overflowWrap: 'anywhere' }}>
          <EnvironmentOutlined /> {getLocationLabel(report)}
          {showSubmitter && report.submitterName && (
            <>
              {' · '}
              <UserOutlined /> {report.submitterName}
            </>
          )}
        </Text>
      </Space>
    </Card>
  );
}
