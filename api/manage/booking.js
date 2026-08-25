import { bearerToken, json, requireMethod } from '../_lib/http.js';
import { rpc } from '../_lib/supabase.js';
import { hashManageToken } from '../_lib/tokens.js';

export default async function handler(request, response) {
  if (!requireMethod(request, response, ['GET'])) return;
  const token = bearerToken(request);
  if (!token || token.length > 100) {
    json(response, 401, { error: 'invalid_or_expired_link' });
    return;
  }
  try {
    const booking = await rpc('get_stay_play_manage_booking', { p_token_hash_hex: hashManageToken(token) });
    if (!booking) {
      json(response, 401, { error: 'invalid_or_expired_link' });
      return;
    }
    json(response, 200, booking);
  } catch (error) {
    console.error('manage_booking_failed', error?.details || error?.message);
    json(response, 503, { error: 'booking_unavailable' });
  }
}
