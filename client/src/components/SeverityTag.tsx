import { WarningFilled } from '@ant-design/icons';

const SEVERITY_COLOR: Record<string, string> = {
  Critical: 'var(--severity-critical-tag)',
  High: 'var(--severity-high-tag)',
  Medium: 'var(--severity-medium-tag)',
  Low: 'var(--severity-low-tag)',
};

export default function SeverityTag({ severity }: { severity: string | null | undefined }) {
  if (!severity) return null;
  return (
    <WarningFilled
      style={{ fontSize: '20px', color: SEVERITY_COLOR[severity] ?? 'var(--neutral-400)' }}
    />
  );
}
