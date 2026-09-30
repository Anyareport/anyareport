import type { CSSProperties } from 'react';
import { Tag } from 'antd';
import { WarningOutlined } from '@ant-design/icons';

export const SEVERITY_STYLES: Record<string, CSSProperties> = {
  Critical: {
    color: 'var(--severity-critical-text)',
    background: 'var(--severity-critical-bg)',
    borderColor: 'var(--severity-critical-border)',
  },
  High: {
    color: 'var(--severity-high-text)',
    background: 'var(--severity-high-bg)',
    borderColor: 'var(--severity-high-border)',
  },
  Medium: {
    color: 'var(--severity-medium-text)',
    background: 'var(--severity-medium-bg)',
    borderColor: 'var(--severity-medium-border)',
  },
  Low: {
    color: 'var(--severity-low-text)',
    background: 'var(--severity-low-bg)',
    borderColor: 'var(--severity-low-border)',
  },
};

const FALLBACK_STYLE: CSSProperties = {
  color: 'var(--text-secondary)',
  background: 'var(--bg-secondary)',
  borderColor: 'var(--border-light)',
};

export function getSeverityStyle(severity: string | null | undefined): CSSProperties {
  return SEVERITY_STYLES[severity || ''] || FALLBACK_STYLE;
}

export default function SeverityTag({ severity }: { severity: string | null | undefined }) {
  if (!severity) return null;
  return (
    <Tag style={{ ...getSeverityStyle(severity), marginInlineEnd: 0 }} icon={<WarningOutlined />}>
      {severity}
    </Tag>
  );
}
