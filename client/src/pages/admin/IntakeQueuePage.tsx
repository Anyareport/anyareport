import { useQuery } from '@tanstack/react-query';
import { Button, Input, Popover, Select, Space, Tag } from 'antd';
import { FilterOutlined, SearchOutlined } from '@ant-design/icons';
import { useState, useMemo } from 'react';
import { api, type Report } from '../../lib/api';
import IncidentList from '../../components/IncidentList';
import StatusFilter from '../../components/StatusFilter';
import { compareIncidentPriority } from '../../lib/sortUtils';
import {
  getLocationLabel,
  isIncidentInPeriod,
  matchesIncidentSearch,
} from '../../lib/incidentUtils';

export default function SecretaryIntakePage() {
  const [status, setStatus] = useState<string | 'all'>('pending');
  const [search, setSearch] = useState('');
  const [datePeriod, setDatePeriod] = useState<'date' | 'month' | 'year'>('date');
  const [date, setDate] = useState('');
  const [category, setCategory] = useState('');
  const [subcategory, setSubcategory] = useState('');
  const [location, setLocation] = useState('');

  const { data: reports = [] } = useQuery({
    queryKey: ['secretary-intake', status],
    queryFn: () => api.get<Report[]>(`/api/reports${status === 'all' ? '' : `?status=${status}`}`),
    refetchInterval: 30000,
  });

  const sorted = useMemo(() => {
    return [...reports]
      .sort(compareIncidentPriority)
      .filter(
        (report) =>
          matchesIncidentSearch(report, search) &&
          isIncidentInPeriod(report, datePeriod, date) &&
          (!category || report.category === category) &&
          (!subcategory || report.subcategory === subcategory) &&
          (!location || getLocationLabel(report) === location)
      );
  }, [category, date, datePeriod, location, reports, search, subcategory]);

  const categoryOptions = useMemo(
    () =>
      [...new Set(reports.map((report) => report.category).filter(Boolean))]
        .sort()
        .map((value) => ({ value, label: value })),
    [reports]
  );
  const subcategoryOptions = useMemo(
    () =>
      [
        ...new Set(
          reports
            .filter((report) => !category || report.category === category)
            .map((report) => report.subcategory)
            .filter((value): value is string => Boolean(value))
        ),
      ]
        .sort()
        .map((value) => ({ value, label: value })),
    [category, reports]
  );
  const locationOptions = useMemo(
    () =>
      [...new Set(reports.map((report) => getLocationLabel(report)).filter(Boolean))]
        .sort((first, second) => first.localeCompare(second))
        .map((value) => ({ value, label: value })),
    [reports]
  );

  const dateFilter = (
    <Space.Compact style={{ width: '100%' }}>
      <Select
        aria-label="Date filter period"
        value={datePeriod}
        style={{ width: 100 }}
        options={[
          { value: 'date', label: 'Date' },
          { value: 'month', label: 'Month' },
          { value: 'year', label: 'Year' },
        ]}
        onChange={(value) => {
          setDatePeriod(value);
          setDate('');
        }}
      />
      <Input
        aria-label={`Filter intake incidents by ${datePeriod}`}
        type={datePeriod === 'year' ? 'number' : datePeriod}
        min={datePeriod === 'year' ? 1900 : undefined}
        max={datePeriod === 'year' ? 2100 : undefined}
        value={date}
        onChange={(event) => setDate(event.target.value)}
        style={{ flex: 1 }}
      />
    </Space.Compact>
  );

  const clearFilters = () => {
    setStatus('pending');
    setDatePeriod('date');
    setDate('');
    setCategory('');
    setSubcategory('');
    setLocation('');
  };

  const activeFilterTags = [
    status !== 'pending' && {
      key: 'status',
      label: `Status: ${status}`,
      onClose: () => setStatus('pending'),
    },
    date && {
      key: 'date',
      label: `${datePeriod}: ${date}`,
      onClose: () => {
        setDatePeriod('date');
        setDate('');
      },
    },
    category && { key: 'category', label: `Category: ${category}`, onClose: () => setCategory('') },
    subcategory && {
      key: 'subcategory',
      label: `Subcategory: ${subcategory}`,
      onClose: () => setSubcategory(''),
    },
    location && { key: 'location', label: `Location: ${location}`, onClose: () => setLocation('') },
  ].filter(Boolean) as { key: string; label: string; onClose: () => void }[];

  const filterTags = activeFilterTags.length ? (
    <Space size={2} style={{ maxWidth: 260, overflow: 'hidden' }}>
      {activeFilterTags.map((filter) => (
        <Tag key={filter.key} closable onClose={filter.onClose} style={{ marginInlineEnd: 0 }}>
          {filter.label}
        </Tag>
      ))}
    </Space>
  ) : undefined;

  const incidentFilters = (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      <Select
        aria-label="Filter intake incidents by category"
        allowClear
        placeholder="Category"
        value={category || undefined}
        options={categoryOptions}
        style={{ width: '100%' }}
        onChange={(value) => {
          setCategory(value ?? '');
          setSubcategory('');
        }}
      />
      <Select
        aria-label="Filter intake incidents by subcategory"
        allowClear
        placeholder="Subcategory"
        value={subcategory || undefined}
        options={subcategoryOptions}
        style={{ width: '100%' }}
        onChange={(value) => setSubcategory(value ?? '')}
      />
      <Select
        aria-label="Filter intake incidents by location"
        allowClear
        placeholder="Location"
        value={location || undefined}
        options={locationOptions}
        style={{ width: '100%' }}
        onChange={(value) => setLocation(value ?? '')}
      />
    </Space>
  );

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Space.Compact style={{ display: 'flex', width: '100%' }}>
        <Input
          aria-label="Search intake incidents"
          allowClear
          prefix={<SearchOutlined />}
          suffix={filterTags}
          placeholder="Search submitter, incident name, or ID"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          style={{ flex: 1 }}
        />
        <Popover
          trigger="click"
          placement="bottomLeft"
          content={
            <Space direction="vertical" size={16} style={{ width: 320, maxWidth: '100%' }}>
              <StatusFilter value={status} onChange={setStatus} layout="select" />
              {dateFilter}
              {incidentFilters}
              <Button type="link" danger onClick={clearFilters} disabled={!activeFilterTags.length}>
                Clear all filters
              </Button>
            </Space>
          }
        >
          <Button icon={<FilterOutlined />}>Filters</Button>
        </Popover>
      </Space.Compact>

      {/* <Card className="soft-card" title="Intake monitor"> */}
      <IncidentList reports={sorted} basePath="/admin/incidents" />
      {/* </Card> */}
    </Space>
  );
}
