import { Typography, message } from 'antd';
import { DownloadOutlined, FilePdfOutlined } from '@ant-design/icons';
import { api } from '../../lib/api';
import PageHero from '../../components/PageHero';

const { Text } = Typography;

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
    <PageHero
      title="Export"
      description="Download a CSV or PDF of all incident reports."
      actions={[
        {
          type: 'default',
          icon: <DownloadOutlined />,
          label: 'CSV export',
          onClick: () => download('csv'),
        },
        {
          type: 'default',
          icon: <FilePdfOutlined />,
          label: 'PDF export',
          onClick: () => download('pdf'),
        },
      ]}
    >
      <Text style={{ display: 'block', marginTop: 16 }}>
        Server-side scope enforcement already applies to the exported result.
      </Text>
    </PageHero>
  );
}
