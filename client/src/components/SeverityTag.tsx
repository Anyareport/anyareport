import type { CSSProperties } from 'react';
import { Tag } from 'antd';
import { WarningOutlined } from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';
import { useLang } from '../contexts/LanguageContext';

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
  const { role } = useAuth();
  const { lang, t } = useLang();
  if (!severity) return null;

  const style = getSeverityStyle(severity);
  const severityKey = {
    Critical: 'severityCritical',
    High: 'severityHigh',
    Medium: 'severityMedium',
    Low: 'severityLow',
  } as const;
  const label =
    lang === 'fil' && ['tanod', 'responder'].includes(role || '') && severity in severityKey
      ? t(severityKey[severity as keyof typeof severityKey])
      : severity;

  return (
    <Tag
      style={{ ...style, border: 0, fontWeight: 600, marginInlineEnd: 0 }}
      icon={<WarningOutlined />}
    >
      {label}
    </Tag>
  );
}
