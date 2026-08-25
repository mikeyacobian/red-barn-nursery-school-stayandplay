import { createHash, randomBytes } from 'node:crypto';

export function newSecureToken() {
  return randomBytes(32).toString('base64url');
}

export function hashSecureToken(token) {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export function newManageToken() {
  return newSecureToken();
}

export function hashManageToken(token) {
  return hashSecureToken(token);
}

export function appUrl(request) {
  const configured = String(process.env.PUBLIC_APP_URL || '').trim().replace(/\/$/, '');
  if (/^https:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(configured)) return configured;

  const vercelHost = String(process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL || '').trim();
  if (/^[a-z0-9.-]+$/i.test(vercelHost)) return `https://${vercelHost}`;

  const forwardedHost = String(request.headers['x-forwarded-host'] || request.headers.host || '').split(',')[0].trim();
  if (!/^[a-z0-9.-]+(?::\d+)?$/i.test(forwardedHost)) throw new Error('Application URL is not configured.');
  const local = /^localhost(?::\d+)?$/i.test(forwardedHost) || /^127\.0\.0\.1(?::\d+)?$/.test(forwardedHost);
  return `${local ? 'http' : 'https'}://${forwardedHost}`;
}
