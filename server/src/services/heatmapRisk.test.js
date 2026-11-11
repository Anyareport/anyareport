import assert from 'node:assert/strict';
import test from 'node:test';
import { scoreHeatmapZones } from './heatmapRisk.js';

test('heatmap risk levels use severity, open counts, and incident totals deterministically', () => {
  const scored = scoreHeatmapZones([
    {
      purok: 'Purok 01',
      incidents: 1,
      severities: { Critical: 1 },
      statuses: { pending: 1 },
    },
    {
      purok: 'Purok 02',
      incidents: 2,
      severities: { High: 1 },
      statuses: { resolved: 2 },
    },
    {
      purok: 'Purok 03',
      incidents: 1,
      severities: { Low: 1 },
      statuses: { resolved: 1 },
    },
    {
      purok: 'Purok 04',
      incidents: 5,
      severities: { Medium: 5 },
      statuses: { in_progress: 2, resolved: 3 },
    },
  ]);

  assert.deepEqual(
    scored.map(({ purok, riskLevel }) => [purok, riskLevel]),
    [
      ['Purok 01', 'Critical'],
      ['Purok 04', 'High'],
      ['Purok 02', 'Medium'],
      ['Purok 03', 'Low'],
    ]
  );
  assert.match(scored[0].rationale, /Critical because a critical report is still open/);
  assert.match(scored[0].rationale, /1 critical, 0 high-severity, and 1 still open/);
  assert.ok(scored.every((zone) => zone.recommendation.length > 0));
});

test('resolved critical reports do not become critical solely from severity', () => {
  const [zone] = scoreHeatmapZones([
    {
      purok: 'Purok 01',
      incidents: 1,
      severities: { Critical: 1 },
      statuses: { resolved: 1 },
    },
  ]);

  assert.equal(zone.riskLevel, 'High');
});
