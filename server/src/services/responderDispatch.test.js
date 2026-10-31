import assert from 'node:assert/strict';
import test from 'node:test';
import { lockAndCheckResponders, RespondersUnavailableError } from './responderDispatch.js';

function createModels({ matchedCount = 2, activeReports = [] } = {}) {
  const calls = {};
  const session = { id: 'dispatch-transaction' };
  const userModel = {
    updateMany: async (...args) => {
      calls.userUpdate = args;
      return { matchedCount };
    },
  };
  const reportQuery = {
    select(value) {
      calls.select = value;
      return this;
    },
    session(value) {
      calls.session = value;
      return this;
    },
    lean: async () => activeReports,
  };
  const reportModel = {
    find: (query) => {
      calls.reportQuery = query;
      return reportQuery;
    },
  };
  return { calls, session, userModel, reportModel };
}

test('locks selected responder records and checks assignments in the same transaction', async () => {
  const models = createModels();
  const responderUids = ['responder-1', 'responder-2'];

  await lockAndCheckResponders({
    reportId: 'target-report',
    responderUids,
    session: models.session,
    userModel: models.userModel,
    reportModel: models.reportModel,
  });

  assert.deepEqual(models.calls.userUpdate[0].firebaseUid.$in, responderUids);
  assert.deepEqual(models.calls.userUpdate[1], { $inc: { dispatchLockVersion: 1 } });
  assert.equal(models.calls.userUpdate[2].session, models.session);
  assert.equal(models.calls.session, models.session);
  assert.deepEqual(models.calls.reportQuery._id, { $ne: 'target-report' });
});

test('rejects dispatch when a selected responder was assigned to another open report', async () => {
  const models = createModels({
    activeReports: [
      {
        acknowledgedBy: 'responder-1',
        backupRequests: [],
        dispatchInvites: [],
      },
    ],
  });

  await assert.rejects(
    lockAndCheckResponders({
      reportId: 'target-report',
      responderUids: ['responder-1'],
      session: models.session,
      userModel: models.userModel,
      reportModel: models.reportModel,
    }),
    RespondersUnavailableError
  );
});

test('rejects dispatch when any selected responder is not eligible', async () => {
  const models = createModels({ matchedCount: 1 });

  await assert.rejects(
    lockAndCheckResponders({
      reportId: 'target-report',
      responderUids: ['responder-1', 'responder-2'],
      session: models.session,
      userModel: models.userModel,
      reportModel: models.reportModel,
    }),
    RespondersUnavailableError
  );
  assert.equal(models.calls.reportQuery, undefined);
});
