import { Card, Progress, Skeleton, Tag, Typography } from 'antd';
import { ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';

const { Text } = Typography;

export type KpiTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger';

export interface KpiBadge {
  text: string;
  tone: KpiTone;
}

export interface KpiDelta {
  value: number | string;
  direction: 'up' | 'down';
  /** true = this direction is good (e.g. up for resolved, down for open) */
  good: boolean;
  /** label shown after the delta value, e.g. "vs previous 30 days" */
  label?: string;
}

export interface KpiProgress {
  value: number; // 0–100
  color?: string;
}

export interface KpiCardProps {
  label: string;
  value: ReactNode;
  suffix?: string;
  icon?: ReactNode;
  tone?: KpiTone;
  badges?: KpiBadge[];
  helper?: string;
  link?: { text: string; href: string };
  progress?: KpiProgress;
  delta?: KpiDelta;
  loading?: boolean;
  style?: React.CSSProperties;
}

const toneIconBg: Record<KpiTone, string> = {
  neutral: 'var(--bg-secondary)',
  accent: 'color-mix(in srgb, var(--brand-primary) 12%, transparent)',
  success: 'color-mix(in srgb, var(--severity-low-tag) 12%, transparent)',
  warning: 'color-mix(in srgb, var(--severity-medium-tag) 14%, transparent)',
  danger: 'color-mix(in srgb, var(--severity-critical-tag) 12%, transparent)',
};

const toneIconColor: Record<KpiTone, string> = {
  neutral: 'var(--text-secondary)',
  accent: 'var(--brand-primary)',
  success: 'var(--severity-low-tag)',
  warning: 'var(--severity-medium-tag)',
  danger: 'var(--severity-critical-tag)',
};

const toneProgressColor: Record<KpiTone, string> = {
  neutral: 'var(--brand-primary)',
  accent: 'var(--brand-primary)',
  success: 'var(--severity-low-tag)',
  warning: 'var(--severity-medium-tag)',
  danger: 'var(--severity-critical-tag)',
};

const badgeBg: Record<KpiTone, string> = {
  neutral: 'var(--bg-secondary)',
  accent: 'color-mix(in srgb, var(--brand-primary) 12%, transparent)',
  success: 'color-mix(in srgb, var(--severity-low-tag) 14%, transparent)',
  warning: 'color-mix(in srgb, var(--severity-medium-tag) 16%, transparent)',
  danger: 'color-mix(in srgb, var(--severity-critical-tag) 14%, transparent)',
};

const badgeColor: Record<KpiTone, string> = {
  neutral: 'var(--text-secondary)',
  accent: 'var(--brand-primary)',
  success: 'var(--severity-low-tag)',
  warning: 'var(--severity-medium-tag)',
  danger: 'var(--severity-critical-tag)',
};

export default function KpiCard({
  label,
  value,
  suffix,
  icon,
  tone = 'neutral',
  badges,
  helper,
  link,
  progress,
  delta,
  loading = false,
  style,
}: KpiCardProps) {
  const navigate = useNavigate();

  if (loading) {
    return (
      <Card className="soft-card" style={{ height: '100%', ...style }}>
        <Skeleton active paragraph={{ rows: 2 }} title={false} />
      </Card>
    );
  }

  const deltaPositive = delta?.direction === 'up' ? delta.good : !delta?.good;

  return (
    <Card className="soft-card" style={{ height: '100%', ...style }}>
      {/* Header row: icon chip + label */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        {icon && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 28,
              height: 28,
              borderRadius: 6,
              background: toneIconBg[tone],
              color: toneIconColor[tone],
              fontSize: 14,
              flexShrink: 0,
            }}
          >
            {icon}
          </span>
        )}
        <Text type="secondary" style={{ fontSize: 13, fontWeight: 500 }}>
          {label}
        </Text>
      </div>

      {/* Value */}
      <div
        style={{
          fontSize: 32,
          fontWeight: 700,
          lineHeight: 1.1,
          color: 'var(--text-primary)',
          marginBottom: 6,
        }}
      >
        {value}
        {suffix && (
          <span
            style={{ fontSize: 18, fontWeight: 500, marginLeft: 4, color: 'var(--text-secondary)' }}
          >
            {suffix}
          </span>
        )}
      </div>

      {/* Badges */}
      {badges && badges.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
          {badges.map((badge) => (
            <Tag
              key={badge.text}
              bordered={false}
              style={{
                background: badgeBg[badge.tone],
                color: badgeColor[badge.tone],
                fontWeight: 500,
                fontSize: 11,
                borderRadius: 4,
                padding: '1px 6px',
                margin: 0,
              }}
            >
              {badge.text}
            </Tag>
          ))}
        </div>
      )}

      {/* Progress bar */}
      {progress !== undefined && (
        <Progress
          percent={progress.value}
          showInfo={false}
          strokeColor={progress.color ?? toneProgressColor[tone]}
          style={{ marginBottom: 4 }}
          size="small"
        />
      )}

      {/* Helper text */}
      {helper && (
        <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 2 }}>
          {helper}
        </Text>
      )}

      {/* Delta */}
      {delta && (
        <div
          style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}
        >
          <Text
            style={{
              fontSize: 12,
              fontWeight: 500,
              color: deltaPositive ? 'var(--severity-low-tag)' : 'var(--severity-critical-tag)',
            }}
          >
            {delta.direction === 'up' ? <ArrowUpOutlined /> : <ArrowDownOutlined />} {delta.value}
          </Text>
          {delta.label && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              {delta.label}
            </Text>
          )}
        </div>
      )}

      {/* Link */}
      {link && (
        <div style={{ marginTop: 8 }}>
          <a
            onClick={(e) => {
              e.preventDefault();
              navigate(link.href);
            }}
            href={link.href}
            style={{
              fontSize: 12,
              fontWeight: 500,
              color: 'var(--brand-primary)',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            {link.text} →
          </a>
        </div>
      )}
    </Card>
  );
}
