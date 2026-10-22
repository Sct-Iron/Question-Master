import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';

const env = {
  FIREBASE_PROJECT_ID: 'questionmaster-c4fab',
  APP_ORIGINS: 'https://question-master01.vercel.app,http://localhost:5173',
};

test('health endpoint returns a service response without authentication', async () => {
  const response = await worker.fetch(
    new Request('https://api.test/health'),
    env,
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, service: 'question-master-api' });
});

test('CORS preflight allows configured production origin', async () => {
  const response = await worker.fetch(
    new Request('https://api.test/listAdmins', {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://question-master01.vercel.app',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'authorization,content-type',
      },
    }),
    env,
  );

  assert.equal(response.status, 204);
  assert.equal(response.headers.get('access-control-allow-origin'), 'https://question-master01.vercel.app');
});

test('CORS does not allow an unconfigured origin', async () => {
  const response = await worker.fetch(
    new Request('https://api.test/listAdmins', {
      method: 'OPTIONS',
      headers: { Origin: 'https://malicious.example' },
    }),
    env,
  );

  assert.equal(response.status, 204);
  assert.equal(response.headers.get('access-control-allow-origin'), null);
});

test('protected routes reject missing authentication', async () => {
  const response = await worker.fetch(
    new Request('https://api.test/listAdmins', { method: 'POST', body: '{}' }),
    env,
  );

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: 'You must be signed in.' });
});

test('admin route normalization accepts the deployed route format', async () => {
  const response = await worker.fetch(
    new Request('https://api.test/api/listAdmins', { method: 'POST', body: '{}' }),
    env,
  );

  // The route is recognized and reaches auth; it must not become a generic 404.
  assert.equal(response.status, 401);
});
