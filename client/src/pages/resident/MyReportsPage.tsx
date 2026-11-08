import { Card, Empty } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api, type Report } from '../../lib/api';
import IncidentList from '../../components/IncidentList';
import LoadingState from '../../components/LoadingState';
import { getGuestReportIds } from '../../lib/guestReports';

export default function MyReportsPage({ guest = false }: { guest?: boolean }) {
  const navigate = useNavigate();
  const guestIds = guest ? getGuestReportIds() : [];
  const { data: reports = [], isLoading } = useQuery({
    queryKey: guest ? ['guest-reports', guestIds] : ['my-reports'],
    queryFn: () =>
      guest
        ? guestIds.length
          ? api.get<Report[]>(`/api/reports/guest/mine?ids=${guestIds.join(',')}`)
          : Promise.resolve([])
        : api.get<Report[]>('/api/reports/mine'),
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
          basePath={guest ? '/report/reports' : '/resident/reports'}
          onRowClick={
            guest
              ? (id) => {
                  const report = reports.find((item) => item._id === id);
                  if (report?.guestAccessKey) {
                    navigate(`/report/reports/${id}?requestId=${report.guestAccessKey}`);
                  }
                }
              : (id) => navigate(`/resident/reports/${id}`)
          }
          showSubmitter={false}
        />
      )}
    </div>
  );
}
