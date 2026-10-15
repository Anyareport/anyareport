import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Drawer, Form, Input, Select, Space, Table, Tabs, Tag, message } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { api, type UserProfile } from '../../lib/api';

const roleOptions = [
  { label: 'Resident', value: 'resident' },
  { label: 'Tanod', value: 'tanod' },
  { label: 'Responder', value: 'responder' },
  { label: 'Captain', value: 'captain' },
  { label: 'Secretary', value: 'secretary' },
  { label: 'Admin', value: 'admin' },
];

export default function AdminUsersPage() {
  const queryClient = useQueryClient();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form] = Form.useForm();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string | undefined>();
  const [group, setGroup] = useState<'officials' | 'residents'>('officials');

  const { data: users = [] } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => api.get<UserProfile[]>('/api/admin/users'),
    refetchInterval: 30000,
  });

  // Search matches name, email, phone and address. Officials and residents are
  // listed separately; the role filter only applies to officials.
  const { officials, residents } = useMemo(() => {
    const terms = search.toLowerCase().trim().split(/\s+/).filter(Boolean);
    const matchesSearch = (user: UserProfile) => {
      const haystack = [user.name, user.email, user.phone, user.address]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return terms.every((term) => haystack.includes(term));
    };
    const matching = users.filter(matchesSearch);
    return {
      officials: matching.filter(
        (user) => user.role !== 'resident' && (!roleFilter || user.role === roleFilter)
      ),
      residents: matching.filter((user) => user.role === 'resident'),
    };
  }, [users, search, roleFilter]);

  const createUser = useMutation({
    mutationFn: (values: Record<string, unknown>) => api.post('/api/admin/users', values),
    onSuccess: async () => {
      message.success('Official created');
      setDrawerOpen(false);
      form.resetFields();
      await queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (error: Error) => message.error(error.message),
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/api/admin/users/${id}/status`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-users'] }),
  });

  const updateRole = useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) =>
      api.patch(`/api/admin/users/${id}/role`, { role }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-users'] }),
  });

  const columns = [
    { title: 'Name', dataIndex: 'name', key: 'name' },
    { title: 'Email', dataIndex: 'email', key: 'email' },
    { title: 'Role', dataIndex: 'role', key: 'role', render: (role: string) => <Tag>{role}</Tag> },
    { title: 'Status', dataIndex: 'status', key: 'status' },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: unknown, user: UserProfile) => (
        <Space wrap>
          <Select
            style={{ width: 140 }}
            value={user.role}
            options={roleOptions}
            onChange={(value) => updateRole.mutate({ id: user._id, role: value })}
          />
          <Select
            style={{ width: 120 }}
            value={user.status}
            options={[
              { label: 'active', value: 'active' },
              { label: 'suspended', value: 'suspended' },
            ]}
            onChange={(value) => updateStatus.mutate({ id: user._id, status: value })}
          />
        </Space>
      ),
    },
  ];

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Space wrap style={{ width: '100%', justifyContent: 'space-between' }}>
        <Space wrap>
          <Input
            aria-label="Search users"
            allowClear
            prefix={<SearchOutlined />}
            placeholder="Search name, email, phone or address"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            style={{ width: 300, maxWidth: '100%' }}
          />
          {group === 'officials' && (
            <Select
              aria-label="Filter officials by role"
              allowClear
              placeholder="All roles"
              value={roleFilter}
              options={roleOptions.filter((option) => option.value !== 'resident')}
              onChange={(value) => setRoleFilter(value)}
              style={{ width: 160 }}
            />
          )}
        </Space>
        <Button type="primary" onClick={() => setDrawerOpen(true)}>
          Create official
        </Button>
      </Space>
      <Tabs
        activeKey={group}
        onChange={(key) => setGroup(key as 'officials' | 'residents')}
        items={[
          { key: 'officials', label: `Officials (${officials.length})` },
          { key: 'residents', label: `Residents (${residents.length})` },
        ]}
      />
      <Table
        rowKey="_id"
        dataSource={group === 'officials' ? officials : residents}
        columns={columns}
        pagination={{ pageSize: 8 }}
        scroll={{ x: true }}
      />

      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title="Create official">
        <Form layout="vertical" form={form} onFinish={(values) => createUser.mutate(values)}>
          <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="password" label="Password" rules={[{ required: true }]}>
            <Input.Password />
          </Form.Item>
          <Form.Item name="name" label="Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="phone" label="Phone" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="role" label="Role" rules={[{ required: true }]}>
            <Select options={roleOptions.filter((option) => option.value !== 'resident')} />
          </Form.Item>
          <Form.Item name="address" label="Address">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={createUser.isPending} block>
            Create
          </Button>
        </Form>
      </Drawer>
    </Space>
  );
}