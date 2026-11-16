import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/**
 * Step 7: the administrator dashboard. IDs refer to docs/ACCEPTANCE.md.
 * Below 1200px the role switcher sits in the "Demo settings" sheet, so the
 * helpers open it first when the button is there.
 */

interface Stored {
  db: {
    farmer_profiles: Array<Record<string, unknown> & { id: string; slug: string }>;
    farmer_private_contacts: Array<{ farmerProfileId: string; phone: string | null }>;
    claims: Array<{ id: string; status: string; verification: { evidenceChecked: string; verifiedOn: string; verifiedBy: string } | null }>;
    products: Array<{ id: string; title: string; moderationStatus: string }>;
    search_events: unknown[];
    aggregate_counts: Array<{ metric: string; count: number }>;
    settings: { searchEventRetentionDays: number; minimumSampleSize: number };
  };
}
const stored = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('musoko.demo.v1')!).state as Stored);

async function openSettings(page: Page) {
  const button = page.getByRole('button', { name: 'Demo settings' });
  if (await button.isVisible()) {
    await button.click();
    await expect(page.getByRole('dialog', { name: 'Demo settings' })).toBeVisible();
  }
}
async function switchRole(page: Page, role: 'Buyer' | 'Farmer' | 'Administrator') {
  await openSettings(page);
  const radio = page.getByRole('radio', { name: role });
  await page.locator('label', { has: radio }).click();
  await expect(radio).toBeChecked();
  const dialog = page.getByRole('dialog', { name: 'Demo settings' });
  if (await dialog.isVisible()) {
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  }
}
/** Opens an administrator page as the demo administrator. */
async function asAdmin(page: Page, path = '/admin') {
  await page.goto(path);
  await expect(page.getByText('This area is for Musoko administrators.')).toBeVisible();
  await switchRole(page, 'Administrator');
  await expect(page.getByRole('heading', { level: 1, name: 'Administration' })).toBeVisible();
}
/** A chip filter: its radio is visually hidden, so the label is what gets clicked. */
const chip = (page: Page, name: RegExp | string) => page.locator('label', { has: page.getByRole('radio', { name }) });
const row = (page: Page, title: string) => page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: title, exact: true }) });
const check = async (page: Page) => expect((await new AxeBuilder({ page }).disableRules(['color-contrast']).analyze()).violations).toEqual([]);

test('only an administrator gets in, and the demo says how to look around as one', async ({ page }) => {
  await page.goto('/admin');
  await expect(page.getByText('This area is for Musoko administrators.')).toBeVisible();
  await expect(page.getByText('choose “Administrator” under “Viewing as”')).toBeVisible();
  await expect(page.locator('body')).not.toContainText('870-555-0101');

  await switchRole(page, 'Administrator');
  await expect(page.getByRole('heading', { level: 1, name: 'Administration' })).toBeVisible();
  await switchRole(page, 'Farmer');
  await expect(page.getByText('This area is for Musoko administrators.')).toBeVisible();
  await switchRole(page, 'Buyer');
  await expect(page.getByText('This area is for Musoko administrators.')).toBeVisible();
});

