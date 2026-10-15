import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Badge, Button, Card, Input, List, Popover, Select, Space, Tag, Typography } from 'antd';
import { FilterOutlined, SearchOutlined } from '@ant-design/icons';
import { api, type AuditLog } from '../../lib/api';

const { Text } = Typography;

const formatAction = (action: string) => action.replace(/_/g, ' ');
const getActor = (log: AuditLog) => log.actorName || log.actorUid || 'system';

export default function AdminAuditLogPage() {
  const [search, setSearch] = React.useState('');
  const [actionFilter, setActionFilter] = React.useState<string | undefined>();

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['admin-audit-logs'],
    queryFn: () => api.get<AuditLog[]>('/api/audit-logs'),
    refetchInterval: 30000,
  });

  const actionOptions = React.useMemo(
    () =>
      Array.from(new Set(logs.map((log) => log.action)))
        .filter(Boolean)
        .sort()
        .map((action) => ({ label: formatAction(action), value: action })),
    [logs],
  );

  const filteredLogs = React.useMemo(() => {
    const query = search.trim().toLowerCase();
    return logs.filter((log) => {
      if (actionFilter && log.action !== actionFilter) return false;
      if (!query) return true;
      return [
        log.action,
        formatAction(log.action),
        getActor(log),
        log.reportReferenceNumber,
        new Date(log.timestamp).toLocaleString(),
      ].some((value) => value?.toLowerCase().includes(query));
    });
  }, [logs, search, actionFilter]);

  const filterContent = (
    <Space direction="vertical" size={8} style={{ width: 220 }}>
      <Text type="secondary">Action</Text>
      <Select
        aria-label="Filter by action"
        allowClear
        placeholder="All actions"
        options={actionOptions}
        value={actionFilter}
        onChange={setActionFilter}
        style={{ width: '100%' }}
      />
    </Space>
  );

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Space.Compact style={{ display: 'flex', width: '100%' }}>
        <Input
          aria-label="Search audit logs"
          allowClear
          prefix={<SearchOutlined />}
          placeholder="Search user, action, report no., or timestamp"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          style={{ flex: 1 }}
        />
        <Popover trigger="click" placement="bottomRight" content={filterContent}>
          <Button icon={<FilterOutlined />}>
            Filters {actionFilter && <Badge dot />}
          </Button>
        </Popover>
      </Space.Compact>

      <Card className="soft-card">
        <List
          loading={isLoading}
          dataSource={filteredLogs}
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