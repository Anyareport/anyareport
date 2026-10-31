import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import test from 'node:test';
import express from 'express';
import reportRoutes from '../routes/reportRoutes.js';
import { classificationLimiter } from './rateLimiters.js';

test('classification limiter allows ten requests per user per minute', async (t) => {
  const app = express();
  app.use((req, _res, next) => {
    req.firebaseUser = { uid: req.headers['x-test-user'] };
    next();
  });
  app.post('/classify', classificationLimiter, (_req, res) => res.sendStatus(204));

  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  }));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const url = `http://127.0.0.1:${address.port}/classify`;
  const request = (uid) =>
    fetch(url, { method: 'POST', headers: { 'x-test-user': uid } });
  const uid = `classification-test-${crypto.randomUUID()}`;

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const response = await request(uid);
    assert.equal(response.status, 204);
  }

  const limitedResponse = await request(uid);
  assert.equal(limitedResponse.status, 429);
  assert.deepEqual(await limitedResponse.json(), {
    error: 'Too many classification requests. Please wait a moment.',
  });
  assert.equal((await request(`${uid}-other`)).status, 204);
});

test('classification limiter runs before photo upload and classification', () => {
  const classifyRoute = reportRoutes.stack.find(
    (layer) => layer.route?.path === '/classify' && layer.route.methods.post
  );
  assert.ok(classifyRoute);

  const handlers = classifyRoute.route.stack.map((layer) => layer.handle);
  assert.equal(handlers[0], classificationLimiter);
  assert.equal(handlers.length, 3);
  assert.equal(handlers[2].name, 'classifyReportHandler');
});
