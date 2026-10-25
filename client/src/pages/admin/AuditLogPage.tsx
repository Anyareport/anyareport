import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Button,
  Card,
  Checkbox,
  Input,
  List,
  Popover,
  Select,
  Space,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import { ExportOutlined, FilterOutlined, SearchOutlined } from '@ant-design/icons';
import { api, type AuditLog } from '../../lib/api';
import { downloadCsv, toCsv } from '../../lib/csv';
import {
  getAuditActorRole,
  getAuditLabel,
  getAuditSummary,
  NOTIFICATION_AUDIT_ACTIONS,
} from '../../lib/auditLabels';
import AuditActivityRow from '../../components/AuditActivityRow';
import './AuditLogPage.css';

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

function getLocalDateKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function formatDateHeading(timestamp: string) {
  const date = new Date(timestamp);
  const today = new Date();
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  const fullDate = date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  if (getLocalDateKey(date) === getLocalDateKey(today)) return `Today · ${fullDate}`;
  if (getLocalDateKey(date) === getLocalDateKey(yesterday)) return `Yesterday · ${fullDate}`;
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function AdminAuditLogPage() {
  const [search, setSearch] = React.useState('');
  const [actionFilter, setActionFilter] = React.useState<string | undefined>();
  const [roleFilter, setRoleFilter] = React.useState<string | undefined>();
  const [datePeriod, setDatePeriod] = React.useState<DatePeriod>('date');
  const [dateValue, setDateValue] = React.useState('');
  const [hideNotificationEvents, setHideNotificationEvents] = React.useState(true);
  const [pageState, setPageState] = React.useState({ filterKey: '', page: 1 });
  const filterKey = JSON.stringify([
    search,
    roleFilter,
    actionFilter,
    datePeriod,
    dateValue,
    hideNotificationEvents,
  ]);
  const currentPage = pageState.filterKey === filterKey ? pageState.page : 1;

  const range = React.useMemo(() => getDateRange(datePeriod, dateValue), [datePeriod, dateValue]);

  // Filters are applied on the server so older entries can be found, and again
  // below so the page still behaves if the server ignores them.
  const { data: logs = [], isLoading } = useQuery({
    queryKey: [
      'admin-audit-logs',
      'list',
      {
        role: roleFilter,
        action: actionFilter,
        from: range?.from,
        to: range?.to,
        hideNotificationEvents,
      },
    ],
    queryFn: () => {
      const params = new URLSearchParams();
      if (roleFilter) params.set('role', roleFilter);
      if (actionFilter) params.set('action', actionFilter);
      if (hideNotificationEvents) params.set('excludeActions', NOTIFICATION_AUDIT_ACTIONS.join(','));
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
        .map((action) => ({
          label: getAuditLabel({ action, metadata: {} }).label,
          value: action,
        })),
    [filterOptions, logs]
  );

  const filteredLogs = React.useMemo(() => {
    const query = search.trim().toLowerCase();
    return logs.filter((log) => {
      if (hideNotificationEvents && NOTIFICATION_AUDIT_ACTIONS.includes(log.action)) return false;
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
        getAuditLabel(log).label,
        getAuditSummary(log),
        getActor(log),
        log.actorRole,
        log.reportReferenceNumber,
        new Date(log.timestamp).toLocaleString(),
      ].some((value) => value?.toLowerCase().includes(query));
    });
  }, [logs, search, actionFilter, roleFilter, range, hideNotificationEvents]);

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
      label: `Action: ${getAuditLabel({ action: actionFilter, metadata: {} }).label}`,
      onClose: () => setActionFilter(undefined),
    },
    dateValue && {
      key: 'date',
      label: `${datePeriod === 'month' ? 'Month' : 'Date'}: ${dateValue}`,
      onClose: () => setDateValue(''),
    },
  ].filter(Boolean) as { key: string; label: string; onClose: () => void }[];

  const filterTags = activeFilters.length ? (
    <Space wrap size={[4, 4]} style={{ width: '100%' }}>
      {activeFilters.map((filter) => (
        <Tag
          key={filter.key}
          closable
          onClose={filter.onClose}
          style={{ marginInlineEnd: 0, maxWidth: '100%', whiteSpace: 'normal', overflowWrap: 'anywhere' }}
        >
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
          onChange={(action) => {
            setActionFilter(action);
            if (action && NOTIFICATION_AUDIT_ACTIONS.includes(action)) {
              setHideNotificationEvents(false);
            }
          }}
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
      <div className="audit-log-toolbar">
        <Space.Compact className="audit-log-toolbar__search">
          <Input
            aria-label="Search audit logs"
            allowClear
            prefix={<SearchOutlined />}
            placeholder="Search user, action, report no., or timestamp"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <Popover trigger="click" placement="bottomRight" content={filterContent}>
            <Button icon={<FilterOutlined />}>Filters</Button>
          </Popover>
        </Space.Compact>
        <Tooltip title="Exports filtered results from the entries currently loaded">
          <Button
            className="audit-log-toolbar__export"
            color="primary"
            variant="solid"
            icon={<ExportOutlined />}
            onClick={() => {
              const rows = filteredLogs.map((log) => [
                log.timestamp,
                getAuditLabel(log).label,
                getActor(log),
                getAuditActorRole(log.actorRole),
                getAuditSummary(log),
              ]);
              downloadCsv(
                'anyareport-audit-loaded.csv',
                toCsv(['Timestamp', 'Action', 'Actor', 'Actor role', 'Summary'], rows)
              );
            }}
          >
            Export
          </Button>
        </Tooltip>
      </div>
      {filterTags}

      <Card className="soft-card audit-log-card">
        <Space className="audit-log-card__toolbar" style={{ display: 'flex', justifyContent: 'space-between' }}>
          <Text type="secondary">
            {`Showing ${filteredLogs.length} of ${logs.length} loaded ${logs.length === 1 ? 'entry' : 'entries'}`}
          </Text>
          <Checkbox
            checked={hideNotificationEvents}
            onChange={(event) => setHideNotificationEvents(event.target.checked)}
          >
            Hide notification events
          </Checkbox>
        </Space>
        <List
          key={filterKey}
          loading={isLoading}
          dataSource={filteredLogs}
          pagination={{
            current: currentPage,
            pageSize: 10,
            hideOnSinglePage: true,
            showSizeChanger: false,
            onChange: (page) => setPageState({ filterKey, page }),
          }}
          locale={{ emptyText: 'No audit logs found' }}
          renderItem={(log, index) => {
            const globalIndex = (currentPage - 1) * 10 + index;
            const previousLog = globalIndex > 0 ? filteredLogs[globalIndex - 1] : null;
            const dateKey = getLocalDateKey(new Date(log.timestamp));
            const startsDateGroup =
              index === 0 ||
              !previousLog ||
              getLocalDateKey(new Date(previousLog.timestamp)) !== dateKey;

            return (
              <React.Fragment key={log._id}>
                {startsDateGroup && (
                  <li className="audit-date-heading">
                    <time dateTime={new Date(log.timestamp).toISOString()}>
                      {formatDateHeading(log.timestamp)}
                    </time>
                  </li>
                )}
                <List.Item>
                  <AuditActivityRow
                    log={log}
                    showDetails
                    timeLabel={new Date(log.timestamp).toLocaleTimeString(undefined, {
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  />
                </List.Item>
              </React.Fragment>
            );
          }}
        />
      </Card>
    </Space>
  );
}