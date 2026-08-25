import { bearerToken, bodyOf, json, publicError, requireMethod } from '../_lib/http.js';
import { rpc } from '../_lib/supabase.js';
import { hashManageToken } from '../_lib/tokens.js';
import { sendCancellationEmail } from '../_lib/email.js';

export default async function handler(request, response) {
  if (!requireMethod(request, response, ['POST'])) return;
  const token = bearerToken(request);
  const bookingItemId = Number(bodyOf(request).bookingItemId);
  if (!token || token.length > 100 || !Number.isSafeInteger(bookingItemId) || bookingItemId < 1) {
    json(response, 400, { error: 'invalid_request' });
    return;
  }
  try {
    const result = await rpc('cancel_stay_play_item', {
      p_token_hash_hex: hashManageToken(token),
      p_booking_item_id: bookingItemId
    });

    let emailSent = false;
    try {
      const booking = await rpc('get_stay_play_manage_booking', { p_token_hash_hex: hashManageToken(token) });
      if (booking?.family?.email) {
        await sendCancellationEmail({
          to: booking.family.email,
          parentName: booking.family.parentName,
          childName: result.childName,
          serviceDate: result.serviceDate,
          billable: result.billable,
          bookingItemId: result.bookingItemId
        });
        emailSent = true;
      }
    } catch (emailError) {
      console.error('cancellation_email_failed', emailError?.message);
    }

    json(response, 200, { ...result, emailSent });
  } catch (error) {
    console.error('cancellation_failed', error?.details || error?.message);
    const message = publicError(error);
    json(response, message.includes('invalid or expired') ? 401 : 400, { error: 'cancellation_failed', message });
  }
}
