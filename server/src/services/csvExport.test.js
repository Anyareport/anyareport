import assert from 'node:assert/strict';
import test from 'node:test';
import { toCsv, toIsoTimestamp } from './csvExport.js';

test('CSV export uses UTF-8 BOM, CRLF, and spreadsheet-safe cells', () => {
  const csv = toCsv(
    [{ incident: '=1+1', description: 'A "quoted", multiline\nvalue' }],
    [
      { label: 'Incident', value: 'incident' },
      { label: 'Description', value: 'description' },
    ]
  );

  assert.equal(
    csv,
    '\uFEFFIncident,Description\r\n\'=1+1,"A ""quoted"", multiline\nvalue"'
  );
});

test('timestamps are normalized to ISO 8601 UTC and invalid values are blank', () => {
  assert.equal(toIsoTimestamp('2024-01-02T03:04:05-05:00'), '2024-01-02T08:04:05.000Z');
  assert.equal(toIsoTimestamp('not a timestamp'), '');
  assert.equal(toIsoTimestamp(null), '');
});
