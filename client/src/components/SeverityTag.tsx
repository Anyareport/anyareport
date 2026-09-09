import { Tag } from 'antd';

export { getSeverityOrder } from '../lib/sortUtils';

const SEVERITY_COLOR: Record<string, string> = {
  Critical: 'red',
  High: 'orange',
  Medium: 'gold',
  Low: 'default',
};

export default function SeverityTag({ severity }: { severity: string | null | undefined }) {
  if (!severity) return null;
  return <Tag color={SEVERITY_COLOR[severity] ?? 'default'}>{severity}</Tag>;
}
