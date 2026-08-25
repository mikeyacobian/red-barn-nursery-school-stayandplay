import test from 'node:test';
import assert from 'node:assert/strict';

import handler from '../api/manage/request-link.js';

const genericMessage = 'If that email matches a family with active bookings, a secure link is on its way.';

function responseRecorder() {
  return {
    statusCode: 0,
    headers: {},
    body: '',
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    end(value = '') { this.body = value; }
  };
}

async function invoke(email) {
  const request = { method: 'POST', body: { email }, headers: { host: 'example.test' } };
  const response = responseRecorder();
  await handler(request, response);
  return { status: response.statusCode, body: JSON.parse(response.body) };
}

test('unknown and provider-failing known manage-link requests are indistinguishable', async t => {
  const originalFetch = globalThis.fetch;
  const originalEnv = {
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
    RESEND_API_KEY: process.env.RESEND_API_KEY
  };
  t.after(() => {
    globalThis.fetch = originalFetch;
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value == null) delete process.env[key];
      else process.env[key] = value;
    }
  });
  process.env.SUPABASE_URL = 'https://project.supabase.co';
  process.env.SUPABASE_SECRET_KEY = 'server-test-key';
  process.env.RESEND_API_KEY = 'resend-test-key';

  globalThis.fetch = async () => new Response('null', { status: 200, headers: { 'content-type': 'application/json' } });
  const unknown = await invoke('unknown@example.com');

  let call = 0;
  globalThis.fetch = async url => {
    call += 1;
    if (String(url).includes('/rest/v1/rpc/')) {
      return new Response(JSON.stringify({
        send: true,
        email: 'known@example.com',
        parentName: 'Known Parent',
        manageLinkId: 42
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    return new Response(JSON.stringify({ message: 'Sender domain is not verified.' }), { status: 403, headers: { 'content-type': 'application/json' } });
  };
  const providerFailure = await invoke('known@example.com');

  assert.equal(call, 2);
  assert.deepEqual(unknown, { status: 200, body: { message: genericMessage } });
  assert.deepEqual(providerFailure, unknown);
});
