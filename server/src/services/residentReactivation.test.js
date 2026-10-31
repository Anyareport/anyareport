import test from 'node:test';
import assert from 'node:assert/strict';
import { applyResidentReactivation } from './residentReactivation.js';

test('reactivates a resident and records the actor, reason, and previous strike count', () => {
  const user = {
    firebaseUid: 'resident-uid',
    email: 'resident@example.com',
    name: 'Resident Name',
    status: 'suspended',
    flaggedReportCount: 3,
  };

  const auditRecord = applyResidentReactivation(user, {
      actorUid: 'official-uid',
      reason: 'Appeal reviewed at Barangay Hall',
    });

  assert.equal(user.status, 'active');
  assert.equal(user.flaggedReportCount, 0);
  assert.deepEqual(auditRecord, {
      action: 'resident_account_reactivated',
      actorUid: 'official-uid',
      reportId: null,
      metadata: {
        targetUid: 'resident-uid',
        targetEmail: 'resident@example.com',
        targetName: 'Resident Name',
        reason: 'Appeal reviewed at Barangay Hall',
        previousFlaggedReportCount: 3,
        resetFlaggedReportCount: 0,
      },
  });
});
