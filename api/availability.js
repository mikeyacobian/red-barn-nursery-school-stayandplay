import { json, requireMethod } from './_lib/http.js';
import { rpc } from './_lib/supabase.js';

export default async function handler(request, response) {
  if (!requireMethod(request, response, ['GET'])) return;
  try {
    const days = await rpc('stay_play_availability');
    json(response, 200, { days });
  } catch (error) {
    console.error('availability_failed', error?.details || error?.message);
    json(response, 503, { error: 'availability_unavailable' });
  }
}
