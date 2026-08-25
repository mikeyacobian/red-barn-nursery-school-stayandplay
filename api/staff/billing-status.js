import { bodyOf, json, requireMethod } from '../_lib/http.js';
import { dateRange } from '../_lib/params.js';
import { requireStaffSession } from '../_lib/staff-auth.js';
import { rpc } from '../_lib/supabase.js';

const statuses = new Set(['ready', 'sent', 'paid', 'waived']);

export default async function handler(request, response) {
  if (!requireMethod(request, response, ['POST'])) return;
  if (!await requireStaffSession(request, response)) return;
  const body = bodyOf(request);
  const range = dateRange(body.periodStart, body.periodEnd);
  const familyId = Number(body.familyId);
  const status = String(body.status || '').toLowerCase();
  if (!range || !Number.isSafeInteger(familyId) || familyId < 1 || !statuses.has(status)) {
    json(response, 400, { error: 'invalid_billing_status', message: 'Choose a valid family, period, and billing status.' });
    return;
  }
  try {
    const result = await rpc('set_stay_play_staff_billing_status', {
      p_period_start: range.start,
      p_period_end: range.end,
      p_family_id: familyId,
      p_status: status
    });
    json(response, 200, result);
  } catch (error) {
    console.error('staff_billing_status_failed', error?.details || error?.message);
    json(response, 409, { error: 'billing_status_not_saved', message: 'The billing status could not be saved.' });
  }
}
