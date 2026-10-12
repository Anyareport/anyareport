import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, Col, Row, Space } from 'antd';
import { AlertOutlined, EnvironmentOutlined, FireOutlined } from '@ant-design/icons';
import { api, type Report } from '../../lib/api';
import IncidentList from '../../components/IncidentList';
import KpiCard from '../../components/KpiCard';
import { compareIncidentPriority } from '../../lib/sortUtils';
import { useAuth } from '../../contexts/AuthContext';
import { useLang } from '../../contexts/LanguageContext';

export default function ResponderDashboardPage() {
  const { profile } = useAuth();
  const { t } = useLang();

  const { data: reports = [], isLoading: reportsLoading } = useQuery({
    queryKey: ['responder-reports'],
    queryFn: () => api.get<Report[]>('/api/reports'),
    refetchInterval: 30000,
  });

  const { data: handledReports = [], isLoading: handledReportsLoading } = useQuery({
    queryKey: ['responder-handled-reports'],
    queryFn: () => api.get<Report[]>('/api/reports?handledByMe=true'),
    refetchInterval: 30000,
  });

  const myActiveReports = useMemo(
    () => handledReports.filter((report) => report.status !== 'resolved'),
    [handledReports]
  );

  const activeReports = useMemo(
    () =>
      reports
        .filter(
          (report) =>
            report.status === 'pending' &&
            !report.acknowledgedBy &&
            ['Emergency Situations', 'Public Concerns'].includes(report.category)
        )
        .sort(compareIncidentPriority),
    [reports]
  );
  const otherIncidents = useMemo(
    () =>
      reports
        .filter(
          (report) =>
            report.acknowledgedBy &&
            report.acknowledgedBy !== profile?.firebaseUid &&
            report.status !== 'resolved' &&
            (report.backupRequests || []).some(
              (request) =>
                request.status === 'pending' &&
                !(request.joinedBy || []).includes(profile?.firebaseUid || '')
            )
        )
        .sort(compareIncidentPriority),
    [profile?.firebaseUid, reports]
  );

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Row gutter={[16, 16]}>
        <Col xs={24} md={8}>
          <KpiCard
            label={t('activeIncidents')}
            value={activeReports.length}
            icon={<AlertOutlined />}
            tone={activeReports.length > 0 ? 'danger' : 'neutral'}
            helper={t('unacknowledgedEmergencyReports')}
          />
        </Col>
        <Col xs={24} md={8}>
          <KpiCard
            label={t('backupRequests')}
            value={otherIncidents.length}
            icon={<FireOutlined />}
            tone={otherIncidents.length > 0 ? 'warning' : 'neutral'}
            helper={t('openBackupRequests')}
          />
        </Col>
        <Col xs={24} md={8}>
          <KpiCard
            label={t('inProgressCases')}
            value={myActiveReports.filter((report) => report.status === 'in_progress').length}
            icon={<EnvironmentOutlined />}
            tone="accent"
            helper={t('casesCurrentlyHandling')}
          />
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24}>
          <Card className="soft-card" title={t('myHandledIncidents')}>
            <IncidentList
              reports={myActiveReports.slice(0, 5)}
              loading={handledReportsLoading}
              basePath="/responder/incidents"
            />
          </Card>
        </Col>
        <Col xs={24}>
          <Card className="soft-card" title={t('backupRequests')}>
            <IncidentList
              reports={otherIncidents.slice(0, 5)}
              loading={reportsLoading}
              basePath="/responder/incidents"
              showSubmitter={false}
            />
          </Card>
        </Col>
      </Row>
    </Space>
  );
}
