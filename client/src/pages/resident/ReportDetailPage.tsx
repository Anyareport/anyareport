import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, Typography, Timeline, Tag, Spin, Button, Image } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { api, type Report } from '../../lib/api';
import StatusTag from '../../components/StatusTag';
import { StaticMap } from '../../components/MapPicker';

const { Title, Paragraph, Text } = Typography;

export default function ReportDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: report, isLoading } = useQuery({
    queryKey: ['report', id],
    queryFn: () => api.get<Report>(`/api/reports/${id}`),
    enabled: !!id,
  });

  if (isLoading) return <Spin size="large" style={{ display: 'block', margin: '40px auto' }} />;
  if (!report) return <Card>Report not found</Card>;

  const [lng, lat] = report.location?.coordinates || [0, 0];

  return (
    <div>
      <Button
        icon={<ArrowLeftOutlined />}
        onClick={() => navigate(-1)}
        style={{ marginBottom: 16 }}
      >
        Back
      </Button>

      <Card>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
          }}
        >
          <Title
            level={4}
            style={{ margin: 0, fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 1 }}
          >
            {report.category}
          </Title>
          <StatusTag status={report.status} />
        </div>

        {((report.subcategory && report.subcategory !== 'undefined') || report.severity) && (
          <div style={{ marginBottom: 12 }}>
            {report.subcategory && report.subcategory !== 'undefined' && (
              <Tag>{report.subcategory}</Tag>
            )}
            {report.severity && (
              <Tag
                color={
                  report.severity === 'Critical'
                    ? 'red'
                    : report.severity === 'High'
                      ? 'orange'
                      : report.severity === 'Medium'
                        ? 'gold'
                        : 'default'
                }
              >
                Severity: {report.severity}
              </Tag>
            )}
          </div>
        )}

        <Paragraph>{report.description}</Paragraph>

        <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
          Submitted: {new Date(report.createdAt).toLocaleString()}
        </Text>
        {report.location && (
          <div style={{ marginTop: 16 }}>
            <StaticMap latitude={lat} longitude={lng} />
            {report.location.address && (
              <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
                {report.location.address}
              </Text>
            )}
          </div>
        )}

        {report.photos?.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <Image.PreviewGroup>
              {report.photos.map((p, i) => (
                <Image
                  key={i}
                  src={
                    p.startsWith('http') || p.startsWith('data:')
                      ? p
                      : `${import.meta.env.VITE_API_URL || ''}${p}`
                  }
                  width={120}
                  style={{ marginRight: 8 }}
                />
              ))}
            </Image.PreviewGroup>
          </div>
        )}

        <Timeline
          style={{ marginTop: 24 }}
          items={report.statusHistory?.map((h) => ({
            children: `${h.status.replace(/_/g, ' ')} — ${new Date(h.timestamp).toLocaleString()}`,
          }))}
        />
      </Card>
    </div>
  );
}
