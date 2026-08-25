function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

async function sendEmail(message, idempotencyKey) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('Email is not configured.');
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
      'idempotency-key': idempotencyKey
    },
    body: JSON.stringify({
      from: process.env.STAY_PLAY_FROM_EMAIL || 'Red Barn Stay & Play <onboarding@resend.dev>',
      ...message
    }),
    signal: AbortSignal.timeout(8_000)
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) throw new Error(result?.message || 'Email could not be sent.');
  return result;
}

function emailShell(preview, heading, body) {
  return `<!doctype html><html><body style="margin:0;background:#f5f4f0;color:#111;font-family:Arial,Helvetica,sans-serif"><div style="display:none;max-height:0;overflow:hidden">${escapeHtml(preview)}</div><div style="max-width:560px;margin:0 auto;padding:32px 18px"><div style="background:#e61717;color:#fff;border-radius:50%;width:58px;height:58px;line-height:58px;text-align:center;font-weight:900;margin-bottom:22px">RB</div><div style="background:#fff;border:1px solid #deded9;border-radius:18px;padding:28px"><div style="color:#e61717;font-size:11px;font-weight:900;letter-spacing:.12em">STAY &amp; PLAY</div><h1 style="font-size:26px;line-height:1.15;margin:8px 0 18px">${escapeHtml(heading)}</h1>${body}<p style="margin:24px 0 0;color:#696965;font-size:12px;line-height:1.5">Red Barn Nursery School<br>Stay &amp; Play · Noon–2:00 PM</p></div></div></body></html>`;
}

export function sendManageLinkEmail({ to, parentName, manageUrl, manageLinkId }) {
  const safeName = escapeHtml(parentName || 'there');
  const safeUrl = escapeHtml(manageUrl);
  const body = `<p style="font-size:15px;line-height:1.55">Hi ${safeName},</p><p style="font-size:15px;line-height:1.55">Use the secure button below to review or cancel your Stay &amp; Play reservations. This link expires in 30 minutes.</p><p style="margin:26px 0"><a href="${safeUrl}" style="display:inline-block;background:#e61717;color:#fff;text-decoration:none;font-weight:800;padding:13px 20px;border-radius:999px">Manage my booking</a></p><p style="color:#696965;font-size:12px;line-height:1.5">If you did not request this link, you can ignore this email.</p>`;
  return sendEmail({
    to,
    subject: 'Manage your Red Barn Stay & Play booking',
    html: emailShell('Your secure Stay & Play management link', 'Manage your booking', body)
  }, `manage-link-${manageLinkId}`);
}

export function sendBookingConfirmationEmail({ to, parentName, confirmationCode, manageUrl, bookingId }) {
  const safeName = escapeHtml(parentName || 'there');
  const safeUrl = escapeHtml(manageUrl);
  const body = `<p style="font-size:15px;line-height:1.55">Hi ${safeName},</p><p style="font-size:15px;line-height:1.55">Your Stay &amp; Play reservation is confirmed. Your confirmation code is <strong>${escapeHtml(confirmationCode)}</strong>.</p><p style="margin:26px 0"><a href="${safeUrl}" style="display:inline-block;background:#e61717;color:#fff;text-decoration:none;font-weight:800;padding:13px 20px;border-radius:999px">Review or cancel booking</a></p><p style="color:#696965;font-size:12px;line-height:1.5">Cancel by noon the day before to avoid being billed. The secure management link expires in 30 minutes; you can request a fresh one at any time.</p>`;
  return sendEmail({
    to,
    subject: `Stay & Play confirmed · ${confirmationCode}`,
    html: emailShell('Your Stay & Play reservation is confirmed', 'Reservation confirmed', body)
  }, `booking-confirmation-${bookingId}`);
}

export function sendCancellationEmail({ to, parentName, childName, serviceDate, billable, bookingItemId }) {
  const body = `<p style="font-size:15px;line-height:1.55">Hi ${escapeHtml(parentName || 'there')},</p><p style="font-size:15px;line-height:1.55">${escapeHtml(childName)} has been removed from Stay &amp; Play on <strong>${escapeHtml(serviceDate)}</strong>.</p><p style="font-size:15px;line-height:1.55"><strong>${billable ? 'Because this was after the cancellation deadline, the scheduled daily rate will still be billed.' : 'This cancellation was received before the deadline and will not be billed.'}</strong></p>`;
  return sendEmail({
    to,
    subject: `Stay & Play cancellation · ${serviceDate}`,
    html: emailShell('Your Stay & Play cancellation', 'Cancellation recorded', body)
  }, `booking-cancellation-${bookingItemId}`);
}
