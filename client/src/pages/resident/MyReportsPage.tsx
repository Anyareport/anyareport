import { Typography, Card, Empty, Spin } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api, type Report } from '../../lib/api';
import IncidentList from '../../components/IncidentList';

const { Title } = Typography;

export default function MyReportsPage() {
  const navigate = useNavigate();
  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['my-reports'],
    queryFn: () => api.get<Report[]>('/api/reports/mine'),
  });

  if (isLoading) return <Spin size="large" style={{ display: 'block', margin: '40px auto' }} />;

  return (
    <div>
      <Title level={3} style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 1 }}>
        MY REPORTS
      </Title>
      {reports.length === 0 ? (
        <Card><Empty description="No reports yet" /></Card>
      ) : (
        <IncidentList
          reports={reports}
          basePath="/resident/reports"
          onRowClick={(id) => navigate(`/resident/reports/${id}`)}
        />
      )}
    </div>
  );
}
