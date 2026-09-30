import { Grid, Segmented, Select } from 'antd';
import { formatStatus } from './StatusTag';

const options = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: formatStatus('pending') },
  { value: 'verified', label: formatStatus('verified') },
  { value: 'acknowledged', label: formatStatus('acknowledged') },
  { value: 'in_progress', label: formatStatus('in_progress') },
  { value: 'resolved', label: formatStatus('resolved') },
  { value: 'flagged', label: formatStatus('flagged') },
];

interface StatusFilterProps {
  value: string;
  onChange: (value: string) => void;
}

export default function StatusFilter({ value, onChange }: StatusFilterProps) {
  const screens = Grid.useBreakpoint();

  if (!screens.md) {
    return (
      <Select
        aria-label="Filter incidents by status"
        value={value}
        options={options}
        onChange={onChange}
        style={{ width: '100%' }}
      />
    );
  }

  return <Segmented value={value} options={options} onChange={onChange} />;
}
