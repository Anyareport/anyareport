import type { CSSProperties } from 'react';
import { Tag } from 'antd';
import { WarningOutlined } from '@ant-design/icons';

export const SEVERITY_STYLES: Record<string, CSSProperties> = {
  Critical: {
    color: 'var(--severity-critical-tag)',
    background: 'color-mix(in srgb, var(--severity-critical-tag) 14%, transparent)',
    borderColor: 'var(--severity-critical-tag)',
  },
  High: {
    color: 'var(--severity-high-tag)',
    background: 'color-mix(in srgb, var(--severity-high-tag) 14%, transparent)',
    borderColor: 'var(--severity-high-tag)',
  },
  Medium: {
    color: 'var(--severity-medium-tag)',
    background: 'color-mix(in srgb, var(--severity-medium-tag) 14%, transparent)',
    borderColor: 'var(--severity-medium-tag)',
  },
  Low: {
    color: 'var(--severity-low-tag)',
    background: 'color-mix(in srgb, var(--severity-low-tag) 14%, transparent)',
    borderColor: 'var(--severity-low-tag)',
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
    <Tag
      style={{ ...getSeverityStyle(severity), marginInlineEnd: 0, border: 0 }}
      icon={<WarningOutlined />}
    >
      {severity}
    </Tag>
  );
}
