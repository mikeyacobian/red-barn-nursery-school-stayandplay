import { expect, test } from '@playwright/test';

const openDay = (serviceDate, sessionName = 'Session 1') => ({
  program_day_id: Number(serviceDate.replaceAll('-', '')),
  session_id: 1,
  session_name: sessionName,
  service_date: serviceDate,
  start_time: '12:00:00',
  end_time: '14:00:00',
  capacity: 14,
  booked_count: 0,
  open_count: 14,
  booking_enabled: true,
  closure_note: null,
  booking_deadline: '2026-09-13T16:00:00Z',
  cancellation_deadline: '2026-09-13T16:00:00Z',
  single_child_rate_cents: 5000,
  sibling_rate_cents: 7500
});

const availability = {
  days: [openDay('2026-09-14'), openDay('2026-10-01')]
};

test.beforeEach(async ({ page }) => {
  await page.route('**/api/availability', route => route.fulfill({ json: availability }));
});

test('parent can assign siblings, navigate months, and dismiss review with Escape', async ({ page }) => {
  await page.goto('/parent.html');

  await expect(page.getByText('Live availability')).toBeVisible();
  await expect(page.locator('iframe')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Manage booking' })).toHaveAttribute('href', '/manage.html');
  await expect(page.getByRole('link', { name: /Programs|About Us|Admissions/ })).toHaveCount(0);

  await page.getByRole('button', { name: 'Next month' }).click();
  await expect(page.locator('#rb-month-label')).toHaveText('October 2026');
  await page.getByRole('button', { name: 'Previous month' }).click();
  await expect(page.locator('#rb-month-label')).toHaveText('September 2026');

  await page.getByLabel('Parent or guardian name').fill('Jordan QA');
  await page.getByLabel('Email').fill('stay-play-qa-parent@example.com');
  await page.getByLabel('Child 1 full name').fill('Ava QA');
  await expect(page.locator('#rb-child-count')).toHaveText('1');
  await page.getByRole('button', { name: 'Add another child' }).click();
  await page.getByLabel('Child 2 full name').fill('Leo QA');
  await expect(page.locator('#rb-child-count')).toHaveText('2');
  await expect(page.getByRole('button', { name: 'Everyone (2)' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ava' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Leo' })).toBeVisible();

  await page.locator('[data-date="2026-09-14"]').click();
  await expect(page.locator('#rb-summary-line')).toHaveText('2 child-spots across 1 date');
  await expect(page.locator('#rb-summary-price')).toHaveText('$75 added to your school bill');
  await expect(page.locator('[data-date="2026-09-14"]')).toHaveAttribute('aria-label', /selected for Ava QA and Leo QA/);

  const review = page.getByRole('button', { name: 'Review booking' });
  await review.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.locator('#rb-review-total')).toHaveText('$75');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(review).toBeFocused();
});

test('availability outage fails closed without invented capacity', async ({ page }) => {
  await page.unroute('**/api/availability');
  await page.route('**/api/availability', route => route.fulfill({ status: 503, json: { error: 'unavailable' } }));
  await page.goto('/parent.html');

  await expect(page.getByText('Availability unavailable', { exact: true }).first()).toBeVisible();
  await expect(page.locator('[data-date="2026-09-14"]')).toBeDisabled();
  await expect(page.locator('[data-date="2026-09-14"] .rb-mini-map i')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Next month' })).toBeDisabled();
});

test('parent remains light and reflows at 320 pixels even with dark system preference', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/parent.html');

  const metrics = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    background: getComputedStyle(document.body).backgroundColor,
    colorScheme: getComputedStyle(document.documentElement).colorScheme
  }));
  expect(metrics.scrollWidth).toBe(metrics.clientWidth);
  expect(metrics.background).toBe('rgb(255, 255, 255)');
  expect(metrics.colorScheme).toBe('light');
});
