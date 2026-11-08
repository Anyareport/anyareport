import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Drawer, Grid } from 'antd';
import { CloseOutlined, EnvironmentOutlined, FileAddOutlined } from '@ant-design/icons';
import { api, type Report } from '../../lib/api';
import MapDashboard, { type IncidentMarker } from '../../components/map/MapDashboard';
import MapReportCard from '../../components/map/MapReportCard';
import '../../components/map/MapReportCard.css';
import './MapPage.css';
import EmergencyHotline from '../../components/EmergencyHotline';
import SubmitReportForm from '../../components/SubmitReportForm';
import type { FeatureCollection } from 'geojson';
import { isInsideBarangayBoundary } from '../../components/map/MapPicker';
import barangayData from '../../data/DMM.json';
import { getIncidentLabel } from '../../lib/incidentUtils';
import { useAntdMessage } from '../../lib/useAntdMessage';
import { getGuestReportIds } from '../../lib/guestReports';

export default function MapPage({
  guest = false,
  staff = false,
}: {
  guest?: boolean;
  staff?: boolean;
}) {
  const message = useAntdMessage();
  const navigate = useNavigate();
  const location = useLocation();
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const reportPath = guest ? '/report' : staff ? '/admin/report' : '/resident/report';
  const mapPath = guest ? '/report/map' : staff ? '/admin/report/map' : '/resident/map';
  const reportDrawerOpen = location.pathname === reportPath; // GUEST
  const guestReportIds = guest ? getGuestReportIds() : [];
  const { data: reports = [] } = useQuery({
    queryKey: guest ? ['guest-reports', guestReportIds] : ['my-reports'],
    queryFn: () =>
      guest
        ? guestReportIds.length
          ? api.get<Report[]>(`/api/reports/guest/mine?ids=${guestReportIds.join(',')}`)
          : Promise.resolve([])
        : api.get<Report[]>('/api/reports/mine'),
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
  const [selectedLocationMethod, setSelectedLocationMethod] = useState<'map' | 'gps' | null>(null);
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

  const handleLocationChange = (position: [number, number], method: 'map' | 'gps') => {
    if (!isInsideBarangayBoundary(position, barangayData as FeatureCollection)) {
      message.error('Choose a location inside the barangay boundary.');
      return false;
    }

    setSelectedLocation(position);
    setSelectedLocationMethod(method);
    return true;
  };

  const handleLocationPick = (position: [number, number]) => {
    if (!handleLocationChange(position, 'map')) return;

    setIsPickingLocation(false);
    navigate(reportPath); // GUEST
  };

  const closeReportDrawer = () => {
    setIsPickingLocation(false);
    navigate(mapPath, { replace: true }); // GUEST
  };

  const finishGuestReport = () => {
    setIsPickingLocation(false);
    navigate('/report/reports', { replace: true });
  };

  return (
    <div className="resident-map-page">
      <MapDashboard
        points={mapPoints}
        height={
          isMobile && !guest && !staff
            ? 'calc(100dvh - var(--mobile-navigation-height))'
            : '100vh'
        }
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
              onViewDetails={() =>
                navigate(
                  guest
                    ? `/report/reports/${report._id}?requestId=${encodeURIComponent(report.guestAccessKey || '')}`
                    : staff
                      ? `/admin/incidents/${report._id}`
                      : `/resident/reports/${report._id}`
                )
              }
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
            onViewDetails={() =>
              navigate(
                guest
                  ? `/report/reports/${selectedReport._id}?requestId=${encodeURIComponent(selectedReport.guestAccessKey || '')}`
                  : staff
                    ? `/admin/incidents/${selectedReport._id}`
                    : `/resident/reports/${selectedReport._id}`
              )
            }
            onDismiss={() => setSelectedPointId(null)}
          />
        </div>
      )}
      {!isPickingLocation && (
        <div
          style={{
            position: 'absolute',
            top: 16,
            left: 16,
            right: 16,
            zIndex: 1101,
            display: 'flex',
            justifyContent: 'flex-start',
            gap: 8,
            pointerEvents: 'none',
          }}
        >
          {guest && (
            <Alert
              type="info"
              showIcon
              message="Sign in to receive notifications and add your contact information."
              style={{
                position: 'fixed',
                right: 16,
                bottom: isMobile ? 'calc(var(--mobile-navigation-height) + 16px)' : 16,
                zIndex: 1102,
                pointerEvents: 'auto',
                maxWidth: 430,
              }}
            />
          )}
          {!isMobile && (
            <Button
              type="primary"
              size="large"
              style={{ pointerEvents: 'auto' }}
              icon={<FileAddOutlined />}
              onClick={() => navigate(reportPath)} // GUEST
            >
              Report an incident
            </Button>
          )}
          {/* GUEST: mobile report button (guests have no bottom navigation) */}
          {isMobile && guest && (
            <Button
              type="primary"
              style={{ pointerEvents: 'auto' }}
              icon={<FileAddOutlined />}
              onClick={() => navigate(reportPath)}
            >
              Report
            </Button>
          )}
          <div style={{ pointerEvents: 'auto' }}>
            <EmergencyHotline />
          </div>
          {/* GUEST: login shortcut */}
          {guest && (
            <Link to="/login" style={{ pointerEvents: 'auto', marginLeft: 'auto' }}>
              <Button>Log in</Button>
            </Link>
          )}
        </div>
      )}
      {isPickingLocation && (
        <section className="map-location-picker" aria-label="Location selection">
          <div className="map-location-picker__instruction">
            <EnvironmentOutlined aria-hidden="true" />
            <span>Tap the map to set the incident location</span>
          </div>
          <Button
            danger
            className="map-location-picker__cancel"
            icon={<CloseOutlined />}
            onClick={() => {
              setIsPickingLocation(false);
              navigate(reportPath); // GUEST
            }}
          >
            Cancel
          </Button>
        </section>
      )}
      <Drawer
        title="Report an incident"
        zIndex={1200}
        placement={isMobile ? 'bottom' : 'right'}
        closable={{ placement: isMobile ? 'end' : 'start' }}
        open={reportDrawerOpen}
        onClose={closeReportDrawer}
        width={isMobile ? undefined : 520}
        height={isMobile ? '85vh' : undefined}
        maskClosable
        styles={{ body: { padding: '16px 20px', overflowY: 'auto' } }}
      >
        <SubmitReportForm
          guest={guest} // GUEST
          staff={staff}
          onGuestDone={guest ? finishGuestReport : closeReportDrawer} // GUEST
          successPath={staff ? '/admin/incidents' : '/resident/reports'}
          selectedLocation={selectedLocation}
          selectedLocationMethod={selectedLocationMethod}
          onPickLocation={() => {
            navigate(mapPath, { replace: true }); // GUEST
            setIsPickingLocation(true);
          }}
          onLocationChange={handleLocationChange}
        />
      </Drawer>
    </div>
  );
}