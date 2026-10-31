import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getEmergencyTypeError,
  getReportClassificationError,
} from './reportClassification.js';

const validClassification = {
  category: 'Public Concerns',
  subcategory: 'Sanitation',
  severity: 'Low',
};

test('accepts a valid category, subcategory, and severity', () => {
  assert.equal(getReportClassificationError(validClassification), null);
});

test('rejects categories outside the supported list', () => {
  assert.equal(
    getReportClassificationError({ ...validClassification, category: 'Other' }),
    'Invalid report category'
  );
});

test('rejects subcategories that do not belong to the selected category', () => {
  assert.equal(
    getReportClassificationError({ ...validClassification, subcategory: 'Criminal' }),
    'Invalid subcategory for report category'
  );
});

test('rejects unsupported severity values', () => {
  assert.equal(
    getReportClassificationError({ ...validClassification, severity: 'Urgent' }),
    'Invalid report severity'
  );
});

test('rejects low severity for emergency reports', () => {
  assert.equal(
    getReportClassificationError({
      category: 'Emergency Situations',
      subcategory: 'Public',
      severity: 'Low',
    }),
    'Emergency reports cannot have Low severity'
  );
});

test('requires a supported incident type for emergency reports', () => {
  assert.equal(
    getEmergencyTypeError({
      category: 'Emergency Situations',
      emergencyType: 'fire',
    }),
    null
  );
  assert.equal(
    getEmergencyTypeError({
      category: 'Emergency Situations',
      emergencyType: 'AI-generated incident title',
    }),
    'Select a valid emergency type'
  );
  assert.equal(
    getEmergencyTypeError({
      category: 'Public Concerns',
      emergencyType: 'fire',
    }),
    'Emergency type is only valid for emergency reports'
  );
});
