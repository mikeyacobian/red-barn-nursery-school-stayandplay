import { json, requireMethod, bodyOf, publicError } from './_lib/http.js';
import { rpc } from './_lib/supabase.js';
import { appUrl, hashManageToken, newManageToken } from './_lib/tokens.js';
import { sendBookingConfirmationEmail } from './_lib/email.js';

export default async function handler(request, response) {
  if (!requireMethod(request, response, ['POST'])) return;
  const body = bodyOf(request);
  try {
    const result = await rpc('create_stay_play_booking', {
      p_parent_name: body.parentName,
      p_email: body.email,
      p_children: body.children,
      p_selections: body.selections
    });

    let emailSent = false;
    try {
      const token = newManageToken();
      const link = await rpc('issue_stay_play_manage_link', {
        p_email: body.email,
        p_token_hash_hex: hashManageToken(token),
        p_expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString()
      });
      if (link?.send) {
        await sendBookingConfirmationEmail({
          to: link.email,
          parentName: link.parentName,
          confirmationCode: result.confirmationCode,
          bookingId: result.bookingId,
          manageUrl: `${appUrl(request)}/manage.html#token=${encodeURIComponent(token)}`
        });
        emailSent = true;
      }
    } catch (emailError) {
      console.error('booking_confirmation_email_failed', emailError?.message);
    }

    json(response, 201, { ...result, emailSent });
  } catch (error) {
    console.error('booking_failed', error?.details || error?.message);
    const message = publicError(error);
    json(response, /spots|already booked|not open/.test(message) ? 409 : 400, { error: 'booking_failed', message });
  }
}
