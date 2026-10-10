import { Button } from 'antd';
import { CloseOutlined, EnvironmentOutlined } from '@ant-design/icons';
import type { Report } from '../../lib/api';
import {
  formatRelativeDate,
  getIncidentLabel,
  getIncidentMeta,
  getLocationLabel,
} from '../../lib/incidentUtils';
import SeverityTag from '../SeverityTag';
import StatusTag from '../StatusTag';

interface MapReportCardProps {
  report: Report;
  onViewDetails: () => void;
  onDismiss: () => void;
  showPhoto?: boolean;
}

export default function MapReportCard({
  report,
  onViewDetails,
  onDismiss,
  showPhoto = true,
}: MapReportCardProps) {
  const photo = showPhoto ? report.photos?.[0] : undefined;

  return (
    <article className="map-report-card">
      <Button
        className="map-report-card__close"
        type="text"
        size="small"
        aria-label="Close incident preview"
        title="Close"
        icon={<CloseOutlined />}
        onClick={onDismiss}
      />
      {photo && <img className="map-report-card__photo" src={photo} alt="Incident scene" />}
      <div className="map-report-card__content">
        <div className="map-report-card__summary">
          <div className="map-report-card__tags">
            <SeverityTag severity={report.severity} />
            <StatusTag status={report.status} />
          </div>
          <time
            className="map-report-card__time"
            dateTime={report.createdAt}
            title={new Date(report.createdAt).toLocaleString()}
          >
            {formatRelativeDate(report.createdAt)}
          </time>
        </div>
        <h2 className="map-report-card__title">{getIncidentLabel(report)}</h2>
        <p className="map-report-card__meta">{getIncidentMeta(report)}</p>
        <p className="map-report-card__location">
          <EnvironmentOutlined />
          <span>{getLocationLabel(report)}</span>
        </p>
        <Button type="primary" block onClick={onViewDetails}>
          View details
        </Button>
      </div>
    </article>
  );
}
