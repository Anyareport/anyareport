import { useState } from 'react';
import { Form, Select, Input, Button, Upload, Card, Typography, message, Alert } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api, type Category } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import MapPicker from '../../components/MapPicker';

const { Title } = Typography;

export default function SubmitReportPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const [form] = Form.useForm();
  const [lat, setLat] = useState<number>();
  const [lng, setLng] = useState<number>();
  const [fileList, setFileList] = useState<{ originFileObj: File }[]>([]);

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get<Category[]>('/api/reports/categories'),
  });

  const mutation = useMutation({
    mutationFn: async (values: { category: string; description: string; address: string }) => {
      const formData = new FormData();
      formData.append('category', values.category);
      formData.append('description', values.description);
      formData.append('address', values.address || '');
      formData.append('latitude', String(lat));
      formData.append('longitude', String(lng));
      fileList.forEach((f) => formData.append('photos', f.originFileObj));

      return api.post('/api/reports', formData);
    },
    onSuccess: () => {
      message.success('Report submitted successfully!');
      queryClient.invalidateQueries({ queryKey: ['my-reports'] });
      navigate('/resident/reports');
    },
    onError: (err: Error) => message.error(err.message),
  });

  if (!profile?.emailVerified) {
    return (
      <Alert
        type="warning"
        message="Email verification required"
        description="Please verify your email before submitting reports. Check your inbox for the verification link."
        showIcon
      />
    );
  }

  return (
    <Card>
      <Title level={3} style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 1 }}>
        SUBMIT INCIDENT REPORT
      </Title>

      <Form
        form={form}
        layout="vertical"
        onFinish={(values) => {
          if (!lat || !lng) {
            message.error('Please set a location on the map');
            return;
          }
          mutation.mutate(values);
        }}
      >
        <Form.Item name="category" label="Category" rules={[{ required: true }]}>
          <Select
            placeholder="Select category"
            options={categories.map((c) => ({ value: c.name, label: c.name }))}
          />
        </Form.Item>

        <Form.Item label="Location (tap map or use GPS)">
          <MapPicker latitude={lat} longitude={lng} onChange={(la, ln) => { setLat(la); setLng(ln); }} />
        </Form.Item>

        <Form.Item name="address" label="Address (optional)">
          <Input placeholder="Purok, street name..." />
        </Form.Item>

        <Form.Item name="description" label="Description" rules={[{ required: true, min: 10 }]}>
          <Input.TextArea rows={4} placeholder="Describe the incident in detail..." />
        </Form.Item>

        <Form.Item label="Photos (optional, max 3)">
          <Upload
            listType="picture"
            beforeUpload={() => false}
            maxCount={3}
            accept="image/*"
            onChange={({ fileList: fl }) => setFileList(fl as { originFileObj: File }[])}
          >
            <Button icon={<UploadOutlined />}>Upload Photo</Button>
          </Upload>
        </Form.Item>

        <Form.Item>
          <Button type="primary" htmlType="submit" size="large" loading={mutation.isPending} block>
            Submit Report
          </Button>
        </Form.Item>
      </Form>
    </Card>
  );
}
