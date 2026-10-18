import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Badge, Button, Card, Input, List, Popover, Select, Space, Tag, Typography } from 'antd';
import { FilterOutlined, SearchOutlined } from '@ant-design/icons';
import { api, type AuditLog } from '../../lib/api';

const { Text } = Typography;

type DatePeriod = 'date' | 'month';

interface AuditFilterOptions {
  actions: string[];
}

// The admin role is shown as "Sysadmin".
const ROLE_OPTIONS = [
  { value: 'resident', label: 'Resident' },
  { value: 'tanod', label: 'Tanod' },
  { value: 'responder', label: 'Responder' },
  { value: 'captain', label: 'Captain' },
  { value: 'secretary', label: 'Secretary' },
  { value: 'admin', label: 'Sysadmin' },
];
const getRoleLabel = (role?: string | null) =>
  ROLE_OPTIONS.find((option) => option.value === role)?.label ?? role ?? '';

const formatAction = (action: string) => action.replace(/_/g, ' ');
// One-line summary of the details an admin-related entry carries.
function summarizeMetadata(log: { action: string; metadata: Record<string, unknown> }) {
  const m = log.metadata || {};
  const target = (m.targetName as string) || (m.targetEmail as string) || (m.targetUid as string);
  switch (log.action) {
    case 'user_created':
      return `Created ${m.role ?? 'user'} account for ${target ?? 'unknown user'}`;
    case 'user_status_changed':
    case 'user_role_changed':
      return `${target ?? 'Unknown user'}: ${m.from ?? '?'} → ${m.to ?? '?'}`;
    case 'admin_notification_sent':
      return `${m.type ?? 'notification'} sent to ${m.recipientCount ?? 0} admin(s)${m.urgent ? ' (urgent)' : ''}`;
    case 'admin_notification_read':
      return `Read ${m.type ?? 'notification'}`;
    case 'admin_notification_read_all':
      return `Marked ${m.count ?? 0} notification(s) as read`;
    default:
      return null;
  }
}
const getActor = (log: AuditLog) => log.actorName || log.actorUid || 'system';

// The browser's local time decides where a day or month starts and ends, so
// "October" means October in the user's own time zone. `from` is inclusive and
// `to` is exclusive.
function getDateRange(period: DatePeriod, value: string) {
  const parts = value.split('-').map(Number);
  if (!value || parts.some((part) => !Number.isFinite(part))) return null;

  const [year, month, day] = parts;
  const from = period === 'date' ? new Date(year, month - 1, day) : new Date(year, month - 1, 1);
  const to = period === 'date' ? new Date(year, month - 1, day + 1) : new Date(year, month, 1);
  return Number.isNaN(from.getTime()) ? null : { from, to };
}

