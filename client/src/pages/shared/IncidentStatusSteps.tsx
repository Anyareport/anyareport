import {
  getActiveStep,
  getReportSteps,
  getStatusLabel,
  normalizeReportStatus,
} from '../../lib/reportWorkflow';

interface IncidentStatusStepsProps {
  category: string;
  status: string;
}

export default function IncidentStatusSteps({ category, status }: IncidentStatusStepsProps) {
  const steps = getReportSteps(category);
  const canonicalStatus = normalizeReportStatus(status);
  const currentStep = getActiveStep(category, canonicalStatus);
  const isTerminal = canonicalStatus === 'resolved';

  if (canonicalStatus === 'flagged') {
    return <p className="incident-flagged-state">This report has been flagged for review.</p>;
  }

  return (
    <ol className={`incident-steps incident-steps--${steps.length}`} aria-label="Report progress">
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
            <span className="incident-steps__label">{getStatusLabel(step)}</span>
          </li>
        );
      })}
    </ol>
  );
}
