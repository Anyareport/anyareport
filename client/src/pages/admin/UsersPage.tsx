import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card, Drawer, Form, Input, Select, Space, Table, Tag, Typography, message } from 'antd';
import { api, type UserProfile } from '../../lib/api';

const { Title, Paragraph } = Typography;

const roleOptions = [
  { label: 'Resident', value: 'resident' },
  { label: 'Tanod', value: 'tanod' },
  { label: 'Responder', value: 'responder' },
  { label: 'Captain', value: 'captain' },
  { label: 'Secretary', value: 'secretary' },
  { label: 'Kagawad', value: 'kagawad' },
  { label: 'Admin', value: 'admin' },
];

export default function AdminUsersPage() {
  const queryClient = useQueryClient();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form] = Form.useForm();

  const { data: users = [] } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => api.get<UserProfile[]>('/api/admin/users'),
    refetchInterval: 30000,
  });

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
    mutationFn: ({ id, role, committee }: { id: string; role: string; committee?: string }) =>
      api.patch(`/api/admin/users/${id}/role`, { role, committee }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-users'] }),
  });

  const columns = [
    { title: 'Name', dataIndex: 'name', key: 'name' },
    { title: 'Email', dataIndex: 'email', key: 'email' },
    { title: 'Role', dataIndex: 'role', key: 'role', render: (role: string) => <Tag>{role}</Tag> },
    { title: 'Committee', dataIndex: 'committee', key: 'committee', render: (committee: string | null) => committee || '—' },
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
            options={[{ label: 'active', value: 'active' }, { label: 'suspended', value: 'suspended' }]}
            onChange={(value) => updateStatus.mutate({ id: user._id, status: value })}
          />
        </Space>
      ),
    },
  ];

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Card className="soft-card page-hero">
        <Title level={2} style={{ color: '#fff', marginTop: 0 }}>User management</Title>
        <Paragraph style={{ color: 'rgba(255,255,255,0.82)' }}>
          Admin-only role control and official provisioning.
        </Paragraph>
      </Card>

      <Card className="soft-card" extra={<Button type="primary" onClick={() => setDrawerOpen(true)}>Create official</Button>}>
        <Table rowKey="_id" dataSource={users} columns={columns} pagination={{ pageSize: 8 }} scroll={{ x: true }} />
      </Card>

      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title="Create official">
        <Form layout="vertical" form={form} onFinish={(values) => createUser.mutate(values)}>
          <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email' }]}><Input /></Form.Item>
          <Form.Item name="password" label="Password" rules={[{ required: true }]}><Input.Password /></Form.Item>
          <Form.Item name="name" label="Name" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="phone" label="Phone" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="role" label="Role" rules={[{ required: true }]}>
            <Select options={roleOptions.filter((option) => option.value !== 'resident')} />
          </Form.Item>
          <Form.Item shouldUpdate noStyle>
            {({ getFieldValue }) => getFieldValue('role') === 'kagawad' ? (
              <Form.Item name="committee" label="Committee" rules={[{ required: true }]}>
                <Input placeholder="Peace and Order" />
              </Form.Item>
            ) : null}
          </Form.Item>
          <Form.Item name="address" label="Address"><Input.TextArea rows={2} /></Form.Item>
          <Button type="primary" htmlType="submit" loading={createUser.isPending} block>Create</Button>
        </Form>
      </Drawer>
    </Space>
  );
}