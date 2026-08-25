import { json, requireMethod } from '../_lib/http.js';
import { queryParam, isoDate } from '../_lib/params.js';
import { requireStaffSession } from '../_lib/staff-auth.js';
import { rpc } from '../_lib/supabase.js';

export default async function handler(request, response) {
  if (!requireMethod(request, response, ['GET'])) return;
  if (!await requireStaffSession(request, response)) return;
  const date = isoDate(queryParam(request, 'date'));
  if (!date) {
    json(response, 400, { error: 'invalid_date', message: 'Choose a valid roster date.' });
    return;
  }
  try {
    const roster = await rpc('get_stay_play_staff_roster', { p_service_date: date });
    json(response, 200, { serviceDate: date, roster: Array.isArray(roster) ? roster : [] });
  } catch (error) {
    console.error('staff_roster_failed', error?.details || error?.message);
    json(response, 503, { error: 'staff_roster_unavailable', message: 'The roster is temporarily unavailable.' });
  }
}
