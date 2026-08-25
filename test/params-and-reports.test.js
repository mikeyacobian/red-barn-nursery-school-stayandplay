import test from 'node:test';
import assert from 'node:assert/strict';

import { dateRange, isoDate } from '../api/_lib/params.js';
import { bookingConfirmationDetailsHtml, senderAddress } from '../api/_lib/email.js';
import { appUrl } from '../api/_lib/tokens.js';
import { csvCell, csvDocument, money } from '../staff-dashboard.js';

test('ISO dates and bounded ranges reject malformed or oversized input', () => {
  assert.equal(isoDate('2026-09-14'), '2026-09-14');
  assert.equal(isoDate('2026-02-30'), '');
  assert.equal(isoDate('09/14/2026'), '');
  assert.deepEqual(dateRange('2026-09-14', '2026-12-18'), { start: '2026-09-14', end: '2026-12-18' });
  assert.equal(dateRange('2026-12-18', '2026-09-14'), null);
  assert.equal(dateRange('2026-01-01', '2028-01-01'), null);
});

test('CSV export quotes fields and neutralizes spreadsheet formulas', () => {
  assert.equal(csvCell('Jordan, Miller'), '"Jordan, Miller"');
  assert.equal(csvCell('=HYPERLINK("bad")'), '"\'=HYPERLINK(""bad"")"');
  const csv = csvDocument(
    [{ key: 'family', label: 'Family' }, { key: 'total', label: 'Total' }],
    [{ family: '+Formula Family', total: '$75' }]
  );
  assert.match(csv, /^\uFEFF"Family","Total"/);
  assert.match(csv, /"'\+Formula Family","\$75"/);
});

test('booking confirmation details include escaped children, rates, dates, and authoritative total', () => {
  const html = bookingConfirmationDetailsHtml([
    {
      serviceDate: '2026-09-14',
      children: ['Ava <Miller>', 'Leo Miller'],
      selectedChildCount: 2,
      familyChildCount: 2,
      familyDayRateCents: 7500
    }
  ], 7500);
  assert.match(html, /Monday, September 14/);
  assert.match(html, /Ava &lt;Miller&gt;, Leo Miller/);
  assert.match(html, /Rate #2/);
  assert.match(html, /\$75\.00/);
  assert.doesNotMatch(html, /Ava <Miller>/);
  assert.equal(money(5000), '$50.00');
});

test('email sender uses a configured address or a validated Resend domain', t => {
  const prior = {
    STAY_PLAY_FROM_EMAIL: process.env.STAY_PLAY_FROM_EMAIL,
    RESEND_EMAIL_DOMAIN: process.env.RESEND_EMAIL_DOMAIN
  };
  t.after(() => {
    for (const [key, value] of Object.entries(prior)) {
      if (value == null) delete process.env[key];
      else process.env[key] = value;
    }
  });

  process.env.STAY_PLAY_FROM_EMAIL = '';
  process.env.RESEND_EMAIL_DOMAIN = 'mail.redbarn.example';
  assert.equal(senderAddress(), 'Red Barn Stay & Play <stay-and-play@mail.redbarn.example>');
  process.env.STAY_PLAY_FROM_EMAIL = 'Red Barn School <office@redbarn.example>';
  assert.equal(senderAddress(), 'Red Barn School <office@redbarn.example>');
});

test('application links prefer configured Vercel hosts and reject hostile Host headers', t => {
  const prior = {
    PUBLIC_APP_URL: process.env.PUBLIC_APP_URL,
    VERCEL_PROJECT_PRODUCTION_URL: process.env.VERCEL_PROJECT_PRODUCTION_URL,
    VERCEL_URL: process.env.VERCEL_URL
  };
  t.after(() => {
    for (const [key, value] of Object.entries(prior)) {
      if (value == null) delete process.env[key];
      else process.env[key] = value;
    }
  });

  process.env.PUBLIC_APP_URL = '';
  process.env.VERCEL_URL = '';
  process.env.VERCEL_PROJECT_PRODUCTION_URL = 'red-barn.example.org';
  assert.equal(appUrl({ headers: { host: 'hostile.example' } }), 'https://red-barn.example.org');
  delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
  assert.equal(appUrl({ headers: { host: 'localhost:3000' } }), 'http://localhost:3000');
  assert.throws(() => appUrl({ headers: { host: 'good.example\r\nbcc:evil@example.com' } }), /not configured/);
});
