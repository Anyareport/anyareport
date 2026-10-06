import type { ReactNode } from 'react';
import { Grid, Segmented, Select } from 'antd';
import { formatStatus } from './StatusTag';

type FilterOption = { value: string; label: ReactNode };

const statusOptions: FilterOption[] = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: formatStatus('pending') },
  { value: 'coordinating', label: formatStatus('coordinating') },
  { value: 'in_progress', label: formatStatus('in_progress') },
  { value: 'resolved', label: formatStatus('resolved') },
  { value: 'flagged', label: formatStatus('flagged') },
];

interface StatusFilterProps {
  value: string;
  onChange: (value: string) => void;
  layout?: 'responsive' | 'select';
}

interface FilterControlProps extends StatusFilterProps {
  options: FilterOption[];
  ariaLabel?: string;
}

export function FilterControl({
  value,
  onChange,
  options,
  ariaLabel = 'Filter options',
  layout = 'responsive',
}: FilterControlProps) {
  const screens = Grid.useBreakpoint();

  if (layout === 'select' || !screens.md) {
    return (
      <Select
        aria-label={ariaLabel}
        value={value}
        options={options}
        onChange={onChange}
        style={{ width: '100%' }}
      />
    );
  }

  return (
    <Segmented
      value={value}
      options={options}
      onChange={(nextValue) => onChange(String(nextValue))}
    />
  );
}

export default function StatusFilter({
  value,
  onChange,
  layout = 'responsive',
}: StatusFilterProps) {
  return (
    <FilterControl
      value={value}
      onChange={onChange}
      layout={layout}
      options={statusOptions}
      ariaLabel="Filter incidents by status"
    />
  );
}
