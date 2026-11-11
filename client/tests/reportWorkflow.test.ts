import assert from 'node:assert/strict';
import test from 'node:test';
import { getStatusLabel } from '../src/lib/reportWorkflow.ts';

test('coordinating status is displayed as acknowledged, including legacy values', () => {
  assert.equal(getStatusLabel('coordinating'), 'Acknowledged');
  assert.equal(getStatusLabel('acknowledged'), 'Acknowledged');
  assert.equal(getStatusLabel('in_progress'), 'In Progress');
});
