import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canViewReporter,
  canViewReporterContact,
  getJoinDecision,
  getTransitionDecision,
  normalizeReportStatus,
} from './reportWorkflow.js';

function matchesStatus(filterStatus, currentStatus) {
  if (filterStatus && typeof filterStatus === 'object' && '$in' in filterStatus) {
    return filterStatus.$in.includes(currentStatus);
  }
  if (filterStatus && typeof filterStatus === 'object' && '$ne' in filterStatus) {
    return currentStatus !== filterStatus.$ne;
  }
  return filterStatus === undefined || filterStatus === currentStatus;
}

function tryAtomicStatusChange(report, decision, actorUid) {
  if (!decision.allowed || !matchesStatus(decision.filter.status, report.status)) return false;
  if (
    'acknowledgedBy' in decision.filter &&
    decision.filter.acknowledgedBy !== report.acknowledgedBy
  ) {
    return false;
  }
  if (
    decision.filter.$or &&
    !decision.filter.$or.some((clause) =>
      Object.entries(clause).some(([key, value]) => {
        if (key === 'acknowledgedBy') return report.acknowledgedBy === value;
        return report.backupRequests.some((request) => request.joinedBy.includes(actorUid));
      })
    )
  ) {
    return false;
  }

  report.status = decision.update.status;
  if (decision.update.acknowledgedBy) report.acknowledgedBy = decision.update.acknowledgedBy;
  return true;
}

function tryAtomicJoin(report, decision, actorUid, ownerUid) {
  if (!decision.allowed || decision.alreadyJoined) return false;
  if (!matchesStatus(decision.filter.status, report.status)) return false;
  if (report.acknowledgedBy !== ownerUid) return false;
  const request = report.backupRequests.find(
    (entry) => entry.requestedBy === ownerUid && entry.status === 'pending'
  );
  if (!request || request.joinedBy.includes(actorUid)) return false;
  request.joinedBy.push(actorUid);
  return true;
}

test('field workflow requires coordinating before in-progress and resolution', () => {
  const acknowledge = getTransitionDecision({
    category: 'Public Concerns',
    role: 'tanod',
    fromStatus: 'pending',
    toStatus: 'coordinating',
    actorUid: 'tanod-1',
  });
  assert.equal(acknowledge.allowed, true);

  const start = getTransitionDecision({
    category: 'Emergency Situations',
    role: 'responder',
    fromStatus: 'coordinating',
    toStatus: 'in_progress',
    actorUid: 'lead',
    ownerUid: 'lead',
  });
  assert.equal(start.allowed, true);

  const prematureResolve = getTransitionDecision({
    category: 'Emergency Situations',
    role: 'responder',
    fromStatus: 'coordinating',
    toStatus: 'resolved',
    actorUid: 'lead',
    ownerUid: 'lead',
  });
  assert.equal(prematureResolve.allowed, false);
  assert.match(prematureResolve.error, /In Progress/);

  const pendingResolve = getTransitionDecision({
    category: 'Public Concerns',
    role: 'responder',
    fromStatus: 'pending',
    toStatus: 'resolved',
    actorUid: 'lead',
    ownerUid: 'lead',
  });
  assert.equal(pendingResolve.allowed, false);
});

test('blotter processing and resolution are role-specific', () => {
  assert.equal(
    getTransitionDecision({
      category: 'Blotter Cases',
      role: 'captain',
      fromStatus: 'pending',
      toStatus: 'in_progress',
    }).allowed,
    true
  );
  assert.equal(
    getTransitionDecision({
      category: 'Blotter Cases',
      role: 'secretary',
      fromStatus: 'in_progress',
      toStatus: 'resolved',
    }).allowed,
    true
  );

  const forbidden = getTransitionDecision({
    category: 'Blotter Cases',
    role: 'captain',
    fromStatus: 'in_progress',
    toStatus: 'resolved',
  });
  assert.equal(forbidden.allowed, false);
  assert.match(forbidden.error, /Secretary/);
});

