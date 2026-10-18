import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildReportFlaggedEvent,
  buildUserCreatedEvent,
  buildUserRoleEvent,
  buildUserStatusEvent,
} from './adminNotificationEvents.js';

const target = { firebaseUid: 'uid-1', email: 'a@b.c', name: 'Ana', role: 'captain', status: 'active' };

test('creating an admin account is urgent and audited with the target details', () => {
  const event = buildUserCreatedEvent({ actorName: 'Root', target: { ...target, role: 'admin' } });
  assert.equal(event.urgent, true);
  assert.equal(event.auditAction, 'user_created');
  assert.equal(event.auditMetadata.targetUid, 'uid-1');
  assert.match(event.message, /Root created a Admin account for Ana/);
});

test('creating a non-admin account is not urgent', () => {
  assert.equal(buildUserCreatedEvent({ actorName: 'Root', target }).urgent, false);
});

test('status events record the before and after status', () => {
  const event = buildUserStatusEvent({
    actorName: 'Root',
    target: { ...target, status: 'suspended' },
    previousStatus: 'active',
  });
  assert.equal(event.auditAction, 'user_status_changed');
  assert.deepEqual([event.auditMetadata.from, event.auditMetadata.to], ['active', 'suspended']);
  assert.match(event.message, /suspended/);
});

test('role changes are urgent only when an admin role is gained or lost', () => {
  const promote = buildUserRoleEvent({ actorName: 'Root', target: { ...target, role: 'admin' }, previousRole: 'captain' });
  const demote = buildUserRoleEvent({ actorName: 'Root', target, previousRole: 'admin' });
  const lateral = buildUserRoleEvent({ actorName: 'Root', target, previousRole: 'secretary' });
  assert.equal(promote.urgent, true);
  assert.equal(demote.urgent, true);
  assert.equal(lateral.urgent, false);
  assert.deepEqual([lateral.auditMetadata.from, lateral.auditMetadata.to], ['secretary', 'captain']);
});

test('flagged report message includes the reference number when present', () => {
  assert.match(
    buildReportFlaggedEvent({ actorName: 'Sec', report: { referenceNumber: 'AR-1' } }).message,
    /report AR-1/
  );
  assert.match(buildReportFlaggedEvent({ actorName: 'Sec', report: {} }).message, /flagged report as/);
});