import assert from 'node:assert/strict';
import test from 'node:test';
import { registerProfile } from './authController.js';

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
