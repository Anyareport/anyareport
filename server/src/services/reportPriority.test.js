import test from 'node:test';
import assert from 'node:assert/strict';
import {
  compareReportPriority,
  compareReportSubmittedAtDescending,
} from './reportPriority.js';

test('report priority matches the incidents list severity, status, and date ordering', () => {
  const reports = [
    { _id: '4', category: 'Public Concerns', severity: 'Low', status: 'pending', createdAt: '2026-01-01' },
    { _id: '3', category: 'Emergency Situations', severity: 'High', status: 'pending', createdAt: '2026-01-02' },
    { _id: '2', category: 'Emergency Situations', severity: 'Critical', status: 'in_progress', createdAt: '2026-01-02' },
    { _id: '1', category: 'Emergency Situations', severity: 'Critical', status: 'pending', createdAt: '2026-01-03' },
  ];

  assert.deepEqual(reports.sort(compareReportPriority).map((report) => report._id), ['1', '2', '3', '4']);
});

test('resolved reports are ordered by resolution time and flagged reports by submission date', () => {
  const reports = [
    { _id: 'flagged-old', status: 'flagged', createdAt: '2026-01-01' },
    { _id: 'resolved-old', status: 'resolved', createdAt: '2026-01-01', resolution: { resolvedAt: '2026-01-02' } },
    { _id: 'resolved-new', status: 'resolved', createdAt: '2026-01-02', resolution: { resolvedAt: '2026-01-03' } },
    { _id: 'flagged-new', status: 'flagged', createdAt: '2026-01-03' },
  ];

  assert.deepEqual(
    reports.sort(compareReportPriority).map((report) => report._id),
    ['resolved-new', 'resolved-old', 'flagged-new', 'flagged-old']
  );
});

test('all-report exports use newest submission time first, independent of incident priority', () => {
  const reports = [
    { _id: 'new-critical', category: 'Emergency Situations', severity: 'Critical', createdAt: '2026-01-03' },
    { _id: 'old-critical', category: 'Emergency Situations', severity: 'Critical', createdAt: '2026-01-01' },
    { _id: 'new-low', category: 'Public Concerns', severity: 'Low', createdAt: '2026-01-02' },
  ];

  assert.deepEqual(
    reports.sort(compareReportSubmittedAtDescending).map((report) => report._id),
    ['new-critical', 'new-low', 'old-critical']
  );
});
