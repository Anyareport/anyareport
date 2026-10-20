import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Button,
  Card,
  Drawer,
  Dropdown,
  Form,
  Grid,
  Input,
  Modal,
  Pagination,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  message,
} from 'antd';
import { EllipsisOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons';
import { useSearchParams } from 'react-router-dom';
import { api, type UserProfile } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { getStatusTagStyle } from '../../lib/statusTagStyles';
import './UsersPage.css';

const PAGE_SIZE = 8;

const roleOptions = [
  { label: 'Resident', value: 'resident' },
  { label: 'Tanod', value: 'tanod' },
  { label: 'Responder', value: 'responder' },
  { label: 'Captain', value: 'captain' },
  { label: 'Secretary', value: 'secretary' },
  { label: 'Admin', value: 'admin' },
];

const roleTagStatuses: Record<string, string> = {
  resident: 'pending',
  tanod: 'coordinating',
  responder: 'coordinating',
  captain: 'in_progress',
  secretary: 'in_progress',
  admin: 'resolved',
};

function getRoleTagStyle(role: string) {
  return { ...getStatusTagStyle(roleTagStatuses[role] ?? ''), marginInlineEnd: 0 };
}

function getAccountStatusTagStyle(status: string) {
  return { ...getStatusTagStyle(status), marginInlineEnd: 0 };
}

export default function AdminUsersPage() {
  const { firebaseUser } = useAuth();
  const queryClient = useQueryClient();
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form] = Form.useForm();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string | undefined>();
  const [group, setGroup] = useState<'officials' | 'residents'>('officials');
  const [page, setPage] = useState(1);
  const [searchParams, setSearchParams] = useSearchParams();
  const statusParam = searchParams.get('status');
  const statusFilter =
    statusParam === 'active' || statusParam === 'suspended' ? statusParam : undefined;

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
    const matching = users.filter(
      (user) => matchesSearch(user) && (!statusFilter || user.status === statusFilter)
    );
    return {
      officials: matching.filter(
        (user) => user.role !== 'resident' && (!roleFilter || user.role === roleFilter)
      ),
      residents: matching.filter((user) => user.role === 'resident'),
    };
  }, [users, search, roleFilter, statusFilter]);

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
    mutationFn: ({ id, status }: { id: string; status: UserProfile['status'] }) =>
      api.patch(`/api/admin/users/${id}/status`, { status }),
    onSuccess: async (_data, variables) => {
      message.success(
        variables.status === 'suspended' ? 'Account suspended' : 'Account reactivated'
      );
      await queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (error: Error) => message.error(error.message),
  });

  const updateRole = useMutation({
    mutationFn: ({ id, role }: { id: string; role: UserProfile['role'] }) =>
      api.patch(`/api/admin/users/${id}/role`, { role }),
    onSuccess: async (_data, variables) => {
      message.success(`Role updated to ${getRoleLabel(variables.role)}`);
      await queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (error: Error) => message.error(error.message),
  });

  const visibleUsers = group === 'officials' ? officials : residents;
  const currentPage = Math.min(page, Math.max(1, Math.ceil(visibleUsers.length / PAGE_SIZE)));
  const pageUsers = visibleUsers.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const confirmRoleChange = (user: UserProfile, role: UserProfile['role']) => {
    if (role === user.role) return;
    Modal.confirm({
      title: 'Change role?',
      content: (
        <>
          Change <strong>{user.name}</strong> from {getRoleLabel(user.role)} to{' '}
          {getRoleLabel(role)}? This takes effect immediately and is recorded in the audit log.
        </>
      ),
      okText: 'Confirm change',
      cancelText: 'Cancel',
      onOk: () => updateRole.mutateAsync({ id: user._id, role }),
    });
  };

  const confirmStatusChange = (user: UserProfile) => {
    const status: UserProfile['status'] =
      user.status === 'active' ? 'suspended' : 'active';
    const suspending = status === 'suspended';
    Modal.confirm({
      title: suspending ? 'Suspend account?' : 'Reactivate account?',
      content: (
        <>
          {suspending ? 'Suspend' : 'Reactivate'} <strong>{user.name}</strong>&apos;s account?
          This takes effect immediately.
        </>
      ),
      okText: suspending ? 'Suspend account' : 'Reactivate account',
      okButtonProps: suspending ? { danger: true } : undefined,
      cancelText: 'Cancel',
      onOk: () => updateStatus.mutateAsync({ id: user._id, status }),
    });
  };

  const renderActions = (user: UserProfile) => {
    const isSelf = user.firebaseUid === firebaseUser?.uid;
    const roleMenuItems = roleOptions.map((option) => ({
      key: `role:${option.value}`,
      label: option.label,
      disabled: option.value === user.role,
    }));

    return (
      <Dropdown
        trigger={['click']}
        disabled={isSelf}
        menu={{
          items: [
            { key: 'change-role', label: 'Change role…', children: roleMenuItems },
            { type: 'divider' },
            {
              key: 'change-status',
              label: user.status === 'active' ? 'Suspend account' : 'Reactivate account',
              danger: user.status === 'active',
            },
          ],
          onClick: ({ key }) => {
            if (key.startsWith('role:')) {
              const role = key.slice('role:'.length) as UserProfile['role'];
              confirmRoleChange(user, role);
            } else if (key === 'change-status') {
              confirmStatusChange(user);
            }
          },
        }}
      >
        <Button
          aria-label={`Actions for ${user.name}`}
          disabled={isSelf}
          icon={<EllipsisOutlined />}
        />
      </Dropdown>
    );
  };

  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, user: UserProfile) => (
        <>
          {name}
          {user.firebaseUid === firebaseUser?.uid && (
            <Tag className="user-management-self-tag">You</Tag>
          )}
        </>
      ),
    },
    { title: 'Email', dataIndex: 'email', key: 'email' },
    {
      title: 'Role',
      dataIndex: 'role',
      key: 'role',
      render: (role: string) => <Tag style={getRoleTagStyle(role)}>{getRoleLabel(role)}</Tag>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag style={getAccountStatusTagStyle(status)}>{capitalize(status)}</Tag>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: unknown, user: UserProfile) => (
        renderActions(user)
      ),
    },
  ];

  return (
    <div className="user-management">
      <Tabs
        activeKey={group}
        onChange={(key) => {
          if (key === 'officials' || key === 'residents') {
            setGroup(key);
            setPage(1);
          }
        }}
        items={[
          { key: 'officials', label: `Officials (${officials.length})` },
          { key: 'residents', label: `Residents (${residents.length})` },
        ]}
      />
      <div className="user-management-toolbar">
        <div className="user-management-filters">
          <Input
            aria-label="Search users"
            allowClear
            prefix={<SearchOutlined />}
            placeholder="Search name, email, phone or address"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
          <Select
            aria-label="Filter by account status"
            allowClear
            placeholder="All statuses"
            value={statusFilter}
            options={[
              { label: 'Active', value: 'active' },
              { label: 'Suspended', value: 'suspended' },
            ]}
            onChange={(value) => {
              setSearchParams(value ? { status: value } : {}, { replace: true });
              setPage(1);
            }}
          />
          {group === 'officials' && (
            <Select
              className="user-management-role-filter"
              aria-label="Filter officials by role"
              allowClear
              placeholder="All roles"
              value={roleFilter}
              options={roleOptions.filter((option) => option.value !== 'resident')}
              onChange={(value) => {
                setRoleFilter(value);
                setPage(1);
              }}
            />
          )}
        </div>
        {group === 'officials' && (
          <Button
            className="user-management-create-button"
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setDrawerOpen(true)}
          >
            Create official
          </Button>
        )}
      </div>

      {isMobile ? (
        <div className="user-management-mobile-list">
          {pageUsers.map((user) => (
            <Card key={user._id} size="small" className="user-management-mobile-card">
              <div className="user-management-mobile-card__heading">
                <strong>
                  {user.name}
                  {user.firebaseUid === firebaseUser?.uid && (
                    <Tag className="user-management-self-tag">You</Tag>
                  )}
                </strong>
                {renderActions(user)}
              </div>
              <div className="user-management-mobile-card__email">{user.email}</div>
              <Space size={6} wrap>
                <Tag style={getRoleTagStyle(user.role)}>{getRoleLabel(user.role)}</Tag>
                <Tag style={getAccountStatusTagStyle(user.status)}>
                  {capitalize(user.status)}
                </Tag>
              </Space>
            </Card>
          ))}
        </div>
      ) : (
        <Table
          className="user-management-table"
          rowKey="_id"
          dataSource={visibleUsers}
          columns={columns}
          pagination={{
            current: currentPage,
            pageSize: PAGE_SIZE,
            showSizeChanger: false,
            onChange: setPage,
            showTotal: (total, range) => `Showing ${range[0]}–${range[1]} of ${total}`,
          }}
          scroll={{ x: true }}
        />
      )}
      {isMobile && (
        <Pagination
          className="user-management-mobile-pagination"
          current={currentPage}
          pageSize={PAGE_SIZE}
          total={visibleUsers.length}
          onChange={setPage}
          showSizeChanger={false}
          showTotal={(total, range) => `${range[0]}–${range[1]} of ${total}`}
          size="small"
        />
      )}

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Create official"
        width={screens.md ? 420 : '100%'}
      >
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
          <Form.Item
            name="role"
            label="Role"
            extra="Residents register themselves, so only official roles are listed here."
            rules={[{ required: true }]}
          >
            <Select
              placeholder="Select a role"
              options={roleOptions.filter((option) => option.value !== 'resident')}
            />
          </Form.Item>
          <Form.Item name="address" label="Address">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={createUser.isPending} block>
            Create
          </Button>
        </Form>
      </Drawer>
    </div>
  );
}

function getRoleLabel(role: string) {
  return roleOptions.find((option) => option.value === role)?.label ?? capitalize(role);
}

function capitalize(value: string) {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}