import { Card, Empty } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api, type Report } from '../../lib/api';
import IncidentList from '../../components/IncidentList';
import LoadingState from '../../components/LoadingState';

export default function MyReportsPage() {
  const navigate = useNavigate();
  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['my-reports'],
    queryFn: () => api.get<Report[]>('/api/reports/mine'),
    refetchInterval: 30000,
  });

  if (isLoading) return <LoadingState />;

  return (
    <div>
      {reports.length === 0 ? (
        <Card>
          <Empty description="No reports yet" />
        </Card>
      ) : (
        <IncidentList
          reports={reports}
          basePath="/resident/reports"
          onRowClick={(id) => navigate(`/resident/reports/${id}`)}
          showSubmitter={false}
        />
      )}
    </div>
  );
}
