import {
  getActiveStep,
  getReportSteps,
  getStatusLabel,
  normalizeReportStatus,
} from '../../lib/reportWorkflow';
import { useLang } from '../../contexts/LanguageContext';
import { getLocalizedStatus } from '../../i18n/labels';

interface IncidentStatusStepsProps {
  category: string;
  subcategory?: string | null;
  status: string;
  translate?: boolean;
}

export default function IncidentStatusSteps({
  category,
  subcategory,
  status,
  translate = false,
}: IncidentStatusStepsProps) {
  const { t } = useLang();
  const steps = getReportSteps(category, subcategory);
  const canonicalStatus = normalizeReportStatus(status);
  const currentStep = getActiveStep(category, canonicalStatus, subcategory);
  const isTerminal = canonicalStatus === 'resolved';

  

  return (
    <ol
      className={`incident-steps incident-steps--${steps.length}`}
      aria-label={translate ? t('reportProgress') : 'Report progress'}
    >
      {steps.map((step, index) => {
        const isComplete = isTerminal || index < currentStep;
        const isCurrent = !isTerminal && index === currentStep;
        return (
          <li
            key={step}
            className={[
              'incident-steps__item',
              isComplete ? 'is-complete' : '',
              isCurrent ? 'is-current' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            aria-current={isCurrent ? 'step' : undefined}
          >
            <span className="incident-steps__dot" aria-hidden="true" />
            <span className="incident-steps__label">
              {translate ? getLocalizedStatus(step, t) : getStatusLabel(step)}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
