import assert from 'node:assert/strict';
import test from 'node:test';
import { formatReportReference } from './reportReference.js';

test('formats report references with a year and a zero-padded sequence', () => {
  assert.equal(formatReportReference(2026, 1), 'AR-2026-0001');
  assert.equal(formatReportReference(2026, 42), 'AR-2026-0042');
  assert.equal(formatReportReference(2026, 12345), 'AR-2026-12345');
});
