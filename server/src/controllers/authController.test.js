import assert from 'node:assert/strict';
import test from 'node:test';
import { registerProfile, updateProfile } from './authController.js';
import User from '../models/User.js';

test('rejects profile registration without privacy acknowledgement', async () => {
  let statusCode;
  let responseBody;
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

  await registerProfile({ body: { consent: false } }, res);

  assert.equal(statusCode, 400);
  assert.deepEqual(responseBody, { error: 'Privacy acknowledgement is required' });
});

test('rejects profile registration with invalid phone numbers', async () => {
  let statusCode;
  let responseBody;
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

  await registerProfile(
    {
      body: { consent: true, name: 'Resident', phone: '123' },
      firebaseUser: { uid: 'resident-1', email: 'resident@example.com' },
    },
    res
  );

  assert.equal(statusCode, 400);
  assert.deepEqual(responseBody, { error: 'Phone must use the format 09XXXXXXXXX' });
});

test('rejects profile updates with invalid phone numbers', async () => {
  let statusCode;
  let responseBody;
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

  await updateProfile(
    { body: { phone: '+639171234567' }, firebaseUser: { uid: 'official-1' } },
    res
  );

  assert.equal(statusCode, 400);
  assert.deepEqual(responseBody, { error: 'Phone must use the format 09XXXXXXXXX' });
});

test('rejects profile registration when the phone number is already in use', async () => {
  const originalFindOne = User.findOne;
  const originalExists = User.exists;
  User.findOne = async () => null;
  User.exists = async () => ({ _id: 'existing-user' });
  let statusCode;
  let responseBody;
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

  try {
    await registerProfile(
      {
        body: { consent: true, name: 'Resident', phone: '09123456789' },
        firebaseUser: { uid: 'resident-1', email: 'resident@example.com' },
      },
      res
    );
  } finally {
    User.findOne = originalFindOne;
    User.exists = originalExists;
  }

  assert.equal(statusCode, 409);
  assert.deepEqual(responseBody, { error: 'That phone number is already registered.' });
});

test('rejects profile updates when the phone number is already in use', async () => {
  const originalFindOne = User.findOne;
  const originalExists = User.exists;
  User.findOne = async () => ({ _id: 'current-user' });
  User.exists = async () => ({ _id: 'existing-user' });
  let statusCode;
  let responseBody;
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

  try {
    await updateProfile(
      { body: { phone: '09123456789' }, firebaseUser: { uid: 'resident-1' } },
      res
    );
  } finally {
    User.findOne = originalFindOne;
    User.exists = originalExists;
  }

  assert.equal(statusCode, 409);
  assert.deepEqual(responseBody, { error: 'That phone number is already registered.' });
});
