import { json } from './_lib/http.js';
import billingStatus from '../server/staff/billing-status.js';
import billing from '../server/staff/billing.js';
import daySettings from '../server/staff/day-settings.js';
import logout from '../server/staff/logout.js';
import redeem from '../server/staff/redeem.js';
import requestLink from '../server/staff/request-link.js';
import roster from '../server/staff/roster.js';
import schedule from '../server/staff/schedule.js';
import session from '../server/staff/session.js';

const handlers = new Map([
  ['billing-status', billingStatus],
  ['billing', billing],
  ['day-settings', daySettings],
  ['logout', logout],
  ['redeem', redeem],
  ['request-link', requestLink],
  ['roster', roster],
  ['schedule', schedule],
  ['session', session]
]);

export default function handler(request, response) {
  const action = String(request.query?.action || new URL(request.url || '/', 'http://localhost').searchParams.get('action') || '');
  const actionHandler = handlers.get(action);
  if (!actionHandler) {
    json(response, 404, { error: 'not_found' });
    return;
  }
  return actionHandler(request, response);
}
