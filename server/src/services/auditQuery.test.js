import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAuditFilter } from './auditQuery.js';

test('buildAuditFilter excludes the requested actions alongside existing filters', () => {
  const filter = buildAuditFilter({
    action: 'report_submitted',
    actor: 'actor-1',
    excludeActions: 'admin_notification_read, admin_notification_sent',
  });

  assert.deepEqual(filter, {
    actorUid: 'actor-1',
    action: {
      $eq: 'report_submitted',
      $nin: ['admin_notification_read', 'admin_notification_sent'],
    },
  });
});

test('buildAuditFilter ignores empty excluded action values', () => {
  assert.deepEqual(buildAuditFilter({ excludeActions: ' , ' }), {});
});