test('CONS-1, CONS-2, TRUST-1, MODE-1: a profile started for a farmer is a draft, then consent is recorded, then Musoko lists it', async ({ page }) => {
  await asAdmin(page, '/admin/farms/new');
  await page.getByLabel('Farm name').fill('Fennel Row Farm');
  await page.getByLabel('Your name').fill('Mateo Brandvold');
  await page.getByLabel('Nearest town').selectOption({ label: 'Wynne' });
  await page.getByLabel('What do you grow or make?').fill('Turnips and kale.');
  await page.getByRole('button', { name: 'Save the draft' }).click();
  await expect(page.getByText('Enter a mobile number or an email')).toBeVisible();
  await page.getByLabel('Mobile number').fill('870-555-0111');
  await page.getByLabel('Farm street address').fill('9 Demo Road 12');
  await page.getByRole('button', { name: 'Save the draft' }).click();

  // The draft: no consent, nothing public.
  await expect(page).toHaveURL(/\/admin\/farms\/farm-/);
  await expect(page.getByRole('heading', { level: 2, name: 'Fennel Row Farm' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Waiting for the farmer’s consent', level: 3 })).toBeVisible();
  await expect(page.getByText('Started by an administrator: Demo Administrator')).toBeVisible();
  const draft = (await stored(page)).db.farmer_profiles.find((f) => f.slug === 'fennel-row-farm')!;
  expect(draft).toMatchObject({
    publicationStatus: 'draft', consentMethod: null, userId: null, showPhone: false, showEmail: false, showExactLocation: false,
  });
  await page.goto('/farmers/fennel-row-farm');
  await expect(page.getByText('This farm is not listed.')).toBeVisible();

  // Consent: a method is needed.
  await page.goto(`/admin/farms/${draft.id}`);
  await page.getByRole('button', { name: 'Record consent' }).click();
  await expect(page.getByText('Choose how the farmer agreed.')).toBeVisible();
  await page.getByRole('radio', { name: 'By phone' }).check();
  await page.getByRole('button', { name: 'Record consent' }).click();
  await expect(page.getByText('Recorded.', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Consent is on record. Ready for Musoko’s review.', level: 3 })).toBeVisible();
  const consented = (await stored(page)).db.farmer_profiles.find((f) => f.id === draft.id)!;
  expect(consented).toMatchObject({ consentMethod: 'by_phone', consentRecordedBy: 'user-demo-admin', publicationStatus: 'draft' });
  expect(consented.consentDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  await expect(page.getByText(/By phone, \d+ \w+ \d{4}, written down by Demo Administrator/).first()).toBeVisible();

  // Still not public until Musoko lists it.
  await page.goto('/farmers/fennel-row-farm');
  await expect(page.getByText('This farm is not listed.')).toBeVisible();

  await page.goto(`/admin/farms/${draft.id}`);
  await page.getByRole('button', { name: 'Approve and list' }).click();
  await expect(page.getByText('Approved. The profile is listed.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Listed. The profile is public.', level: 3 })).toBeVisible();

  // Public now, at the town centre, with nothing private on the page, and "Listed" never "Verified".
  await page.goto('/farmers/fennel-row-farm');
  await expect(page.getByRole('heading', { level: 1, name: 'Fennel Row Farm' })).toBeVisible();
  await expect(page.locator('body')).not.toContainText('870-555-0111');
  await expect(page.locator('body')).not.toContainText('9 Demo Road 12');
  await expect(page.getByText(/verified farm|verified farmer/i)).toHaveCount(0);

  // MODE-1: a reload and a role switch away and back keep it.
  await switchRole(page, 'Buyer');
  await page.goto('/farmers/fennel-row-farm');
  await expect(page.getByRole('heading', { level: 1, name: 'Fennel Row Farm' })).toBeVisible();
  await asAdmin(page, `/admin/farms/${draft.id}`).catch(async () => switchRole(page, 'Administrator'));
  await expect(page.getByRole('heading', { name: 'Listed. The profile is public.', level: 3 })).toBeVisible();
});

test('the registration queue holds the administrator’s draft, and approval needs consent first', async ({ page }) => {
  await asAdmin(page, '/admin/registrations');
  await expect(page.getByRole('link', { name: 'Registrations (1)' })).toBeVisible();
  const drafts = page.getByRole('region', { name: /Waiting for the farmer’s consent/ });
  await expect(drafts.getByRole('link', { name: 'Fennel and Flint Farm' })).toBeVisible();
  await expect(drafts.getByText('No consent recorded yet.')).toBeVisible();
  await drafts.getByRole('link', { name: 'Fennel and Flint Farm' }).click();
  await expect(page.getByRole('heading', { name: 'Waiting for the farmer’s consent', level: 3 })).toBeVisible();
  // Nothing to approve until consent is on record.
  await expect(page.getByRole('button', { name: 'Approve and list' })).toHaveCount(0);
  // A day in the future is refused.
  await page.getByRole('radio', { name: 'In person' }).check();
  await page.getByLabel('Day they agreed').fill('2099-01-01');
  await page.getByRole('button', { name: 'Record consent' }).click();
  await expect(page.getByText('That day has not happened yet.')).toBeVisible();
  expect((await stored(page)).db.farmer_profiles.find((f) => f.id === 'farm-11')).toMatchObject({ consentMethod: null });
});

test('CONS-3: an administrator’s edit marks the profile awaiting farmer review, and the farmer’s review is recorded the same way', async ({ page }) => {
  await asAdmin(page, '/admin/farms');
  await chip(page, /Waiting for farmer review/).click();
  await expect(row(page, 'Larkspur Lane Kitchen Garden')).toBeVisible();
  await expect(row(page, 'Willowmere Hens')).toHaveCount(0);

  await page.goto('/admin/farms/farm-02');
  await expect(page.getByRole('heading', { name: 'Listed. The profile is public.', level: 3 })).toBeVisible();
  await page.getByLabel('What do you grow or make?').fill('Pasture-raised hens and eggs by the dozen.');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('Saved. The profile is now waiting for the farmer’s review.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Listed, but the farmer has not reviewed the latest changes.', level: 3 })).toBeVisible();
  expect((await stored(page)).db.farmer_profiles.find((f) => f.id === 'farm-02')).toMatchObject({ farmerReviewedLatestChanges: false, reviewMethod: null });

  // The change is live for buyers.
  await page.goto('/farmers/willowmere-hens');
  await expect(page.getByText('Pasture-raised hens and eggs by the dozen.').first()).toBeVisible();

  await page.goto('/admin/farms');
  await chip(page, /Waiting for farmer review/).click();
  await expect(row(page, 'Willowmere Hens')).toBeVisible();

  await page.goto('/admin/farms/farm-02');
  await page.getByRole('radio', { name: 'Signed form' }).check();
  await page.getByRole('button', { name: 'Record the farmer’s review' }).click();
  await expect(page.getByText('Recorded.', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Listed. The profile is public.', level: 3 })).toBeVisible();
  expect((await stored(page)).db.farmer_profiles.find((f) => f.id === 'farm-02')).toMatchObject({
    farmerReviewedLatestChanges: true, reviewMethod: 'signed_form', reviewRecordedBy: 'user-demo-admin',
  });
});

test('declining takes a listed profile off the site, and listing it again puts it back', async ({ page }) => {
  await asAdmin(page, '/admin/farms/farm-04');
  await page.getByRole('button', { name: 'Take off the site' }).click();
  const dialog = page.getByRole('dialog', { name: 'Take this profile off the site?' });
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  expect((await stored(page)).db.farmer_profiles.find((f) => f.id === 'farm-04')).toMatchObject({ publicationStatus: 'published' });

  await page.getByRole('button', { name: 'Take off the site' }).click();
  await page.getByRole('dialog', { name: 'Take this profile off the site?' }).getByRole('button', { name: 'Take off the site' }).click();
  await expect(page.getByText('Taken off the site. Nothing was deleted.')).toBeVisible();
  await page.goto('/farmers/quillfeather-acres');
  await expect(page.getByText('This farm is not listed.')).toBeVisible();

  await page.goto('/admin/farms/farm-04');
  await page.getByRole('button', { name: 'List again' }).click();
  await expect(page.getByText('Listed again.')).toBeVisible();
  await page.goto('/farmers/quillfeather-acres');
  await expect(page.getByRole('heading', { level: 1, name: 'Quillfeather Acres' })).toBeVisible();
});

test('TRUST-2: one claim is verified with the evidence and the day; buyers see "verified" and the day, never the evidence', async ({ page }) => {
  await asAdmin(page, '/admin/claims');
  const open = page.getByRole('button', { name: 'Record verification: No synthetic pesticides, Cypress Knee Gardens' });
  await open.click();
  const dialog = page.getByRole('dialog', { name: 'Verify “No synthetic pesticides”' });
  await dialog.getByRole('button', { name: 'Verify this claim' }).click();
  await expect(dialog.getByText('Say what you checked.')).toBeVisible();
  await dialog.getByLabel('What did you check?').fill('Looked');
  await dialog.getByRole('button', { name: 'Verify this claim' }).click();
  await expect(dialog.getByText('Say a little more: what you saw, and where.')).toBeVisible();
  expect((await stored(page)).db.claims.find((c) => c.id === 'claim-04')).toMatchObject({ status: 'farmer_reported' });

  await dialog.getByLabel('What did you check?').fill('Spray records for two seasons sighted at the farm.');
  await dialog.getByLabel('Day you checked it').fill('2026-11-10');
  await dialog.getByRole('button', { name: 'Verify this claim' }).click();
  await expect(page.getByText('“No synthetic pesticides” is now verified.')).toBeVisible();
  expect((await stored(page)).db.claims.find((c) => c.id === 'claim-04')).toMatchObject({
    status: 'verified',
    verification: { evidenceChecked: 'Spray records for two seasons sighted at the farm.', verifiedOn: '2026-11-10', verifiedBy: 'user-demo-admin' },
  });

  // It leaves "not yet checked" and shows under "Verified", with the evidence for administrators.
  await expect(row(page, 'No synthetic pesticides')).toHaveCount(0);
  await chip(page, /Verified \(/).click();
  const verified = row(page, 'No synthetic pesticides');
  await expect(verified.getByText('verified 10 Nov 2026')).toBeVisible();
  await expect(verified.getByText(/Spray records for two seasons sighted at the farm\./)).toBeVisible();

  // Buyers see "verified" and the day, on that claim only, and never the evidence.
  await page.goto('/farmers/cypress-knee-gardens');
  await expect(page.getByText(/verified 10 Nov 2026/)).toBeVisible();
  await expect(page.locator('body')).not.toContainText('Spray records for two seasons');
  await expect(page.getByText('Accepts SNAP/EBT').first()).toBeVisible();
  await expect(page.getByText(/verified farm|verified farmer/i)).toHaveCount(0);

  // Take it off again.
  await page.goto('/admin/claims');
  await chip(page, /Verified \(/).click();
  await page.getByRole('button', { name: 'Remove verification: No synthetic pesticides, Cypress Knee Gardens' }).click();
  await page.getByRole('dialog', { name: 'Remove this verification?' }).getByRole('button', { name: 'Remove verification' }).click();
  await expect(page.getByText('“No synthetic pesticides” is back to farmer-reported.')).toBeVisible();
  expect((await stored(page)).db.claims.find((c) => c.id === 'claim-04')).toMatchObject({ status: 'farmer_reported', verification: null });
});

test('moderation hides a listing from buyers and shows it again, and survives a reload', async ({ page }) => {
  await asAdmin(page, '/admin/moderation');
  await page.getByLabel('Find one').fill('Collard greens');
  const item = row(page, 'Collard greens');
  await item.getByRole('button', { name: 'Hide: Collard greens' }).click();
  await expect(page.getByText('Hidden: Collard greens.')).toBeVisible();
  await expect(item.getByText('Hidden from buyers')).toBeVisible();
  expect((await stored(page)).db.products.find((p) => p.title === 'Collard greens')).toMatchObject({ moderationStatus: 'hidden' });

  await page.goto('/food?status=all');
  await expect(page.getByRole('article').filter({ hasText: 'Collard greens' })).toHaveCount(0);

  await page.goto('/admin/moderation');
  await page.getByLabel('Find one').fill('Collard greens');
  await expect(row(page, 'Collard greens').getByText('Hidden from buyers')).toBeVisible();
  await row(page, 'Collard greens').getByRole('button', { name: 'Show again: Collard greens' }).click();
  await expect(page.getByText('Showing again: Collard greens.')).toBeVisible();
  await page.goto('/food?status=all');
  await expect(page.getByRole('article').filter({ hasText: 'Collard greens' }).first()).toBeVisible();
});

test('STAT-1, INQ-5, INQ-7: the awaiting-response list shows what is stuck, longest first, with the buyer’s contact', async ({ page }) => {
  await asAdmin(page, '/admin/inquiries');
  await expect(page.getByRole('link', { name: 'Inquiries (3)' })).toBeVisible();
  const items = page.getByRole('listitem').filter({ hasText: 'Awaiting response' });
  await expect(items).toHaveCount(3);
  await expect(items.first()).toContainText('Waiting');
  await expect(items.first()).toContainText('Closes by itself on');
  await expect(page.getByText('Wants a text back: 870-555-0171').first()).toBeVisible();
  await expect(page.getByText('The farmer will reply when they can.')).toBeVisible();
  await expect(page.getByText('Payment and pickup are arranged directly with the farmer.').first()).toBeVisible();

  await chip(page, /Closed \(/).click();
  await expect(page.getByText('Closed without a reply.').first()).toBeVisible();
  // The record that retention already cleared says so.
  await expect(page.getByText('The buyer’s details were deleted after this inquiry closed.').first()).toBeVisible();

  // MODE-2: a farmer's reply moves it out of the list.
  await switchRole(page, 'Farmer');
  await page.goto('/dashboard/inquiries');
  const card = page.getByRole('listitem').filter({ hasText: 'Renata Voss' }).filter({ hasText: 'Collard' }).first();
  await card.getByRole('button', { name: 'Available', exact: true }).click();
  await expect(card.getByRole('status')).toHaveText('Your reply was sent.');
  await switchRole(page, 'Administrator');
  await page.goto('/admin/inquiries');
  await expect(page.getByRole('link', { name: 'Inquiries (2)' })).toBeVisible();
});

test('METRIC, DPRIV-3, DATA-2: the numbers say "Not enough data" for a thin community, label the self-reported, and list searches with no results', async ({ page }) => {
  await asAdmin(page, '/admin/metrics');
  await expect(page.getByText(/reflect only people who used Musoko, and early pilot numbers are small/)).toBeVisible();
  await expect(page.getByText(/fewer than 5 farms, searches or inquiries is not shown/)).toBeVisible();
  await expect(page.getByText('Inquiries sent').first()).toBeVisible();
  await expect(page.getByText('Self-reported by farmers.').first()).toBeVisible();
  await expect(page.getByText(/Self-reported by farmers\. Musoko sees no sale amounts/)).toBeVisible();

  // Lake Village: one farm, two searches, one inquiry. Every row is "Not enough data".
  const lake = page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: 'Lake Village', exact: true }) });
  await expect(lake).toBeVisible();
  const values = await lake.locator('dd').allInnerTexts();
  expect(values.length).toBeGreaterThan(10);
  expect(values.every((v) => v === 'Not enough data')).toBe(true);
  // A larger community shows figures.
  const helena = page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: 'Helena-West Helena', exact: true }) });
  expect((await helena.locator('dd').allInnerTexts()).some((v) => /^\d+$/.test(v))).toBe(true);

  // DATA-2: the raw terms, for administrators.
  const zero = page.getByRole('region', { name: 'Searches with no results' });
  await expect(zero.getByText('goat milk')).toBeVisible();
  await expect(zero.getByText('catfish')).toBeVisible();
  await expect(page.getByText('only administrators see them').first()).toBeVisible();

  // The owner can lower the smallest sample, and the thin community shows its figures.
  await page.goto('/admin/data');
  await page.getByLabel(/Smallest sample a figure may rest on/).fill('1');
  await page.getByRole('button', { name: 'Save settings' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Saved.' })).toBeVisible();
  await page.goto('/admin/metrics');
  const lakeNow = page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: 'Lake Village', exact: true }) });
  await expect(lakeNow).toBeVisible();
  await expect(lakeNow.locator('dd').filter({ hasText: /^1$/ }).first()).toBeVisible();
});

