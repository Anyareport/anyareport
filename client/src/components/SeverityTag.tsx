import { Tag } from 'antd';

const SEVERITY_COLOR: Record<string, string> = {
  Critical: 'red',
  High: 'orange',
  Medium: 'gold',
  Low: 'default',
};

const SEVERITY_ORDER: Record<string, number> = {
  Critical: 0,
  High: 1,
  Medium: 2,
  Low: 3,
};

export function getSeverityOrder(severity: string | null | undefined): number {
  return SEVERITY_ORDER[severity ?? ''] ?? 4;
}

export default function SeverityTag({ severity }: { severity: string | null | undefined }) {
  if (!severity) return null;
  return (
    <Tag color={SEVERITY_COLOR[severity] ?? 'default'}>
      {severity}
    </Tag>
  );
}
