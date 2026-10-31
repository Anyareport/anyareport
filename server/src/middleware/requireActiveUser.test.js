import test from 'node:test';
import assert from 'node:assert/strict';
import { requireActiveUser } from './requireActiveUser.js';

function runMiddleware(middleware, userProfile) {
  const req = { userProfile };
  let nextCalled = false;
  let statusCode = null;
  let responseBody = null;
  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(body) {
      responseBody = body;
      return this;
    },
  };

  middleware(req, res, () => {
    nextCalled = true;
  });

  return { nextCalled, statusCode, responseBody };
}

test('allows active users', () => {
  assert.deepEqual(runMiddleware(requireActiveUser(), { status: 'active' }), {
    nextCalled: true,
    statusCode: null,
    responseBody: null,
  });
});

test('blocks suspended users with a clear forbidden response', () => {
  assert.deepEqual(runMiddleware(requireActiveUser(), { status: 'suspended' }), {
    nextCalled: false,
    statusCode: 403,
    responseBody: {
      error: 'Account suspended — access to this feature is blocked',
      code: 'ACCOUNT_SUSPENDED',
    },
  });
});

test('requires a profile for feature access', () => {
  assert.deepEqual(runMiddleware(requireActiveUser(), null), {
    nextCalled: false,
    statusCode: 403,
    responseBody: {
      error: 'Complete registration before accessing this feature',
      code: 'PROFILE_REQUIRED',
    },
  });
});

test('allows unregistered users through the profile-registration route guard', () => {
  assert.deepEqual(runMiddleware(requireActiveUser({ allowUnregistered: true }), null), {
    nextCalled: true,
    statusCode: null,
    responseBody: null,
  });
});

test('still blocks suspended users on routes that allow unregistered users', () => {
  assert.deepEqual(
    runMiddleware(requireActiveUser({ allowUnregistered: true }), { status: 'suspended' }),
    {
      nextCalled: false,
      statusCode: 403,
      responseBody: {
        error: 'Account suspended — access to this feature is blocked',
        code: 'ACCOUNT_SUSPENDED',
      },
    }
  );
});
