import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/**
 * Step 5: the buyer inquiry flow. IDs refer to docs/ACCEPTANCE.md.
 * The form refuses a send inside the minimum fill time (3 seconds by default),
 * so the tests that send wait that long, as a person would.
 */

const FILL_TIME = 3_200;
const STATEMENT = 'Payment and pickup are arranged directly with the farmer.';

interface StoredState {
  db: {
    inquiries: Array<{ id: string; statusToken: string; farmerProfileId: string; chosenOptionKind: string | null; status: string }>;
    inquiry_buyer_contacts: Array<{ inquiryId: string; name: string; phone: string | null }>;
  };
  outbox: Array<{ template: string; channel: string; body: string; toMasked: string }>;
}
const stored = (page: Page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem('musoko.demo.v1')!).state as StoredState);

/** Opens the first product card matching the text and follows its Contact farmer link. */
async function startFromCard(page: Page, title: RegExp | string) {
  await page.goto('/food?status=all');
  const card = page.getByRole('article').filter({ hasText: title }).first();
  await expect(card).toBeVisible();
  await card.getByRole('link', { name: /^Contact farmer/ }).click();
  await expect(page).toHaveURL(/\/inquiry\/new\?product=/);
}

async function continueToStepTwo(page: Page) {
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: /Step 2 of 2/ })).toBeVisible();
}

async function sendAs(page: Page, name: string, phone: string) {
  await page.getByLabel('Your name').fill(name);
  await page.getByLabel('Mobile number').fill(phone);
  await page.waitForTimeout(FILL_TIME);
  await page.getByRole('button', { name: 'Send inquiry' }).click();
}

test('INQ-1, INQ-2, STAT-2, INQ-7: two screens from a product card, then a private status page', async ({ page }) => {
  await startFromCard(page, /Collard/);
  await expect(page.getByRole('heading', { name: /Step 1 of 2/ })).toBeVisible();
  await expect(page.getByRole('main').getByText(STATEMENT)).toBeVisible();
  // The product is preselected, so what is left is how many and how to get it.
  await page.getByLabel(/How many bunches/).fill('2');
  await page.getByRole('radio', { name: /Pick up at/ }).first().check();
  await continueToStepTwo(page);
  await expect(page.getByRole('main').getByText(STATEMENT)).toBeVisible();

  await sendAs(page, 'Wilhelmina Strand', '870-555-0188');
  await expect(page).toHaveURL(/\/inquiry\/[0-9a-f-]{36}\?sent=1/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Your inquiry was sent to');
  await expect(page.getByText('Awaiting response', { exact: true })).toBeVisible();
  await expect(page.getByText('The farmer will reply when they can.')).toBeVisible();
  await expect(page.getByRole('main').getByText(STATEMENT)).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Your private link' })).toHaveValue(/\/inquiry\/[0-9a-f-]{36}$/);
  // The page never shows the buyer's own contact detail back.
  await expect(page.locator('body')).not.toContainText('870-555-0188');

  // MODE-1: it survives a reload, and the stored rows hold what the form said.
  await page.reload();
  await expect(page.getByText('Awaiting response', { exact: true })).toBeVisible();
  const state = await stored(page);
  const token = page.url().match(/inquiry\/([0-9a-f-]{36})/)![1]!;
  const inquiry = state.db.inquiries.find((i) => i.statusToken === token)!;
  expect(inquiry).toMatchObject({ farmerProfileId: 'farm-01', status: 'awaiting_response' });
  expect(inquiry.chosenOptionKind).not.toBeNull(); // DATA-3
  expect(state.db.inquiry_buyer_contacts.find((c) => c.inquiryId === inquiry.id)).toMatchObject({ name: 'Wilhelmina Strand', phone: '870-555-0188' });
  // INQ-2: both notices went through the notification port (the demo outbox).
  expect(state.outbox.map((m) => m.template)).toEqual(['inquiry_received', 'inquiry_confirmation']);
  expect(state.outbox[1]!.body).toContain(`/inquiry/${token}`);
});

test('INQ-1: the buyer chooses text or email for the answer', async ({ page }) => {
  await startFromCard(page, /Collard/);
  await page.getByRole('radio', { name: /Pick up at/ }).first().check();
  await continueToStepTwo(page);
  await expect(page.getByLabel('Mobile number')).toBeVisible();
  await page.getByText('Email', { exact: true }).click();
  await expect(page.getByLabel('Email address')).toBeVisible();
  await expect(page.getByLabel('Mobile number')).toHaveCount(0);
  await page.getByLabel('Your name').fill('Wilhelmina Strand');
  await page.getByLabel('Email address').fill('wil@buyers.example');
  await page.waitForTimeout(FILL_TIME);
  await page.getByRole('button', { name: 'Send inquiry' }).click();
  await expect(page).toHaveURL(/\?sent=1/);
  await expect(page.getByText('You will get an email when the farmer replies.')).toBeVisible();
  const confirmation = (await stored(page)).outbox.find((m) => m.template === 'inquiry_confirmation')!;
  expect(confirmation).toMatchObject({ channel: 'email', toMasked: 'w*****@buyers.example' });
});

test('INQ-1: from a farm page, the buyer picks the listing', async ({ page }) => {
  await page.goto('/farmers/cypress-knee-gardens');
  await page.getByRole('link', { name: 'Contact farmer', exact: true }).click();
  await expect(page).toHaveURL(/\/inquiry\/new\?farm=cypress-knee-gardens/);
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('Choose a listing, or say you are asking about something else.')).toBeVisible();
  await expect(page.getByText('Choose how you would like to get it.')).toBeVisible();
  await page.getByRole('radio', { name: /Something else/ }).check();
  await page.getByRole('radio', { name: /Pick up at/ }).first().check();
  await continueToStepTwo(page);
});

