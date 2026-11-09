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
  const isTerminal = ['resolved', 'endorsed'].includes(canonicalStatus);

  

  return (
    <ol
      className={`incident-steps incident-steps--${steps.length} ${
        canonicalStatus === 'endorsed' ? 'incident-steps--endorsed' : ''
      }`}
      aria-label={translate ? t('reportProgress') : 'Report progress'}
    >
      {steps.map((step, index) => {
        const isComplete = isTerminal || index < currentStep;
        const isCurrent = !isTerminal && index === currentStep;
        const isEndorsed = canonicalStatus === 'endorsed' && step === 'resolved';
        return (
          <li
            key={step}
            className={[
              'incident-steps__item',
              isComplete ? 'is-complete' : '',
              isCurrent ? 'is-current' : '',
              isEndorsed ? 'is-endorsed' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            aria-current={isCurrent ? 'step' : undefined}
          >
            <span className="incident-steps__dot" aria-hidden="true" />
            <span className="incident-steps__label">
              {translate
                ? getLocalizedStatus(
                    canonicalStatus === 'endorsed' && step === 'resolved' ? 'endorsed' : step,
                    t
                  )
                : getStatusLabel(
                    canonicalStatus === 'endorsed' && step === 'resolved' ? 'endorsed' : step
                  )}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
