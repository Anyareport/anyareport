import { BLOTTER_REPORT_CATEGORY } from './reportWorkflow';
import type { LabelKey } from '../i18n/labels';

const NEXT_STEPS: Record<string, LabelKey[]> = {
  'Emergency Situations': [
    'nextStepEmergencyConfirm',
    'nextStepEmergencyNotifyCaptain',
    'nextStepEmergencyHotline',
    'nextStepEmergencyNoTanod',
  ],
  'Public Concerns': [
    'nextStepPublicVisit',
    'nextStepPublicDocument',
    'nextStepPublicInform',
  ],
  [BLOTTER_REPORT_CATEGORY]: [
    'nextStepBlotterVerify',
    'nextStepBlotterRefer',
    'nextStepBlotterPolice',
    'nextStepBlotterDiscreet',
  ],
};

export function getSuggestedNextSteps(category: string): readonly LabelKey[] {
  return NEXT_STEPS[category] ?? [];
}
