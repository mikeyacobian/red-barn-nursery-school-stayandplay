export function queryParam(request, name) {
  const direct = request.query?.[name];
  if (Array.isArray(direct)) return String(direct[0] || '');
  if (direct != null) return String(direct);
  try {
    return new URL(request.url || '/', 'http://localhost').searchParams.get(name) || '';
  } catch {
    return '';
  }
}

export function isoDate(value) {
  const text = String(value || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return '';
  const date = new Date(`${text}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === text ? text : '';
}

export function dateRange(startValue, endValue, maxDays = 370) {
  const start = isoDate(startValue);
  const end = isoDate(endValue);
  if (!start || !end || end < start) return null;
  const days = (Date.parse(`${end}T12:00:00Z`) - Date.parse(`${start}T12:00:00Z`)) / 86_400_000;
  return days <= maxDays ? { start, end } : null;
}
