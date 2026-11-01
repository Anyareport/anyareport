import assert from 'node:assert/strict';
import test from 'node:test';
import { createOfficial } from './adminController.js';
import User from '../models/User.js';

function createResponse() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

test('official creation rejects invalid phone numbers', async () => {
  const res = createResponse();
  await createOfficial(
    {
      body: {
        email: 'official@example.com',
        password: 'secure-password',
        name: 'Official',
        phone: '123',
        role: 'tanod',
      },
    },
    res
  );

  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.body, { error: 'Phone must use the format 09XXXXXXXXX' });
});

test('official creation rejects passwords shorter than eight characters', async () => {
  const res = createResponse();
  await createOfficial(
    {
      body: {
        email: 'official@example.com',
        password: 'short7!',
        name: 'Official',
        phone: '09171234567',
        role: 'tanod',
      },
    },
    res
  );

  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.body, { error: 'Password must be at least 8 characters' });
});

test('official creation rejects whitespace-only names', async () => {
  const res = createResponse();
  await createOfficial(
    {
      body: {
        email: 'official@example.com',
        password: 'secure-password',
        name: '   ',
        phone: '09171234567',
        role: 'tanod',
      },
    },
    res
  );

  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.body, {
    error: 'Email, password, name, phone, and role are required',
  });
});

test('official creation rejects phone numbers already in use', async () => {
  const originalExists = User.exists;
  User.exists = async () => ({ _id: 'existing-user' });
  const res = createResponse();

  try {
    await createOfficial(
      {
        body: {
          email: 'official@example.com',
          password: 'secure-password',
          name: 'Official',
          phone: '09123456789',
          role: 'tanod',
        },
      },
      res
    );
  } finally {
    User.exists = originalExists;
  }

  assert.equal(res.statusCode, 409);
  assert.deepEqual(res.body, { error: 'That phone number is already registered.' });
});
