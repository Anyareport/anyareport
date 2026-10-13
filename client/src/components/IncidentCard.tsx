import type { ReactNode } from 'react';
import { Space, Typography } from 'antd';
import type { Report } from '../lib/api';
import { UserOutlined, EnvironmentOutlined } from '@ant-design/icons';
import {
  formatRelativeDate,
  getIncidentLabel,
  getIncidentMeta,
  getLocationLabel,
} from '../lib/incidentUtils';
import SeverityTag, { getSeverityStyle } from './SeverityTag';
import StatusTag from './StatusTag';
import FeedCard from './FeedCard';
import { useAuth } from '../contexts/AuthContext';
import { useLang } from '../contexts/LanguageContext';
import { useTranslatedTexts } from '../lib/translation';
import TranslationNote from './TranslationNote';
import { getLocalizedCategory } from '../i18n/labels';

const { Text } = Typography;

interface IncidentCardProps {
  report: Report;
  title?: string;
  to?: string;
  onClick?: () => void;
  showSubmitter?: boolean;
  showStatus?: boolean;
  showDescription?: boolean;
  descriptionMaxLength?: number;
  descriptionLines?: number;
  dateFormat?: 'relative' | 'absolute' | 'hidden';
  extra?: ReactNode;
  badges?: ReactNode;
  children?: ReactNode;
  actions?: ReactNode[];
  className?: string;
}

export default function IncidentCard({
  report,
  title: titleOverride,
  to,
  onClick,
  showSubmitter = false,
  showStatus = true,
  showDescription = false,
  descriptionMaxLength,
  descriptionLines,
  dateFormat = 'relative',
  extra,
  badges,
  children,
  actions,
  className,
}: IncidentCardProps) {
  const { role } = useAuth();
  const { lang, t } = useLang();
  const translate = lang === 'fil' && ['tanod', 'responder'].includes(role || '');
  const categoryLabels = getLocalizedCategory(report.category, report.subcategory, t);
  const hasFreeTitle = !!report.aiTitle?.trim() || !!report.description.trim();
  const originalTitle = getIncidentLabel(report);
  const originalDescription = report.description.trim();
  // Pages may pass the AI title as an override; it is still reporter/AI free
  // text, so it gets translated. Category labels passed in are already localized.
  const overrideIsFreeText = !!titleOverride && titleOverride === report.aiTitle?.trim();
  const titleSource = titleOverride
    ? overrideIsFreeText
      ? titleOverride
      : null
    : hasFreeTitle
      ? originalTitle
      : null;
  const translation = useTranslatedTexts([
    titleSource,
    showDescription ? originalDescription : null,
  ]);
  const title = titleOverride
    ? translation.texts[0] || titleOverride
    : translate && !hasFreeTitle
      ? categoryLabels.subcategory || categoryLabels.category
      : translation.texts[0] || originalTitle;
  const meta = translate
    ? [
        report.referenceNumber,
        report.subcategory
          ? `${categoryLabels.category} · ${categoryLabels.subcategory}`
          : categoryLabels.category,
      ]
        .filter(Boolean)
        .join(' · ')
    : getIncidentMeta(report);
  const description = (showDescription ? translation.texts[1] : originalDescription).trim();
  const displayedDescription =
    descriptionMaxLength && description.length > descriptionMaxLength
      ? `${description.slice(0, descriptionMaxLength).trimEnd()}…`
      : description;
  const content = (
    <Space direction="vertical" size={6} style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <Space size={4} wrap>
          <SeverityTag severity={report.severity} />
          {showStatus && <StatusTag status={report.status} />}
          {badges}
        </Space>
        <Space size={8}>
          {extra}
          {dateFormat !== 'hidden' && (
            <Text
              type="secondary"
              title={new Date(report.createdAt).toLocaleString()}
              style={{ fontSize: 12, whiteSpace: 'nowrap' }}
            >
              {dateFormat === 'absolute'
                ? new Date(report.createdAt).toLocaleString()
                : formatRelativeDate(report.createdAt)}
            </Text>
          )}
        </Space>
      </div>
      <Text
        strong
        style={{ overflowWrap: 'anywhere' }}
        title={translation.hasTranslation && title !== (titleSource ?? originalTitle) ? (titleSource ?? originalTitle) : undefined}
      >
        {title}
      </Text>
      <Text type="secondary" style={{ fontSize: 12 }}>
        {meta}
      </Text>
      {showDescription && displayedDescription && (
        <Text
          title={descriptionLines ? description : undefined}
          style={{
            overflowWrap: 'anywhere',
            ...(descriptionLines
              ? {
                  display: '-webkit-box',
                  WebkitBoxOrient: 'vertical',
                  WebkitLineClamp: descriptionLines,
                  overflow: 'hidden',
                }
              : {}),
          }}
        >
          {displayedDescription}
        </Text>
      )}
      
      {children}
      <Text type="secondary" style={{ overflowWrap: 'anywhere' }}>
        <EnvironmentOutlined /> {getLocationLabel(report)}
        {showSubmitter && report.submitterName && (
          <>
            {' · '}
            <UserOutlined /> {report.submitterName}
          </>
        )}
      </Text>
    </Space>
  );

  return (
    <FeedCard
      className={className}
      to={to}
      onClick={onClick}
      actions={actions}
      accentColor={getSeverityStyle(report.severity).borderColor || 'var(--border-light)'}
    >
      {content}
    </FeedCard>
  );
}