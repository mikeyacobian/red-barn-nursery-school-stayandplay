import { json } from './http.js';
import { rpc } from './supabase.js';
import { hashSecureToken } from './tokens.js';

export const STAFF_COOKIE_NAME = 'rb_staff_session';
export const STAFF_SESSION_SECONDS = 7 * 24 * 60 * 60;

function cookiesOf(request) {
  const header = String(request.headers.cookie || '');
  const cookies = new Map();
  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 1) continue;
    const name = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    try {
      cookies.set(name, decodeURIComponent(value));
    } catch {
      cookies.set(name, '');
    }
  }
  return cookies;
}

function secureRequest(request) {
  const forwardedProtocol = String(request.headers['x-forwarded-proto'] || '').split(',')[0].trim();
  if (forwardedProtocol) return forwardedProtocol === 'https';
  const host = String(request.headers.host || '');
  return !/^localhost(?::\d+)?$/.test(host) && !/^127\.0\.0\.1(?::\d+)?$/.test(host);
}

function cookieValue(request, token, maxAge) {
  const parts = [
    `${STAFF_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAge}`
  ];
  if (secureRequest(request)) parts.push('Secure');
  return parts.join('; ');
}

export function staffSessionToken(request) {
  const token = cookiesOf(request).get(STAFF_COOKIE_NAME) || '';
  return /^[A-Za-z0-9_-]{43}$/.test(token) ? token : '';
}

export function setStaffSessionCookie(request, response, token) {
  response.setHeader('Set-Cookie', cookieValue(request, token, STAFF_SESSION_SECONDS));
}

export function clearStaffSessionCookie(request, response) {
  response.setHeader('Set-Cookie', cookieValue(request, '', 0));
}

export function publicStaff(staff) {
  return {
    displayName: staff?.displayName || '',
    role: staff?.role === 'admin' ? 'admin' : 'staff'
  };
}

export async function getStaffSession(request) {
  const token = staffSessionToken(request);
  if (!token) return null;
  return rpc('get_stay_play_staff_session', {
    p_session_hash_hex: hashSecureToken(token)
  });
}

export async function requireStaffSession(request, response, options = {}) {
  const staff = await getStaffSession(request).catch(error => {
    console.error('staff_session_check_failed', error?.details || error?.message);
    return null;
  });
  if (!staff?.authenticated || (options.role === 'admin' && staff.role !== 'admin')) {
    clearStaffSessionCookie(request, response);
    json(response, 401, { error: 'staff_auth_required', message: 'Staff access is required.' });
    return null;
  }
  return staff;
}