export default function AdminAuditLogPage() {
  const [search, setSearch] = React.useState('');
  const [actionFilter, setActionFilter] = React.useState<string | undefined>();
  const [roleFilter, setRoleFilter] = React.useState<string | undefined>();
  const [datePeriod, setDatePeriod] = React.useState<DatePeriod>('date');
  const [dateValue, setDateValue] = React.useState('');

  const range = React.useMemo(() => getDateRange(datePeriod, dateValue), [datePeriod, dateValue]);

  // Filters are applied on the server so older entries can be found, and again
  // below so the page still behaves if the server ignores them.
  const { data: logs = [], isLoading } = useQuery({
    queryKey: [
      'admin-audit-logs',
      'list',
      { role: roleFilter, action: actionFilter, from: range?.from, to: range?.to },
    ],
    queryFn: () => {
      const params = new URLSearchParams();
      if (roleFilter) params.set('role', roleFilter);
      if (actionFilter) params.set('action', actionFilter);
      if (range) {
        params.set('from', range.from.toISOString());
        params.set('to', range.to.toISOString());
      }
      const queryString = params.toString();
      return api.get<AuditLog[]>(`/api/audit-logs${queryString ? `?${queryString}` : ''}`);
    },
    refetchInterval: 30000,
  });

  // Every action in the log, so the dropdown does not shrink as you filter.
  const { data: filterOptions } = useQuery({
    queryKey: ['admin-audit-logs', 'filters'],
    queryFn: () => api.get<AuditFilterOptions>('/api/audit-logs/filters'),
    staleTime: 60000,
    retry: false,
  });

  const actionOptions = React.useMemo(
    () =>
      Array.from(new Set([...(filterOptions?.actions ?? []), ...logs.map((log) => log.action)]))
        .filter(Boolean)
        .sort()
        .map((action) => ({ label: formatAction(action), value: action })),
    [filterOptions, logs]
  );

  const filteredLogs = React.useMemo(() => {
    const query = search.trim().toLowerCase();
    return logs.filter((log) => {
      if (actionFilter && log.action !== actionFilter) return false;
      if (roleFilter && log.actorRole !== roleFilter) return false;
      if (range) {
        const time = new Date(log.timestamp).getTime();
        if (time < range.from.getTime() || time >= range.to.getTime()) return false;
      }
      if (!query) return true;
      return [
        log.action,
        formatAction(log.action),
        getActor(log),
        log.reportReferenceNumber,
        new Date(log.timestamp).toLocaleString(),
      ].some((value) => value?.toLowerCase().includes(query));
    });
  }, [logs, search, actionFilter, roleFilter, range]);

  const clearFilters = () => {
    setActionFilter(undefined);
    setRoleFilter(undefined);
    setDatePeriod('date');
    setDateValue('');
  };

  const activeFilters = [
    roleFilter && {
      key: 'role',
      label: `User role: ${getRoleLabel(roleFilter)}`,
      onClose: () => setRoleFilter(undefined),
    },
    actionFilter && {
      key: 'action',
      label: `Action: ${formatAction(actionFilter)}`,
      onClose: () => setActionFilter(undefined),
    },
    dateValue && {
      key: 'date',
      label: `${datePeriod === 'month' ? 'Month' : 'Date'}: ${dateValue}`,
      onClose: () => setDateValue(''),
    },
  ].filter(Boolean) as { key: string; label: string; onClose: () => void }[];

  const filterTags = activeFilters.length ? (
    <Space size={2} style={{ maxWidth: 360, overflow: 'hidden' }}>
      {activeFilters.map((filter) => (
        <Tag key={filter.key} closable onClose={filter.onClose} style={{ marginInlineEnd: 0 }}>
          {filter.label}
        </Tag>
      ))}
    </Space>
  ) : undefined;

  const filterContent = (
    <Space direction="vertical" size={16} style={{ width: 320, maxWidth: '100%' }}>
      <Space direction="vertical" size={4} style={{ width: '100%' }}>
        <Text type="secondary">User role</Text>
        <Select
          aria-label="Filter by user role"
          allowClear
          placeholder="All roles"
          options={ROLE_OPTIONS}
          value={roleFilter}
          onChange={setRoleFilter}
          style={{ width: '100%' }}
        />
      </Space>

      <Space direction="vertical" size={4} style={{ width: '100%' }}>
        <Text type="secondary">Action</Text>
        <Select
          aria-label="Filter by action"
          allowClear
          showSearch
          optionFilterProp="label"
          placeholder="All actions"
          options={actionOptions}
          value={actionFilter}
          onChange={setActionFilter}
          style={{ width: '100%' }}
        />
      </Space>

      <Space direction="vertical" size={4} style={{ width: '100%' }}>
        <Text type="secondary">Date or month</Text>
        <Space.Compact style={{ width: '100%' }}>
          <Select
            aria-label="Date filter type"
            value={datePeriod}
            style={{ width: 110 }}
            options={[
              { value: 'date', label: 'Date' },
              { value: 'month', label: 'Month' },
            ]}
            onChange={(value) => {
              setDatePeriod(value);
              setDateValue('');
            }}
          />
          <Input
            aria-label={`Filter by ${datePeriod}`}
            type={datePeriod}
            value={dateValue}
            onChange={(event) => setDateValue(event.target.value)}
            style={{ flex: 1 }}
          />
        </Space.Compact>
      </Space>

      <Button type="link" danger onClick={clearFilters} disabled={!activeFilters.length}>
        Clear all filters
      </Button>
    </Space>
  );

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Space.Compact style={{ display: 'flex', width: '100%' }}>
        <Input
          aria-label="Search audit logs"
          allowClear
          prefix={<SearchOutlined />}
          suffix={filterTags}
          placeholder="Search user, action, report no., or timestamp"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          style={{ flex: 1 }}
        />
        <Popover trigger="click" placement="bottomRight" content={filterContent}>
          <Button icon={<FilterOutlined />}>
            Filters <Badge count={activeFilters.length} size="small" />
          </Button>
        </Popover>
      </Space.Compact>

      <Card className="soft-card">
        <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
          {filteredLogs.length} {filteredLogs.length === 1 ? 'entry' : 'entries'}
          {logs.length !== filteredLogs.length ? ` of ${logs.length} loaded` : ''}
        </Text>
        <List
          // A new key sends the list back to page 1 whenever a filter changes.
          key={`${search}|${roleFilter}|${actionFilter}|${datePeriod}|${dateValue}`}
          loading={isLoading}
          dataSource={filteredLogs}
          pagination={{ pageSize: 10, hideOnSinglePage: true, showSizeChanger: false }}
          locale={{ emptyText: 'No audit logs found' }}
          renderItem={(log) => (
            <List.Item key={log._id}>
              <List.Item.Meta
                title={
                  <Space>
                    <Text strong>{log.action}</Text>
                    <Tag>{getActor(log)}</Tag>
                    
                  </Space>
                }
                description={
                  <Space direction="vertical" size={2}>
                    <Text type="secondary">{new Date(log.timestamp).toLocaleString()}</Text>
                    <Text type="secondary">{log.userAgent || 'No user agent'}</Text>
                    <Text type="secondary">{new Date(log.timestamp).toLocaleString()}</Text>
{summarizeMetadata(log) && <Text>{summarizeMetadata(log)}</Text>}
                  </Space>
                }
              />
            </List.Item>
          )}
        />
      </Card>
    </Space>
  );
}