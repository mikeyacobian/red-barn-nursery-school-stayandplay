import { bodyOf, json, requireMethod } from '../_lib/http.js';
import { isoDate } from '../_lib/params.js';
import { requireStaffSession } from '../_lib/staff-auth.js';
import { rpc } from '../_lib/supabase.js';

export default async function handler(request, response) {
  if (!requireMethod(request, response, ['POST'])) return;
  if (!await requireStaffSession(request, response, { role: 'admin' })) return;
  const body = bodyOf(request);
  const serviceDate = isoDate(body.serviceDate);
  if (!serviceDate || typeof body.bookingEnabled !== 'boolean' || String(body.closureNote || '').length > 160) {
    json(response, 400, { error: 'invalid_day_settings', message: 'Choose a valid program day setting.' });
    return;
  }
  try {
    const result = await rpc('set_stay_play_staff_day', {
      p_service_date: serviceDate,
      p_booking_enabled: body.bookingEnabled,
      p_closure_note: String(body.closureNote || '')
    });
    json(response, 200, result);
  } catch (error) {
    console.error('staff_day_settings_failed', error?.details || error?.message);
    const activeBookings = String(error?.message || '').includes('active bookings');
    json(response, 409, {
      error: 'day_settings_not_saved',
      message: activeBookings
        ? 'This day has active bookings. Contact those families before closing it.'
        : 'The day setting could not be saved.'
    });
  }
}