test('DPRIV-2: retention rolls old searches into counts, deletes them, and the numbers stay', async ({ page }) => {
  await asAdmin(page, '/admin/data');
  await expect(page.getByText('Raw searches past their time')).toBeVisible();
  const before = await stored(page);
  const heldBefore = before.db.search_events.length;
  const aggregateBefore = before.db.aggregate_counts.filter((a) => a.metric === 'searches').reduce((n, a) => n + a.count, 0);

  await page.getByLabel(/Keep raw searches for/).fill('10');
  await page.getByRole('button', { name: 'Save settings' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Saved.' })).toBeVisible();
  await page.getByLabel(/Keep raw searches for/).fill('0');
  await page.getByRole('button', { name: 'Save settings' }).click();
  await expect(page.getByText('Enter a whole number of days, from 1 to 3650.')).toBeVisible();
  await page.getByLabel(/Keep raw searches for/).fill('10');

  await page.getByRole('button', { name: 'Run retention now' }).click();
  await expect(page.getByText(/searches were rolled into counts and deleted/)).toBeVisible();

  const after = await stored(page);
  expect(after.db.search_events.length).toBeLessThan(heldBefore);
  const rolled = heldBefore - after.db.search_events.length;
  const aggregateAfter = after.db.aggregate_counts.filter((a) => a.metric === 'searches').reduce((n, a) => n + a.count, 0);
  expect(aggregateAfter - aggregateBefore).toBe(rolled);
  expect(after.db.settings.searchEventRetentionDays).toBe(10);

  await page.reload();
  await expect(page.getByLabel(/Keep raw searches for/)).toHaveValue('10');
  await page.getByRole('button', { name: 'Run retention now' }).click();
  await expect(page.getByText('Nothing was past its time.')).toBeVisible();
});

test('A11Y-1: the administrator pages have no accessibility violations', async ({ page }) => {
  test.slow();
  await asAdmin(page, '/admin');
  await check(page);
  for (const path of ['/admin/registrations', '/admin/farms', '/admin/farms/new', '/admin/farms/farm-11', '/admin/farms/farm-08', '/admin/inquiries', '/admin/claims', '/admin/moderation', '/admin/metrics', '/admin/data']) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1, name: 'Administration' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2 }).first()).toBeVisible();
    await check(page);
  }
});
