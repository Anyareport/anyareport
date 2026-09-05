import { useState } from 'react';
import { Button, Card, Space, Typography, message } from 'antd';
import { DownloadOutlined, FilePdfOutlined } from '@ant-design/icons';
import { api } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';

const { Title, Paragraph, Text } = Typography;

export default function AdminExportPage() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState<'csv' | 'pdf' | null>(null);

  const download = async (format: 'csv' | 'pdf') => {
    setLoading(format);
    try {
      const blob = await api.download(`/api/export?format=${format}`);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `anyareport-${format}.${format}`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Export failed');
    } finally {
      setLoading(null);
    }
  };

  return (
    <Card className="soft-card page-hero">
      <Title level={2} style={{ color: '#fff', marginTop: 0 }}>Export</Title>
      <Paragraph style={{ color: 'rgba(255,255,255,0.82)' }}>
        Generate committee-scoped CSV or PDF exports for reports assigned to {profile?.committee || 'all visible data'}.
      </Paragraph>
      <Space wrap>
        <Button icon={<DownloadOutlined />} loading={loading === 'csv'} onClick={() => download('csv')}>
          CSV export
        </Button>
        <Button icon={<FilePdfOutlined />} loading={loading === 'pdf'} onClick={() => download('pdf')}>
          PDF export
        </Button>
      </Space>
      <Text style={{ display: 'block', marginTop: 16, color: '#fff' }}>
        Server-side scope enforcement already applies to the exported result.
      </Text>
    </Card>
  );
}