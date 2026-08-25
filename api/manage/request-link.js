import { json, requireMethod, bodyOf } from '../_lib/http.js';
import { rpc } from '../_lib/supabase.js';
import { appUrl, hashManageToken, newManageToken } from '../_lib/tokens.js';
import { sendManageLinkEmail } from '../_lib/email.js';

const genericMessage = 'If that email matches a family with active bookings, a secure link is on its way.';

export default async function handler(request, response) {
  if (!requireMethod(request, response, ['POST'])) return;
  const email = String(bodyOf(request).email || '').trim().toLowerCase();
  if (email.length > 320 || !email.includes('@')) {
    json(response, 200, { message: genericMessage });
    return;
  }

  try {
    const token = newManageToken();
    const link = await rpc('issue_stay_play_manage_link', {
      p_email: email,
      p_token_hash_hex: hashManageToken(token),
      p_expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString()
    });
    if (link?.send) {
      await sendManageLinkEmail({
        to: link.email,
        parentName: link.parentName,
        manageLinkId: link.manageLinkId,
        manageUrl: `${appUrl(request)}/manage.html#token=${encodeURIComponent(token)}`
      });
    }
    json(response, 200, { message: genericMessage });
  } catch (error) {
    console.error('manage_link_failed', error?.details || error?.message);
    json(response, 503, { error: 'email_unavailable', message: 'Email is temporarily unavailable. Please try again shortly.' });
  }
}
