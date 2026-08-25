function config() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secretKey) throw new Error('Supabase is not configured.');
  return { url, secretKey };
}

export async function rpc(functionName, input = {}) {
  const { url, secretKey } = config();
  const response = await fetch(`${url}/rest/v1/rpc/${functionName}`, {
    method: 'POST',
    headers: {
      apikey: secretKey,
      authorization: `Bearer ${secretKey}`,
      'content-type': 'application/json',
      accept: 'application/json'
    },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(8_000)
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(data?.message || `Supabase request failed (${response.status}).`);
    error.status = response.status;
    error.details = data;
    throw error;
  }
  return data;
}
