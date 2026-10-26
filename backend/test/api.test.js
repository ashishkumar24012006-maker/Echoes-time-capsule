import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import app from '../src/app.js';

test('health endpoint is available without a session', async () => {
  const response = await request(app).get('/health');
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { ok: true, service: 'echoes-api' });
});

test('capsule endpoints fail clearly when the database is unavailable', async () => {
  const response = await request(app).get('/api/v1/capsules/507f1f77bcf86cd799439011');
  assert.equal(response.status, 503);
  assert.match(response.body.error, /Database unavailable/);
});
