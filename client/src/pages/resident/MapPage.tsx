import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Button, Drawer, Grid, message } from 'antd';
import { CloseOutlined, FileAddOutlined } from '@ant-design/icons';
import { api, type Report } from '../../lib/api';
import MapDashboard from '../../components/map/MapDashboard';
import SubmitReportForm from '../../components/SubmitReportForm';
import type { FeatureCollection } from 'geojson';
import { isInsideBarangayBoundary } from '../../components/map/MapPicker';
import barangayData from '../../data/DMM.json';

export default function MapPage({ initialReportOpen = false }: { initialReportOpen?: boolean }) {
  const navigate = useNavigate();
  const location = useLocation();
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
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

  const [selectedLocation, setSelectedLocation] = useState<[number, number] | null>(null);
  const [isPickingLocation, setIsPickingLocation] = useState(false);
  const [reportDrawerOpen, setReportDrawerOpen] = useState(initialReportOpen);

  useEffect(() => {
    const hasMobileActionRequest =
      location.state &&
      typeof location.state === 'object' &&
      'mobileActionRequest' in location.state;

    if (initialReportOpen || hasMobileActionRequest) setReportDrawerOpen(true);
  }, [initialReportOpen, location.state]);

  const handleLocationChange = (position: [number, number]) => {
    if (!isInsideBarangayBoundary(position, barangayData as FeatureCollection)) {
      message.error('Choose a location inside the barangay boundary.');
      return false;
    }

    setSelectedLocation(position);
    return true;
  };

  const handleLocationPick = (position: [number, number]) => {
    if (!handleLocationChange(position)) return;

    setIsPickingLocation(false);
    setReportDrawerOpen(true);
  };

  return (
    <div style={{ position: 'relative' }}>
      <MapDashboard
        points={mapPoints}
        height={isMobile ? 'calc(100dvh - var(--mobile-navigation-height))' : '100vh'}
        onPointClick={(point) => navigate(`/resident/reports/${point.id}`)}
        showBoundaries={isPickingLocation}
        isPickingLocation={isPickingLocation}
        onLocationPick={handleLocationPick}
        selectedLocation={selectedLocation}
      />
      {!isMobile && (
        <Button
          type="primary"
          size="large"
          style={{ position: 'absolute', top: 16, left: 16, zIndex: 1000 }}
          icon={<FileAddOutlined />}
          onClick={() => setReportDrawerOpen(true)}
        >
          Report an incident
        </Button>
      )}
      {isPickingLocation && (
        <Button
          danger
          icon={<CloseOutlined />}
          style={{ position: 'absolute', top: 72, left: 16, zIndex: 1000 }}
          onClick={() => setIsPickingLocation(false)}
        >
          Cancel location selection
        </Button>
      )}
      <Drawer
        title="Report an incident"
        zIndex={1200}
        placement={isMobile ? 'bottom' : 'right'}
        open={reportDrawerOpen}
        onClose={() => {
          setReportDrawerOpen(false);
          setIsPickingLocation(false);
        }}
        width={isMobile ? undefined : 520}
        height={isMobile ? '85vh' : undefined}
        maskClosable
        styles={{ body: { padding: '16px 20px', overflowY: 'auto' } }}
      >
        <SubmitReportForm
          selectedLocation={selectedLocation}
          onPickLocation={() => {
            setReportDrawerOpen(false);
            setIsPickingLocation(true);
          }}
          onLocationChange={handleLocationChange}
        />
      </Drawer>
    </div>
  );
}
