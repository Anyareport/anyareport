import { Button, Space, message } from 'antd';
import { DownloadOutlined, FilePdfOutlined } from '@ant-design/icons';
import { api } from '../../lib/api';

export default function AdminExportPage() {
  const download = async (format: 'csv' | 'pdf') => {
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
    }
  };

  return (
    <Space wrap>
      <Button icon={<DownloadOutlined />} onClick={() => download('csv')}>
        CSV export
      </Button>
      <Button icon={<FilePdfOutlined />} onClick={() => download('pdf')}>
        PDF export
      </Button>
    </Space>
  );
}
