import test from 'node:test';
import assert from 'node:assert/strict';

import { hashSecureToken, newSecureToken } from '../api/_lib/tokens.js';
import {
  STAFF_COOKIE_NAME,
  clearStaffSessionCookie,
  publicStaff,
  setStaffSessionCookie,
  staffSessionToken
} from '../api/_lib/staff-auth.js';

function responseMock() {
  const headers = new Map();
  return {
    headers,
    setHeader(name, value) {
      headers.set(name.toLowerCase(), value);
    }
  };
}

test('secure tokens are 256-bit base64url values and hash deterministically', () => {
  const token = newSecureToken();
  assert.match(token, /^[A-Za-z0-9_-]{43}$/);
  assert.match(hashSecureToken(token), /^[0-9a-f]{64}$/);
  assert.equal(hashSecureToken(token), hashSecureToken(token));
});

test('staff session token accepts only the expected cookie format', () => {
  const token = newSecureToken();
  assert.equal(staffSessionToken({ headers: { cookie: `x=1; ${STAFF_COOKIE_NAME}=${token}` } }), token);
  assert.equal(staffSessionToken({ headers: { cookie: `${STAFF_COOKIE_NAME}=not-valid` } }), '');
  assert.equal(staffSessionToken({ headers: {} }), '');
});

test('production staff cookie is HttpOnly, Secure, SameSite Lax, and scoped to the app', () => {
  const token = newSecureToken();
  const response = responseMock();
  setStaffSessionCookie(
    { headers: { host: 'red-barn.example.org', 'x-forwarded-proto': 'https' } },
    response,
    token
  );
  const cookie = response.headers.get('set-cookie');
  assert.match(cookie, new RegExp(`^${STAFF_COOKIE_NAME}=`));
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /Secure/);
  assert.match(cookie, /SameSite=Lax/);
  assert.match(cookie, /Path=\//);
  assert.match(cookie, /Max-Age=604800/);
});

test('local development cookie works without Secure and clearing expires it', () => {
  const token = newSecureToken();
  const response = responseMock();
  setStaffSessionCookie({ headers: { host: 'localhost:3000', 'x-forwarded-proto': 'http' } }, response, token);
  assert.doesNotMatch(response.headers.get('set-cookie'), /; Secure/);

  clearStaffSessionCookie({ headers: { host: 'localhost:3000' } }, response);
  assert.match(response.headers.get('set-cookie'), /Max-Age=0/);
});

test('public staff response exposes only display name and normalized role', () => {
  assert.deepEqual(
    publicStaff({ displayName: 'Morgan Staff', email: 'private@example.org', role: 'admin', sessionId: 42 }),
    { displayName: 'Morgan Staff', role: 'admin' }
  );
  assert.deepEqual(publicStaff({ role: 'unexpected' }), { displayName: '', role: 'staff' });
});

