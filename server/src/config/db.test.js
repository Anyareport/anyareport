import assert from 'node:assert/strict';
import test from 'node:test';
import { buildHealthResponse } from './db.js';

test('health response reports readiness only when MongoDB is connected', () => {
  const timestamp = '2026-10-31T12:00:00.000Z';

  assert.deepEqual(
    buildHealthResponse({ connected: true, state: 'connected' }, timestamp),
    {
      statusCode: 200,
      body: { status: 'ok', database: 'connected', timestamp },
    }
  );
  assert.deepEqual(
    buildHealthResponse({ connected: false, state: 'disconnected' }, timestamp),
    {
      statusCode: 503,
      body: { status: 'unavailable', database: 'disconnected', timestamp },
    }
  );
});
