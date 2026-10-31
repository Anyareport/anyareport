import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Form, Input, Modal, Space, Table, Tag, Typography, message } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { api } from '../../lib/api';
import { getStatusTagStyle } from '../../lib/statusTagStyles';

interface ResidentAccount {
  _id: string;
  name: string;
  email: string;
  status: 'active' | 'suspended';
  flaggedReportCount: number;
  createdAt: string;
}

export default function ResidentAccountsPage() {
  const [search, setSearch] = useState('');
  const [selectedResident, setSelectedResident] = useState<ResidentAccount | null>(null);
  const [form] = Form.useForm<{ reason: string }>();
  const queryClient = useQueryClient();

  const { data: residents = [], isLoading } = useQuery({
    queryKey: ['resident-accounts'],
    queryFn: () => api.get<ResidentAccount[]>('/api/admin/residents'),
    refetchInterval: 30000,
  });

  const matchingResidents = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return residents;
    return residents.filter((resident) =>
      `${resident.name} ${resident.email}`.toLowerCase().includes(query)
    );
  }, [residents, search]);

  const reactivateResident = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.patch(`/api/admin/residents/${id}/reactivate`, { reason }),
    onSuccess: async () => {
      message.success('Resident reactivated. Their current flagged-report count is now zero.');
      setSelectedResident(null);
      form.resetFields();
      await queryClient.invalidateQueries({ queryKey: ['resident-accounts'] });
    },
    onError: (error: Error) => message.error(error.message),
  });

  const columns = [
    { title: 'Resident', dataIndex: 'name', key: 'name' },
    { title: 'Email', dataIndex: 'email', key: 'email' },
    {
      title: 'Account status',
      dataIndex: 'status',
      key: 'status',
      render: (status: ResidentAccount['status']) => (
        <Tag style={{ ...getStatusTagStyle(status), marginInlineEnd: 0 }}>
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </Tag>
      ),
    },
    {
      title: 'Current flagged reports',
      dataIndex: 'flaggedReportCount',
      key: 'flaggedReportCount',
    },
    {
      title: 'Action',
      key: 'action',
      render: (_: unknown, resident: ResidentAccount) =>
        resident.status === 'suspended' ? (
          <Button
            type="primary"
            onClick={() => {
              setSelectedResident(resident);
              form.resetFields();
            }}
          >
            Reactivate after appeal
          </Button>
        ) : (
          <Typography.Text type="secondary">No action needed</Typography.Text>
        ),
    },
  ];

  return (
    <Space direction="vertical" size="large" style={{ display: 'flex' }}>
      <Input
        aria-label="Search residents"
        allowClear
        prefix={<SearchOutlined />}
        placeholder="Search residents by name or email"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        style={{ maxWidth: 420 }}
      />
      <Table
        rowKey="_id"
        dataSource={matchingResidents}
        columns={columns}
        loading={isLoading}
        pagination={{ pageSize: 10, showSizeChanger: false }}
        scroll={{ x: true }}
      />
      <Modal
        title="Reactivate resident after appeal?"
        open={!!selectedResident}
        okText="Reactivate account"
        cancelText="Cancel"
        confirmLoading={reactivateResident.isPending}
        onCancel={() => {
          setSelectedResident(null);
          form.resetFields();
        }}
        onOk={() =>
          form.validateFields().then(({ reason }) => {
            if (selectedResident) {
              return reactivateResident.mutateAsync({
                id: selectedResident._id,
                reason,
              });
            }
          })
        }
      >
        <Typography.Paragraph>
          This will restore <strong>{selectedResident?.name}</strong>&apos;s access and reset their
          current flagged-report count to zero. Existing report flags remain in the history.
        </Typography.Paragraph>
        <Form layout="vertical" form={form}>
          <Form.Item
            name="reason"
            label="Appeal decision reason"
            rules={[
              { required: true, whitespace: true, message: 'Enter the appeal decision reason' },
              { max: 500, message: 'The reason must be 500 characters or fewer' },
            ]}
          >
            <Input.TextArea rows={3} maxLength={500} showCount />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}
