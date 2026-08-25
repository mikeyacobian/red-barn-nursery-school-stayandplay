import { json, requireMethod } from '../_lib/http.js';
import { queryParam, dateRange } from '../_lib/params.js';
import { requireStaffSession } from '../_lib/staff-auth.js';
import { rpc } from '../_lib/supabase.js';

export default async function handler(request, response) {
  if (!requireMethod(request, response, ['GET'])) return;
  if (!await requireStaffSession(request, response)) return;
  const range = dateRange(queryParam(request, 'start'), queryParam(request, 'end'));
  if (!range) {
    json(response, 400, { error: 'invalid_date_range', message: 'Choose a valid billing period.' });
    return;
  }
  try {
    const report = await rpc('get_stay_play_staff_billing', {
      p_start_date: range.start,
      p_end_date: range.end
    });
    json(response, 200, report || { periodStart: range.start, periodEnd: range.end, lines: [], families: [] });
  } catch (error) {
    console.error('staff_billing_failed', error?.details || error?.message);
    json(response, 503, { error: 'staff_billing_unavailable', message: 'The billing report is temporarily unavailable.' });
  }
}