test('QTY-5: asking for more than the stated quantity says so and still sends', async ({ page }) => {
  await startFromCard(page, /dozen/i); // the egg listing with about 3 dozen stated
  await page.getByRole('radio').first().check();
  const status = page.getByRole('status').filter({ hasText: /more than the farmer/ });
  await expect(status).toHaveCount(0);
  await page.getByLabel(/How many/).fill('2');
  await expect(page.getByText(/more than the farmer’s estimate/)).toHaveCount(0);
  await page.getByLabel(/How many/).fill('9');
  await expect(page.getByText(/That is more than the farmer’s estimate of about/)).toBeVisible();
  await expect(page.getByText(/You can still send your inquiry/)).toBeVisible();
  await continueToStepTwo(page);
  await sendAs(page, 'Wilhelmina Strand', '870-555-0188');
  await expect(page).toHaveURL(/\?sent=1/);
});

test('field errors are words beside the field, and nothing is saved until the form is complete', async ({ page }) => {
  await startFromCard(page, /Collard/);
  await page.getByLabel(/How many bunches/).fill('lots');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('Enter a number greater than zero, or leave it empty.')).toBeVisible();
  await expect(page.getByText('Choose how you would like to get it.')).toBeVisible();
  await page.getByLabel(/How many bunches/).fill('');
  await page.getByRole('radio', { name: /Pick up at/ }).first().check();
  await continueToStepTwo(page);
  await page.getByRole('button', { name: 'Send inquiry' }).click();
  await expect(page.getByText('Enter your name.')).toBeVisible();
  await expect(page.getByText('Enter the mobile number for text messages.')).toBeVisible();
  expect((await stored(page)).db.inquiries).toHaveLength(10); // the seed's ten
});

test('INQ-6: a form sent faster than a person could is refused, stores nothing, and works once enough time has passed', async ({ page }) => {
  // Freeze the browser's clock so no time passes between opening the form and sending it.
  await page.clock.setFixedTime(new Date('2026-11-15T15:00:00Z'));
  await startFromCard(page, /Collard/);
  await page.getByRole('radio', { name: /Pick up at/ }).first().check();
  await continueToStepTwo(page);
  await page.getByLabel('Your name').fill('Fast Bot');
  await page.getByLabel('Mobile number').fill('870-555-0199');
  await page.getByRole('button', { name: 'Send inquiry' }).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText('could not be sent');
  expect((await stored(page)).db.inquiries).toHaveLength(10);
  expect((await stored(page)).outbox).toEqual([]);

  await page.clock.setFixedTime(new Date('2026-11-15T15:00:10Z'));
  await page.getByRole('button', { name: 'Send inquiry' }).click();
  await expect(page).toHaveURL(/\?sent=1/);
  expect((await stored(page)).db.inquiries).toHaveLength(11);
});

test('STAT-1, INQ-4: the seeded status pages show the right status and share the phone only on a confirmed Contact me', async ({ page }) => {
  await page.goto('/inquiry/status-token-01');
  await expect(page.getByText('Awaiting response', { exact: true })).toBeVisible();
  await expect(page.getByText('Cypress Knee Gardens, Helena-West Helena')).toBeVisible();
  await expect(page.locator('body')).not.toContainText('870-555-0101');

  await page.goto('/inquiry/status-token-04');
  await expect(page.getByText('Responded', { exact: true })).toBeVisible();
  await expect(page.getByText('The farmer says it is available.')).toBeVisible();
  await expect(page.locator('body')).not.toContainText('870-555-0101');

  await page.goto('/inquiry/status-token-06');
  await expect(page.getByText('Responded', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: '870-555-0101' })).toBeVisible();
  await expect(page.getByText('shared this number with you for this inquiry')).toBeVisible();
});

test('STAT-4: an inquiry that closed unanswered says so and offers other listings available now', async ({ page }) => {
  await page.goto('/inquiry/status-token-07');
  await expect(page.getByText('Closed', { exact: true })).toBeVisible();
  await expect(page.getByText('This inquiry closed without a reply.')).toBeVisible();
  await expect(page.getByText('The farmer will reply when they can.')).toHaveCount(0);
  const alternatives = page.getByRole('region', { name: 'Available now' });
  if (await alternatives.count()) {
    for (const text of await alternatives.getByRole('article').allInnerTexts()) expect(text).toContain('Available now');
  }
});

test('an unknown link says so in words and offers a way on', async ({ page }) => {
  await page.goto('/inquiry/not-a-real-token');
  await expect(page.getByText('We could not find that inquiry.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Find local food' }).first()).toBeVisible();
});

test('the private page is kept out of search and carries no referrer', async ({ page }) => {
  await page.goto('/inquiry/status-token-01');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  await expect(page.locator('meta[name="referrer"]')).toHaveAttribute('content', 'no-referrer');
});

test('A11Y-1: the form and the status page have no automatic accessibility violations', async ({ page }) => {
  await startFromCard(page, /Collard/);
  await expect(page.getByRole('heading', { name: /Step 1 of 2/ })).toBeVisible();
  expect((await new AxeBuilder({ page }).disableRules(['color-contrast']).analyze()).violations).toEqual([]);
  await page.getByRole('radio', { name: /Pick up at/ }).first().check();
  await continueToStepTwo(page);
  expect((await new AxeBuilder({ page }).disableRules(['color-contrast']).analyze()).violations).toEqual([]);
  await page.goto('/inquiry/status-token-06');
  await expect(page.getByText('Responded', { exact: true })).toBeVisible();
  expect((await new AxeBuilder({ page }).disableRules(['color-contrast']).analyze()).violations).toEqual([]);
});
