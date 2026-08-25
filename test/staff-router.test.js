import test from 'node:test';
import assert from 'node:assert/strict';

import handler from '../api/staff.js';

function responseRecorder() {
  return {
    statusCode: 0,
    headers: {},
    body: '',
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    end(value = '') { this.body = value; }
  };
}

test('consolidated staff function dispatches known actions and rejects unknown ones', async () => {
  const knownResponse = responseRecorder();
  await handler({ method: 'POST', query: { action: 'request-link' }, body: { email: 'invalid' }, headers: {} }, knownResponse);
  assert.equal(knownResponse.statusCode, 200);
  assert.equal(JSON.parse(knownResponse.body).message, 'If that email is authorized for staff access, a secure link is on its way.');

  const unknownResponse = responseRecorder();
  await handler({ method: 'GET', query: { action: 'unknown' }, headers: {} }, unknownResponse);
  assert.equal(unknownResponse.statusCode, 404);
  assert.deepEqual(JSON.parse(unknownResponse.body), { error: 'not_found' });
});
