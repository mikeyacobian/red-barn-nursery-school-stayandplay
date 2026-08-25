import { json, requireMethod } from '../../api/_lib/http.js';
import { rpc } from '../../api/_lib/supabase.js';
import { clearStaffSessionCookie, staffSessionToken } from '../../api/_lib/staff-auth.js';
import { hashSecureToken } from '../../api/_lib/tokens.js';

export default async function handler(request, response) {
  if (!requireMethod(request, response, ['POST'])) return;
  const token = staffSessionToken(request);
  try {
    if (token) {
      await rpc('revoke_stay_play_staff_session', {
        p_session_hash_hex: hashSecureToken(token)
      });
    }
  } catch (error) {
    console.error('staff_logout_failed', error?.details || error?.message);
  }
  clearStaffSessionCookie(request, response);
  json(response, 200, { signedOut: true });
}
