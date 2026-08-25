import { json, requireMethod, bodyOf } from '../_lib/http.js';
import { sendStaffLoginEmail } from '../_lib/email.js';
import { rpc } from '../_lib/supabase.js';
import { appUrl, hashSecureToken, newSecureToken } from '../_lib/tokens.js';

const genericMessage = 'If that email is authorized for staff access, a secure link is on its way.';

export default async function handler(request, response) {
  if (!requireMethod(request, response, ['POST'])) return;
  const email = String(bodyOf(request).email || '').trim().toLowerCase();
  if (email.length > 320 || !email.includes('@')) {
    json(response, 200, { message: genericMessage });
    return;
  }

  try {
    const token = newSecureToken();
    const link = await rpc('issue_stay_play_staff_link', {
      p_email: email,
      p_token_hash_hex: hashSecureToken(token),
      p_expires_at: new Date(Date.now() + 20 * 60 * 1000).toISOString()
    });
    if (link?.send) {
      await sendStaffLoginEmail({
        to: link.email,
        displayName: link.displayName,
        staffLinkId: link.staffLinkId,
        staffUrl: `${appUrl(request)}/staff.html#staff-token=${encodeURIComponent(token)}`
      });
    }
  } catch (error) {
    console.error('staff_link_failed', error?.details || error?.message);
  }

  json(response, 200, { message: genericMessage });
}
