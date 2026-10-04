import type { ReactNode } from 'react';
import { Card, Space, Typography } from 'antd';
import type { Report } from '../lib/api';
import { UserOutlined, EnvironmentOutlined } from '@ant-design/icons';
import {
  formatRelativeDate,
  getIncidentLabel,
  getIncidentMeta,
  getLocationLabel,
} from '../lib/incidentUtils';
import SeverityTag, { getSeverityStyle } from './SeverityTag';
import StatusTag from './StatusTag';

const { Text } = Typography;

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
