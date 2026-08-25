import { json, requireMethod, bodyOf } from '../_lib/http.js';
import { rpc } from '../_lib/supabase.js';
import { STAFF_SESSION_SECONDS, setStaffSessionCookie, publicStaff } from '../_lib/staff-auth.js';
import { hashSecureToken, newSecureToken } from '../_lib/tokens.js';

export default async function handler(request, response) {
  if (!requireMethod(request, response, ['POST'])) return;
  const token = String(bodyOf(request).token || '');
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) {
    json(response, 401, { error: 'invalid_or_expired_staff_link', message: 'This staff login link is invalid or expired.' });
    return;
  }

  try {
    const sessionToken = newSecureToken();
    const staff = await rpc('redeem_stay_play_staff_link', {
      p_token_hash_hex: hashSecureToken(token),
      p_session_hash_hex: hashSecureToken(sessionToken),
      p_session_expires_at: new Date(Date.now() + STAFF_SESSION_SECONDS * 1000).toISOString()
    });
    if (!staff?.authenticated) {
      json(response, 401, { error: 'invalid_or_expired_staff_link', message: 'This staff login link is invalid or expired.' });
      return;
    }
    setStaffSessionCookie(request, response, sessionToken);
    json(response, 200, { authenticated: true, staff: publicStaff(staff) });
  } catch (error) {
    console.error('staff_redeem_failed', error?.details || error?.message);
    json(response, 401, { error: 'invalid_or_expired_staff_link', message: 'This staff login link is invalid or expired.' });
  }
}
