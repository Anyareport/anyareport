import assert from 'node:assert/strict';
import test from 'node:test';
import type { Report } from '../src/lib/api.ts';
import { compareIncidentPriority } from '../src/lib/sortUtils.ts';

function createReport(overrides: Partial<Report> = {}): Report {
  return {
    _id: 'report-1',
    category: 'Public Concerns',
    status: 'pending',
    severity: 'Low',
    createdAt: '2026-01-01T00:00:00.000Z',
    resolution: null,
    statusHistory: [],
    ...overrides,
  } as Report;
}

test('active Medium reports sort before resolved Critical reports', () => {
  const resolvedCritical = createReport({
    _id: 'resolved-critical',
    status: 'resolved',
    severity: 'Critical',
    createdAt: '2020-01-01T00:00:00.000Z',
  });
  const activeMedium = createReport({ _id: 'active-medium', severity: 'Medium' });

  assert.ok(compareIncidentPriority(activeMedium, resolvedCritical) < 0);
});

test('older active Low reports sort before newer active Low reports', () => {
  const oldReport = createReport({ _id: 'old', createdAt: '2025-01-01T00:00:00.000Z' });
  const newReport = createReport({ _id: 'new', createdAt: '2026-01-01T00:00:00.000Z' });

  assert.ok(compareIncidentPriority(oldReport, newReport) < 0);
});

test('newer resolved Low reports sort before older resolved Critical reports', () => {
  const newerResolvedLow = createReport({
    _id: 'newer-resolved-low',
    status: 'resolved',
    severity: 'Low',
    createdAt: '2024-01-01T00:00:00.000Z',
    resolution: { resolvedAt: '2026-01-01T00:00:00.000Z' } as Report['resolution'],
  });
  const olderResolvedCritical = createReport({
    _id: 'older-resolved-critical',
    status: 'resolved',
    severity: 'Critical',
    createdAt: '2025-01-01T00:00:00.000Z',
    resolution: { resolvedAt: '2025-02-01T00:00:00.000Z' } as Report['resolution'],
  });

  assert.ok(compareIncidentPriority(newerResolvedLow, olderResolvedCritical) < 0);
});

test('resolved reports sort before flagged reports', () => {
  const resolved = createReport({ _id: 'resolved', status: 'resolved' });
  const flagged = createReport({ _id: 'flagged', status: 'flagged' });

  assert.ok(compareIncidentPriority(resolved, flagged) < 0);
});

test('Emergency category wins ties at equal severity, but not higher severity', () => {
  const criticalEmergency = createReport({
    _id: 'critical-emergency',
    category: 'Emergency Situations',
    severity: 'Critical',
    status: 'in_progress',
  });
  const criticalBlotter = createReport({
    _id: 'critical-blotter',
    category: 'Blotter Cases',
    severity: 'Critical',
    status: 'coordinating',
  });
  const highEmergency = createReport({
    _id: 'high-emergency',
    category: 'Emergency Situations',
    severity: 'High',
  });

  assert.ok(compareIncidentPriority(criticalEmergency, criticalBlotter) < 0);
  assert.ok(compareIncidentPriority(criticalBlotter, highEmergency) < 0);
});

test('identical priority fields use report ID as a stable tiebreaker', () => {
  const first = createReport({ _id: 'a' });
  const second = createReport({ _id: 'b' });

  assert.ok(compareIncidentPriority(first, second) < 0);
});