test('Captain, Secretary, and Admin cannot change field incident status', () => {
  for (const role of ['captain', 'secretary', 'admin']) {
    const decision = getTransitionDecision({
      category: 'Emergency Situations',
      role,
      fromStatus: 'in_progress',
      toStatus: 'resolved',
      actorUid: `${role}-1`,
      ownerUid: `${role}-1`,
    });
    assert.equal(decision.allowed, false, `${role} must not resolve a field incident`);
  }

  const captainStartsField = getTransitionDecision({
    category: 'Public Concerns',
    role: 'captain',
    fromStatus: 'pending',
    toStatus: 'in_progress',
  });
  const responderStartsBlotter = getTransitionDecision({
    category: 'Blotter Cases',
    role: 'responder',
    fromStatus: 'pending',
    toStatus: 'in_progress',
  });
  const adminStartsBlotter = getTransitionDecision({
    category: 'Blotter Cases',
    role: 'admin',
    fromStatus: 'pending',
    toStatus: 'in_progress',
  });
  assert.equal(captainStartsField.allowed, false);
  assert.equal(responderStartsBlotter.allowed, false);
  assert.equal(adminStartsBlotter.allowed, false);
});

test('first concurrent acknowledger wins the pending compare-and-set', async () => {
  const report = { category: 'Public Concerns', status: 'pending', acknowledgedBy: null };
  const attempt = async (actorUid) => {
    const decision = getTransitionDecision({
      category: report.category,
      role: 'tanod',
      fromStatus: report.status,
      toStatus: 'coordinating',
      actorUid,
      ownerUid: report.acknowledgedBy,
    });
    await Promise.resolve();
    return tryAtomicStatusChange(report, decision, actorUid);
  };

  const results = await Promise.all([attempt('tanod-1'), attempt('tanod-2')]);
  assert.equal(results.filter(Boolean).length, 1);
  assert.equal(report.status, 'coordinating');
  assert.ok(['tanod-1', 'tanod-2'].includes(report.acknowledgedBy));
});

test('first eligible participant to resolve an in-progress incident wins', async () => {
  const report = {
    category: 'Emergency Situations',
    status: 'in_progress',
    acknowledgedBy: 'lead',
    backupRequests: [{ joinedBy: ['helper'] }],
  };
  const attempt = async (actorUid) => {
    const decision = getTransitionDecision({
      category: report.category,
      role: 'responder',
      fromStatus: report.status,
      toStatus: 'resolved',
      actorUid,
      ownerUid: report.acknowledgedBy,
      helperUids: report.backupRequests.flatMap((request) => request.joinedBy),
    });
    await Promise.resolve();
    return tryAtomicStatusChange(report, decision, actorUid);
  };

  const results = await Promise.all([attempt('lead'), attempt('helper')]);
  assert.equal(results.filter(Boolean).length, 1);
  assert.equal(report.status, 'resolved');
});

test('duplicate backup joins are idempotent and a join after resolution is rejected', () => {
  const backupRequests = [{ requestedBy: 'lead', status: 'pending', joinedBy: [] }];
  const first = getJoinDecision({
    category: 'Emergency Situations',
    status: 'coordinating',
    ownerUid: 'lead',
    actorUid: 'helper',
    backupRequests,
  });
  assert.equal(first.allowed, true);
  backupRequests[0].joinedBy.push('helper');

  const retry = getJoinDecision({
    category: 'Emergency Situations',
    status: 'coordinating',
    ownerUid: 'lead',
    actorUid: 'helper',
    backupRequests,
  });
  assert.equal(retry.allowed, true);
  assert.equal(retry.alreadyJoined, true);

  const afterResolve = getJoinDecision({
    category: 'Emergency Situations',
    status: 'resolved',
    ownerUid: 'lead',
    actorUid: 'another-helper',
    backupRequests,
  });
  assert.equal(afterResolve.allowed, false);
});

