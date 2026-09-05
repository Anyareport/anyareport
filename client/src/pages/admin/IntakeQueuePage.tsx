import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card, Space, Typography } from 'antd';
import { api, type Report } from '../../lib/api';
import IncidentList from '../../components/IncidentList';

const { Title, Paragraph } = Typography;

export default function SecretaryIntakePage() {
  const queryClient = useQueryClient();
  const { data: reports = [] } = useQuery({
    queryKey: ['secretary-intake'],
    queryFn: () => api.get<Report[]>('/api/reports?status=pending'),
    refetchInterval: 30000,
  });

  const verify = useMutation({
    mutationFn: (id: string) => api.post(`/api/reports/${id}/verify`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['secretary-intake'] }),
  });

  const flag = useMutation({
    mutationFn: (id: string) => api.post(`/api/reports/${id}/flag`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['secretary-intake'] }),
  });

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Card className="soft-card page-hero">
        <Title level={2} style={{ color: '#fff', marginTop: 0 }}>Intake queue</Title>
        <Paragraph style={{ color: 'rgba(255,255,255,0.82)' }}>
          Secretary review queue for new submissions.
        </Paragraph>
      </Card>

      <Card className="soft-card">
        <IncidentList reports={reports} basePath="/admin/incidents" />
      </Card>

      <Space wrap>
        {reports.slice(0, 3).map((report) => (
          <Card key={report._id} size="small" style={{ width: 320 }}>
            <Button block type="primary" onClick={() => verify.mutate(report._id)} loading={verify.isPending}>Verify {report.category}</Button>
            <Button block danger style={{ marginTop: 8 }} onClick={() => flag.mutate(report._id)} loading={flag.isPending}>Flag</Button>
          </Card>
        ))}
      </Space>
    </Space>
  );
}