import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Button, Drawer, Grid, message } from 'antd';
import { CloseOutlined, FileAddOutlined } from '@ant-design/icons';
import { api, type Report } from '../../lib/api';
import MapDashboard, { type IncidentMarker } from '../../components/map/MapDashboard';
import MapReportCard from '../../components/map/MapReportCard';
import '../../components/map/MapReportCard.css';
import SubmitReportForm from '../../components/SubmitReportForm';
import type { FeatureCollection } from 'geojson';
import { isInsideBarangayBoundary } from '../../components/map/MapPicker';
import barangayData from '../../data/DMM.json';
import { getIncidentLabel } from '../../lib/incidentUtils';

export default function MapPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const reportDrawerOpen = location.pathname === '/resident/report';
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
      severity: report.severity,
      title: getIncidentLabel(report),
    }));
  }, [reports]);

  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<[number, number] | null>(null);
  const [isPickingLocation, setIsPickingLocation] = useState(false);
  const selectedReport = reports.find((report) => report._id === selectedPointId);
  const touchStartY = useRef<number | null>(null);

  useEffect(() => {
    if (!selectedPointId) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedPointId(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedPointId]);

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
    navigate('/resident/report');
  };

  const closeReportDrawer = () => {
    setIsPickingLocation(false);
    navigate('/resident/map', { replace: true });
  };

  return (
    <div style={{ position: 'relative' }}>
      <MapDashboard
        points={mapPoints}
        height={isMobile ? 'calc(100dvh - var(--mobile-navigation-height))' : '100vh'}
        onPointClick={(point) => setSelectedPointId(point.id)}
        onMapClick={() => setSelectedPointId(null)}
        selectedPointId={selectedPointId}
        showPointPopup={!isMobile && !isPickingLocation}
        renderPointPopup={(point: IncidentMarker) => {
          const report = reports.find((item) => item._id === point.id);
          if (!report) return null;

          return (
            <MapReportCard
              report={report}
              onViewDetails={() => navigate(`/resident/reports/${report._id}`)}
              onDismiss={() => setSelectedPointId(null)}
            />
          );
        }}
        showBoundaries={isPickingLocation}
        isPickingLocation={isPickingLocation}
        onLocationPick={handleLocationPick}
        selectedLocation={selectedLocation}
      />
      {isMobile && !isPickingLocation && selectedReport && (
        <div
          className="map-report-sheet"
          onTouchStart={(event) => {
            touchStartY.current = event.touches[0]?.clientY ?? null;
          }}
          onTouchEnd={(event) => {
            const touchEndY = event.changedTouches[0]?.clientY;
            if (
              touchStartY.current !== null &&
              touchEndY !== undefined &&
              touchEndY - touchStartY.current > 60
            ) {
              setSelectedPointId(null);
            }
            touchStartY.current = null;
          }}
        >
          <div className="map-report-sheet__handle" aria-hidden="true" />
          <MapReportCard
            report={selectedReport}
            onViewDetails={() => navigate(`/resident/reports/${selectedReport._id}`)}
            onDismiss={() => setSelectedPointId(null)}
          />
        </div>
      )}
      {!isMobile && (
        <Button
          type="primary"
          size="large"
          style={{ position: 'absolute', top: 16, left: 16, zIndex: 1101 }}
          icon={<FileAddOutlined />}
          onClick={() => navigate('/resident/report')}
        >
          Report an incident
        </Button>
      )}
      {isPickingLocation && (
        <Button
          danger
          icon={<CloseOutlined />}
          style={{ position: 'absolute', top: 48, right: 16, zIndex: 1102 }}
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
        onClose={closeReportDrawer}
        width={isMobile ? undefined : 520}
        height={isMobile ? '85vh' : undefined}
        maskClosable
        styles={{ body: { padding: '16px 20px', overflowY: 'auto' } }}
      >
        <SubmitReportForm
          selectedLocation={selectedLocation}
          onPickLocation={() => {
            navigate('/resident/map', { replace: true });
            setIsPickingLocation(true);
          }}
          onLocationChange={handleLocationChange}
        />
      </Drawer>
    </div>
  );
}