test('simultaneous distinct backup joins both record participants only once', async () => {
  const report = {
    category: 'Emergency Situations',
    status: 'coordinating',
    acknowledgedBy: 'lead',
    backupRequests: [{ requestedBy: 'lead', status: 'pending', joinedBy: [] }],
  };
  const attempts = ['helper-1', 'helper-2'].map((actorUid) => {
    const decision = getJoinDecision({
      category: report.category,
      status: report.status,
      ownerUid: report.acknowledgedBy,
      actorUid,
      backupRequests: report.backupRequests,
    });
    return Promise.resolve().then(() =>
      tryAtomicJoin(report, decision, actorUid, report.acknowledgedBy)
    );
  });

  const results = await Promise.all(attempts);
  assert.deepEqual(results, [true, true]);
  assert.deepEqual(report.backupRequests[0].joinedBy, ['helper-1', 'helper-2']);
});

test('a join racing with resolution is accepted only if its request wins first', () => {
  const report = {
    category: 'Emergency Situations',
    status: 'in_progress',
    acknowledgedBy: 'lead',
    backupRequests: [{ requestedBy: 'lead', status: 'pending', joinedBy: [] }],
  };
  const joinDecision = getJoinDecision({
    category: report.category,
    status: report.status,
    ownerUid: report.acknowledgedBy,
    actorUid: 'helper',
    backupRequests: report.backupRequests,
  });
  const resolveDecision = getTransitionDecision({
    category: report.category,
    role: 'responder',
    fromStatus: report.status,
    toStatus: 'resolved',
    actorUid: 'lead',
    ownerUid: report.acknowledgedBy,
  });

  assert.equal(tryAtomicStatusChange(report, resolveDecision, 'lead'), true);
  assert.equal(tryAtomicJoin(report, joinDecision, 'helper', 'lead'), false);
  assert.equal(report.status, 'resolved');
});

test('legacy statuses map to canonical user-facing states', () => {
  assert.equal(normalizeReportStatus('acknowledged'), 'coordinating');
  assert.equal(normalizeReportStatus('en_route'), 'in_progress');
  assert.equal(normalizeReportStatus('on_scene'), 'in_progress');
  assert.equal(normalizeReportStatus('verified'), 'pending');
});

test('reporter visibility follows role and incident participation', () => {
  const fieldReport = {
    category: 'Emergency Situations',
    submittedBy: 'resident-1',
    acknowledgedBy: 'lead-1',
    backupRequests: [{ joinedBy: ['helper-1'] }],
  };
  assert.equal(canViewReporter('resident', fieldReport, 'resident-1'), true);
  assert.equal(canViewReporterContact('resident', fieldReport, 'resident-1'), true);
  assert.equal(canViewReporter('responder', fieldReport, 'lead-1'), true);
  assert.equal(canViewReporter('tanod', fieldReport, 'helper-1'), true);
  assert.equal(canViewReporterContact('responder', fieldReport, 'lead-1'), true);
  assert.equal(canViewReporter('responder', fieldReport, 'other-1'), false);
  assert.equal(canViewReporter('captain', fieldReport, 'captain-1'), false);
  assert.equal(canViewReporterContact('captain', fieldReport, 'captain-1'), false);
  assert.equal(canViewReporter('admin', fieldReport, 'admin-1'), false);
  assert.equal(canViewReporterContact('admin', fieldReport, 'admin-1'), false);

  const blotterReport = { ...fieldReport, category: 'Blotter Cases' };
  assert.equal(canViewReporter('secretary', blotterReport, 'secretary-1'), true);
  assert.equal(canViewReporterContact('secretary', blotterReport, 'secretary-1'), true);
  assert.equal(canViewReporter('captain', blotterReport, 'captain-1'), true);
  assert.equal(canViewReporterContact('captain', blotterReport, 'captain-1'), false);
  assert.equal(canViewReporter('secretary', fieldReport, 'secretary-1'), false);
  assert.equal(canViewReporter('admin', blotterReport, 'admin-1'), false);
  assert.equal(canViewReporterContact('admin', blotterReport, 'admin-1'), false);
});
