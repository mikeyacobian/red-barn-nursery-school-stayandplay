import { createHash, randomBytes } from 'node:crypto';

export function newManageToken() {
  return randomBytes(32).toString('base64url');
}

export function hashManageToken(token) {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export function appUrl(request) {
  if (process.env.PUBLIC_APP_URL) return process.env.PUBLIC_APP_URL.replace(/\/$/, '');
  const host = request.headers['x-forwarded-host'] || request.headers.host;
  const protocol = request.headers['x-forwarded-proto'] || 'https';
  return `${protocol}://${host}`;
}
