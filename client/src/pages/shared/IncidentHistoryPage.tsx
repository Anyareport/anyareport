import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Input, Popover, Select, Space, Tag } from 'antd';
import { FilterOutlined, SearchOutlined } from '@ant-design/icons';
import { useSearchParams } from 'react-router-dom';
import { api, type Report } from '../../lib/api';
import IncidentList from '../../components/IncidentList';
import StatusFilter from '../../components/StatusFilter';
import { compareIncidentPriority } from '../../lib/sortUtils';
import {
  getLocationLabel,
  isIncidentInPeriod,
  matchesIncidentSearch,
} from '../../lib/incidentUtils';
import { useAuth } from '../../contexts/AuthContext';
import { useLang } from '../../contexts/LanguageContext';
import { getLocalizedCategory } from '../../i18n/labels';

export interface IncidentHistoryPageProps {
  variant?: 'admin' | 'responder';
  defaultStatus?: string | 'all';
}

export default function IncidentHistoryPage({
  variant = 'admin',
  defaultStatus = 'all',
}: IncidentHistoryPageProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const paramStatus = searchParams.get('status') ?? defaultStatus;
  const paramSeverity = searchParams.get('severity') ?? '';
  const paramStale = searchParams.get('stale') === 'true';
  const paramScope = searchParams.get('scope') ?? '';
  const paramVerification = searchParams.get('verification') ?? '';
  const paramVerifiedPeriod = searchParams.get('verifiedPeriod') ?? '';

  const [status, setStatus] = useState<string | 'all'>(paramStatus);
  const [search, setSearch] = useState('');
  const [datePeriod, setDatePeriod] = useState<'date' | 'month' | 'year'>('date');
  const [date, setDate] = useState('');
  const [category, setCategory] = useState('');
  const [subcategory, setSubcategory] = useState('');
  const [location, setLocation] = useState('');
  const [severity, setSeverity] = useState(paramSeverity);
  const { role } = useAuth();
  const { lang, t } = useLang();
  const translate =
    variant === 'responder' && lang === 'fil' && ['tanod', 'responder'].includes(role || '');

  const { data: reports = [] } = useQuery({
    queryKey:
      variant === 'responder' ? ['responder-history'] : ['admin-reports', status, paramScope, role],
    queryFn: async () => {
      if (variant === 'responder') return api.get<Report[]>('/api/reports?handledByMe=true');
      if (paramScope === 'inactive') {
        const result = await api.get<{ thresholdHours: number; reports: Report[] }>(
          '/api/reports/captain/inactive'
        );
        return result.reports;
      }

      return api.get<Report[]>(`/api/reports${status === 'all' ? '' : `?status=${status}`}`);
    },
    refetchInterval: 30000,
  });

  const filtered = useMemo(() => {
    const sorted = [...reports].sort(compareIncidentPriority);
    const weekStart = new Date();
    weekStart.setHours(0, 0, 0, 0);
    weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
    const matchesFilters = (report: Report) =>
      matchesIncidentSearch(report, search) &&
      (status === 'all' || report.status === status) &&
      (paramScope !== 'open' || !['resolved', 'flagged'].includes(report.status)) &&
      (!paramVerification || report.resolution?.verificationStatus === paramVerification) &&
      (paramVerifiedPeriod !== 'week' ||
        (report.resolution?.verificationStatus === 'verified' &&
          report.resolution.verifiedAt &&
          new Date(report.resolution.verifiedAt).getTime() >= weekStart.getTime())) &&
      isIncidentInPeriod(report, datePeriod, date) &&
      (!category || report.category === category) &&
      (!subcategory || report.subcategory === subcategory) &&
      (!location || getLocationLabel(report) === location) &&
      (!severity || report.severity === severity) &&
      (!paramStale ||
        (() => {
          const ageDays =
            (Date.now() - new Date(report.updatedAt).getTime()) / (1000 * 60 * 60 * 24);
          return report.status !== 'resolved' && ageDays >= 7;
        })());

    if (variant === 'responder') {
      return sorted
        .filter((report) => report.status === 'resolved' || report.status === 'flagged')
        .filter(matchesFilters);
    }

    return sorted.filter(matchesFilters);
  }, [
    category,
    date,
    datePeriod,
    location,
    paramScope,
    paramStale,
    paramVerification,
    paramVerifiedPeriod,
    reports,
    search,
    severity,
    status,
    subcategory,
    variant,
  ]);

  const categoryOptions = useMemo(
    () =>
      [...new Set(reports.map((report) => report.category).filter(Boolean))]
        .sort()
        .map((value) => ({
          value,
          label: translate ? getLocalizedCategory(value, null, t).category : value,
        })),
    [reports, t, translate]
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
        .map((value) => ({
          value,
          label: translate ? getLocalizedCategory('', value, t).subcategory || value : value,
        })),
    [category, reports, t, translate]
  );
  const locationOptions = useMemo(
    () =>
      [...new Set(reports.map((report) => getLocationLabel(report)).filter(Boolean))]
        .sort((first, second) => first.localeCompare(second))
        .map((value) => ({ value, label: value })),
    [reports]
  );

  const incidentFilters = (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      <Select
        aria-label="Filter incidents by category"
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
        aria-label="Filter incidents by subcategory"
        allowClear
        placeholder="Subcategory"
        value={subcategory || undefined}
        options={subcategoryOptions}
        style={{ width: '100%' }}
        onChange={(value) => setSubcategory(value ?? '')}
      />
      <Select
        aria-label="Filter incidents by location"
        allowClear
        placeholder="Location"
        value={location || undefined}
        options={locationOptions}
        style={{ width: '100%' }}
        onChange={(value) => setLocation(value ?? '')}
      />
    </Space>
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
        aria-label={`Filter incidents by ${datePeriod}`}
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
    setStatus('all');
    setDatePeriod('date');
    setDate('');
    setCategory('');
    setSubcategory('');
    setLocation('');
    setSeverity('');
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      ['status', 'severity', 'stale', 'scope', 'verification', 'verifiedPeriod'].forEach((key) =>
        next.delete(key)
      );
      return next;
    });
  };

  const removeSearchParams = (...keys: string[]) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      keys.forEach((key) => next.delete(key));
      return next;
    });
  };

  const activeFilterTags = [
    paramScope === 'open' && {
      key: 'scope',
      label: 'Open incidents',
      onClose: () => removeSearchParams('scope'),
    },
    paramScope === 'inactive' && {
      key: 'scope',
      label: 'Inactive incidents',
      onClose: () => removeSearchParams('scope'),
    },
    paramVerification && {
      key: 'verification',
      label: `Verification: ${paramVerification}`,
      onClose: () => removeSearchParams('verification'),
    },
    paramVerifiedPeriod === 'week' && {
      key: 'verifiedPeriod',
      label: 'Verified this week',
      onClose: () => removeSearchParams('verifiedPeriod'),
    },
    status !== 'all' && {
      key: 'status',
      label: `Status: ${status}`,
      onClose: () => {
        setStatus('all');
        removeSearchParams('status');
      },
    },
    severity && {
      key: 'severity',
      label: `Severity: ${severity}`,
      onClose: () => setSeverity(''),
    },
    paramStale && {
      key: 'stale',
      label: 'No update in 7+ days',
      onClose: () => removeSearchParams('stale'),
    },
    date && {
      key: 'date',
      label: `${datePeriod}: ${date}`,
      onClose: () => {
        setDatePeriod('date');
        setDate('');
      },
    },
    category && {
      key: 'category',
      label: `${translate ? t('categoryFilter') : 'Category'}: ${
        translate ? getLocalizedCategory(category, null, t).category : category
      }`,
      onClose: () => setCategory(''),
    },
    subcategory && {
      key: 'subcategory',
      label: `${translate ? t('subcategoryFilter') : 'Subcategory'}: ${
        translate
          ? getLocalizedCategory('', subcategory, t).subcategory || subcategory
          : subcategory
      }`,
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

  // Responder-specific settings
  if (variant === 'responder') {
    return (
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Space.Compact style={{ display: 'flex', width: '100%' }}>
          <Input
            aria-label="Search incident history"
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
                {dateFilter}
                {incidentFilters}
                <Button
                  type="link"
                  danger
                  onClick={clearFilters}
                  disabled={!activeFilterTags.length}
                >
                  Clear all filters
                </Button>
              </Space>
            }
          >
            <Button icon={<FilterOutlined />}>Filters</Button>
          </Popover>
        </Space.Compact>

        {/* <Card className="soft-card" title="Incident history"> */}
        <IncidentList reports={filtered} basePath="/responder/incidents" />
        {/* </Card> */}
      </Space>
    );
  }

  // Admin/Secretary settings
  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Alert
        type="info"
        showIcon
        message={
          defaultStatus === 'pending'
            ? 'Pending intake reports are prioritized by emergency or critical severity, then by status and oldest submission date.'
            : 'Reports are prioritized by emergency or critical severity, then by status and submission date. Desktop table columns can also be sorted.'
        }
      />
      <Space.Compact style={{ display: 'flex', width: '100%' }}>
        <Input
          aria-label="Search incidents"
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

      <IncidentList
        reports={filtered}
        basePath="/admin/incidents"
        showSubmitter={['admin', 'captain', 'secretary'].includes(role || '')}
      />
    </Space>
  );
}
