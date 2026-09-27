import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
// import { Typography } from 'antd';
// import { Card, Col, Row, Space } from 'antd';
import { api, type Report } from '../../lib/api';
import MapDashboard from '../../components/map/MapDashboard';
// import StatusTag from '../../components/StatusTag';
// import PageHero from '../../components/PageHero';

// const { Text } = Typography;

export default function MapPage() {
  const navigate = useNavigate();
  const { data: reports = [] } = useQuery({
    queryKey: ['my-reports'],
    queryFn: () => api.get<Report[]>('/api/reports/mine'),
    refetchInterval: 30000,
  });

  const mapPoints = useMemo(() => {
    return reports.map((report) => ({
      id: report._id,
      lat: report.location.coordinates[1],
      lng: report.location.coordinates[0],
      category: report.category,
      status: report.status,
    }));
  }, [reports]);

  return (
    // <Row gutter={[16, 16]}>
    //   <Col xs={24} xl={16}>
    //     <Space direction="vertical" size={16} style={{ width: '100%' }}>
    //       <PageHero
    //         title="Map view"
    //         description="Geographic overview of report locations with responsive single-column fallback on smaller screens."
    //       />
    //       <Card className="soft-card" title="Incident map">
    <MapDashboard
      points={mapPoints}
      height="100vh"
      onPointClick={(point) => navigate(`/resident/reports/${point.id}`)}
      showBoundaries={false}
    />
    //       </Card>
    //     </Space>
    //   </Col>
    //   <Col xs={24} xl={8}>
    //     <Card className="soft-card" title="Recent incidents">
    //       <Space direction="vertical" size={12} style={{ width: '100%' }}>
    //         {reports.slice(0, 8).map((report) => (
    //           <Card
    //             key={report._id}
    //             size="small"
    //             onClick={() => setSelectedId(report._id)}
    //             hoverable
    //           >
    //             <Space direction="vertical" size={4} style={{ width: '100%' }}>
    //               <StatusTag status={report.status} />
    //               <Text strong>{report.category}</Text>
    //               <Text type="secondary">{report.location?.address || 'No address'}</Text>
    //             </Space>
    //           </Card>
    //         ))}
    //       </Space>
    //     </Card>
    //   </Col>
    // </Row>
  );
}
