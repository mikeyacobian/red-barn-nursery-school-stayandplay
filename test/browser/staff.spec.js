import { expect, test } from '@playwright/test';

test('unauthenticated staff is redirected before dashboard data is shown', async ({ page }) => {
  await page.route('**/api/staff/session', route => route.fulfill({ status: 401, json: { authenticated: false } }));
  await page.goto('/staff.html');
  await page.waitForURL('**/staff-login.html');
  await expect(page.getByRole('heading', { name: 'Staff login' })).toBeVisible();
  await expect(page.getByText('Billing report')).toHaveCount(0);
});

test('test@test.com opens a sample-only demo without calling protected staff data APIs', async ({ page }) => {
  let protectedDataCalls = 0;
  page.on('request', request => {
    const pathname = new URL(request.url()).pathname;
    if (pathname.startsWith('/api/staff/') && pathname !== '/api/staff/session') protectedDataCalls += 1;
  });
  await page.route('**/api/staff/session', route => route.fulfill({ status: 401, json: { authenticated: false } }));

  await page.goto('/staff-login.html');
  await page.getByLabel('Staff email').fill('test@test.com');
  await page.getByRole('button', { name: 'Email me a secure link' }).click();

  await page.waitForURL('**/staff-demo.html');
  await expect(page.getByText('Demo preview', { exact: true })).toBeVisible();
  await expect(page.getByText(/Sample data only/)).toBeVisible();
  await expect(page.locator('#rb-staff-profile')).toHaveText('DE');
  await expect(page.getByText('Ava Example', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Billing' }).click();
  await expect(page.locator('#rb-families-body').getByText('Jordan Example', { exact: true })).toBeVisible();
  await expect(page.locator('#rb-families-body').getByText('$75.00')).toBeVisible();
  expect(protectedDataCalls).toBe(0);
});

test('authorized staff sees live schedule, billing, and a real CSV download', async ({ page }) => {
  let statusRequest = null;
  await page.route('**/api/staff/session', route => route.fulfill({ json: { authenticated: true, staff: { displayName: 'Morgan Staff', role: 'admin' } } }));
  await page.route('**/api/staff/schedule?*', route => route.fulfill({ json: {
    days: [{
      programDayId: 1,
      serviceDate: '2026-09-14',
      sessionName: 'Session 1',
      startTime: '12:00:00',
      endTime: '14:00:00',
      capacity: 14,
      bookedCount: 1,
      openCount: 13,
      bookingEnabled: true,
      closureNote: null
    }]
  } }));
  await page.route('**/api/staff/roster?*', route => route.fulfill({ json: {
    roster: [{ childName: 'Ava QA', parentName: 'Jordan QA', email: 'stay-play-qa-staff@example.com', confirmationCode: 'RBQA1234' }]
  } }));
  await page.route('**/api/staff/billing?*', route => route.fulfill({ json: {
    periodStart: '2026-09-14',
    periodEnd: '2026-09-30',
    lines: [{ familyId: 7, parentName: 'Jordan QA', email: 'stay-play-qa-staff@example.com', serviceDate: '2026-09-14', childCount: 2, children: 'Ava QA, Leo QA', rateNumber: 2, rateCents: 7500, status: 'ready' }],
    families: [{ familyId: 7, parentName: 'Jordan QA', email: 'stay-play-qa-staff@example.com', billableDays: 1, childSpots: 2, singleRateDays: 0, siblingRateDays: 1, totalCents: 7500, status: 'ready' }],
    totalCents: 7500,
    familyCount: 1,
    childSpots: 2
  } }));
  await page.route('**/api/staff/billing-status', async route => {
    statusRequest = route.request().postDataJSON();
    await route.fulfill({ json: { saved: true } });
  });

  await page.goto('/staff.html');
  await expect(page.locator('#rb-staff-profile')).toHaveText('MS');
  await expect(page.locator('#rb-booked-count')).toHaveText('1 of 14');
  await expect(page.getByText('Ava QA', { exact: true })).toBeVisible();
  await expect(page.getByText('stay-play-qa-staff@example.com')).toBeVisible();

  await page.getByRole('button', { name: 'Billing' }).click();
  await expect(page.getByText('$75.00').first()).toBeVisible();
  await expect(page.getByText('1 × #2')).toBeVisible();
  await page.getByLabel('Jordan QA billing status').selectOption('sent');
  await expect.poll(() => statusRequest?.status).toBe('sent');

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download CSV' }).click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  let csv = '';
  for await (const chunk of stream) csv += chunk.toString('utf8');
  expect(download.suggestedFilename()).toBe('stay-and-play-families-2026-09-14-to-2026-09-30.csv');
  expect(csv).toContain('"Jordan QA"');
  expect(csv).toContain('"$75.00"');
  expect(csv).toContain('"sent"');
});
