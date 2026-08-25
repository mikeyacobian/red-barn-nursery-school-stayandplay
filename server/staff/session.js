import { json, requireMethod } from '../../api/_lib/http.js';
import { clearStaffSessionCookie, getStaffSession, publicStaff } from '../../api/_lib/staff-auth.js';

export default async function handler(request, response) {
  if (!requireMethod(request, response, ['GET'])) return;
  try {
    const staff = await getStaffSession(request);
    if (!staff?.authenticated) {
      clearStaffSessionCookie(request, response);
      json(response, 401, { authenticated: false });
      return;
    }
    json(response, 200, { authenticated: true, staff: publicStaff(staff) });
  } catch (error) {
    console.error('staff_session_failed', error?.details || error?.message);
    clearStaffSessionCookie(request, response);
    json(response, 401, { authenticated: false });
  }
}
