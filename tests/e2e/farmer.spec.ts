import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/**
 * Step 6: farmer registration and dashboard. IDs refer to docs/ACCEPTANCE.md.
 * Below 1200px the role switcher sits in the "Demo settings" sheet, so the
 * helpers open it first when the button is there.
 */

interface Stored {
  db: {
    farmer_profiles: Array<Record<string, unknown> & { id: string; slug: string }>;
    farmer_private_contacts: Array<{ farmerProfileId: string; phone: string | null; email: string | null }>;
    farm_private_locations: Array<{ farmerProfileId: string; streetAddress: string }>;
    product_availability: Array<{ productId: string; status: string; lastConfirmedAt: string | null; expectedMonth: string | null }>;
    product_quantities: Array<{ productId: string; amount: number; unit: string; approximate: boolean; lastConfirmedAt: string }>;
    products: Array<{ id: string; title: string; priceCents: number; sellingUnit: string; normalizedUnitPriceCents: number | null; licenceSelfConfirmed: boolean | null }>;
    inquiries: Array<{ id: string; statusToken: string; status: string; closedReason: string | null }>;
    inquiry_replies: Array<{ inquiryId: string; kind: string; message: string | null; phoneShared: boolean }>;
    inquiry_outcomes: Array<{ inquiryId: string; outcome: string }>;
    claims: Array<{ farmerProfileId: string; type: string; label: string; status: string }>;
  };
  outbox: Array<{ template: string; channel: string; body: string }>;
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
/** Opens a dashboard page as the demo farmer. */
async function asFarmer(page: Page, path = '/dashboard') {
  await page.goto(path);
  await expect(page.getByText('This area is for farmers.')).toBeVisible();
  await switchRole(page, 'Farmer');
  await expect(page.getByRole('heading', { level: 1, name: 'Cypress Knee Gardens' })).toBeVisible();
}
const listing = (page: Page, title: string) => page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: title, exact: true }) });
const check = async (page: Page) => expect((await new AxeBuilder({ page }).disableRules(['color-contrast']).analyze()).violations).toEqual([]);

test('only a farmer gets into the dashboard, and the demo says how to look around as one', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page.getByText('This area is for farmers.')).toBeVisible();
  await expect(page.getByText('choose “Farmer” under “Viewing as”')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Join as a farmer' }).first()).toBeVisible();
  await switchRole(page, 'Farmer');
  await expect(page.getByRole('heading', { level: 1, name: 'Cypress Knee Gardens' })).toBeVisible();
  await switchRole(page, 'Buyer');
  await expect(page.getByText('This area is for farmers.')).toBeVisible();
});

test('AVAIL-5, QTY-4, MODE-1: one tap confirms a listing, with the amount in the same step, and it survives reload', async ({ page }) => {
  await asFarmer(page, '/dashboard/listings');
  const row = listing(page, 'Collard greens');
  await expect(row).toBeVisible();

  // A lapsed listing: one tap.
  const lapsed = listing(page, 'Mustard greens');
  await expect(lapsed.getByText(/Availability unconfirmed/)).toBeVisible();
  await lapsed.getByRole('button', { name: 'Still available' }).click();
  await expect(lapsed.getByRole('status')).toHaveText('Confirmed just now');
  await expect(lapsed.getByText(/Available now, confirmed/)).toBeVisible();

  // The amount in the same step.
  await row.getByRole('button', { name: 'Amount' }).click();
  await row.getByRole('textbox', { name: 'How much' }).fill('45');
  await row.getByRole('button', { name: 'Still available, with this amount' }).click();
  await expect(row.getByRole('status')).toHaveText('Confirmed just now');
  await expect(row.getByText(/About 45 bunches · confirmed/)).toBeVisible();

  const after = await stored(page);
  const id = after.db.products.find((p) => p.title === 'Collard greens')!.id;
  expect(after.db.product_quantities.find((q) => q.productId === id)).toMatchObject({ amount: 45, approximate: true });

  await page.reload();
  await expect(listing(page, 'Collard greens').getByText(/About 45 bunches/)).toBeVisible();
  await expect(listing(page, 'Mustard greens').getByText(/Available now, confirmed/)).toBeVisible();
});

test('AVAIL-5: Coming soon takes a month and shows to buyers; None right now says so', async ({ page }) => {
  await asFarmer(page, '/dashboard/listings');
  const row = listing(page, 'Collard greens');
  await row.getByRole('button', { name: 'Coming soon' }).click();
  await row.getByLabel('Month').selectOption({ index: 3 });
  await row.getByRole('button', { name: 'Set coming soon' }).click();
  await expect(row.getByRole('status')).toContainText('Marked coming soon for');
  await expect(row.getByText(/Coming soon, expected/)).toBeVisible();
  const state = await stored(page);
  const id = state.db.products.find((p) => p.title === 'Collard greens')!.id;
  expect(state.db.product_availability.find((a) => a.productId === id)).toMatchObject({ status: 'coming_soon', lastConfirmedAt: null });
  expect(state.db.product_availability.find((a) => a.productId === id)!.expectedMonth).toMatch(/^\d{4}-\d{2}$/);

  // Buyers see it.
  await switchRole(page, 'Buyer');
  await page.goto('/food?status=all');
  const card = page.getByRole('article').filter({ hasText: 'Collard greens' }).first();
  await expect(card.getByText('Coming soon')).toBeVisible();

  await switchRole(page, 'Farmer');
  await page.goto('/dashboard/listings');
  await listing(page, 'Collard greens').getByRole('button', { name: 'None right now' }).click();
  await expect(listing(page, 'Collard greens').getByRole('status')).toHaveText('Marked as not available.');
});

test('PRICE, CLAIM-2: a new listing takes presets, shows the unit price, and asks for the licence on eggs', async ({ page }) => {
  await asFarmer(page, '/dashboard/listings/new');
  await page.getByLabel('What is it?').selectOption({ label: 'Tomatoes' });
  await expect(page.getByLabel('Name buyers will see')).toHaveValue('Tomatoes');
  await page.getByLabel('Name buyers will see').fill('Slicing tomatoes, 5 lb box');
  await page.getByRole('radio', { name: '5 lb box' }).check();
  await page.getByLabel('Price in dollars').fill('15');
  await expect(page.getByText('$15 for a 5 lb box · $3.00 per lb')).toBeVisible();
  await page.getByLabel('How much do you have?').fill('8');
  await page.getByRole('button', { name: 'Save listing' }).click();
  await expect(page).toHaveURL(/\/dashboard\/listings$/);
  await expect(listing(page, 'Slicing tomatoes, 5 lb box').getByText(/\$15 for a 5 lb box/)).toBeVisible();
  await expect(listing(page, 'Slicing tomatoes, 5 lb box').getByText(/About 8 boxes · confirmed/)).toBeVisible();

  // Buyers see it at once, with the unit price (the farm is listed).
  await page.goto('/food?status=all');
  await expect(page.getByRole('article').filter({ hasText: 'Slicing tomatoes, 5 lb box' }).first()).toContainText('$3.00 per lb');

  // Eggs need the licence confirmation.
  await page.goto('/dashboard/listings/new');
  await page.getByLabel('What is it?').selectOption({ label: 'Eggs' });
  await page.getByRole('radio', { name: 'Dozen' }).check();
  await page.getByLabel('Price in dollars').fill('5');
  await page.getByRole('button', { name: 'Save listing' }).click();
  await expect(page.getByText('Please confirm this to list it.')).toHaveCount(1);
  await page.getByRole('checkbox', { name: /I confirm I hold the licence/ }).check();
  await page.getByRole('button', { name: 'Save listing' }).click();
  await expect(page).toHaveURL(/\/dashboard\/listings$/);
  const state = await stored(page);
  expect(state.db.products.find((p) => p.title === 'Eggs')).toMatchObject({ licenceSelfConfirmed: true, priceCents: 500 });
});

test('a listing can be edited and removed, and buyers see the change', async ({ page }) => {
  await asFarmer(page, '/dashboard/listings');
  await listing(page, 'Sweet potatoes').getByRole('link', { name: 'Edit' }).click();
  await expect(page).toHaveURL(/\/dashboard\/listings\/prod-002$/);
  await expect(page.getByLabel('Name buyers will see')).toHaveValue('Sweet potatoes');
  await expect(page.getByRole('radio', { name: 'By the pound' })).toBeChecked();
  await page.getByLabel('Price in dollars').fill('2.50');
  await expect(page.getByText('$2.50 a lb · $2.50 per lb')).toBeVisible();
  await page.getByRole('button', { name: 'Save listing' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Saved.' })).toBeVisible();
  await page.goto('/food?status=all');
  await expect(page.getByRole('article').filter({ hasText: 'Sweet potatoes' }).first()).toContainText('$2.50');

  await page.goto('/dashboard/listings/prod-002');
  await page.getByRole('button', { name: 'Remove this listing' }).click();
  await page.getByRole('dialog', { name: 'Remove this listing?' }).getByRole('button', { name: 'Remove listing' }).click();
  await expect(page).toHaveURL(/\/dashboard\/listings$/);
  await expect(listing(page, 'Sweet potatoes')).toHaveCount(0);
  await page.goto('/food?status=all');
  await expect(page.getByRole('article').filter({ hasText: 'Sweet potatoes' }).filter({ hasText: 'Cypress Knee Gardens' })).toHaveCount(0);
});

test('INQ-3, STAT-1, MODE-2: one tap replies, the buyer’s page shows it, and no phone goes with it', async ({ page }) => {
  await asFarmer(page, '/dashboard/inquiries');
  const card = page.getByRole('listitem').filter({ hasText: 'Renata Voss' }).filter({ hasText: 'Collard' }).first();
  await expect(card.getByText('Awaiting response')).toBeVisible();
  await expect(card.getByText('Wants a text back: 870-555-0171')).toBeVisible();
  await card.getByRole('button', { name: 'Add a short note' }).click();
  await card.getByLabel('Short note for the buyer').fill('Cut this morning.');
  await card.getByRole('button', { name: 'Available', exact: true }).click();
  await expect(card.getByRole('status')).toHaveText('Your reply was sent.');
  await expect(card.getByText(/You replied “Available”/)).toBeVisible();
  await expect(card.getByText('Responded')).toBeVisible();

  const state = await stored(page);
  expect(state.db.inquiry_replies.find((r) => r.inquiryId === 'inq-01')).toMatchObject({ kind: 'available', message: 'Cut this morning.', phoneShared: false });
  const notice = state.outbox.at(-1)!;
  expect(notice).toMatchObject({ template: 'inquiry_reply', channel: 'sms' });
  expect(notice.body).not.toContain('870-555-0101');

  // The buyer sees it, without the farmer's phone.
  await switchRole(page, 'Buyer');
  await page.goto('/inquiry/status-token-01');
  await expect(page.getByText('Responded', { exact: true })).toBeVisible();
  await expect(page.getByText('The farmer says it is available.')).toBeVisible();
  await expect(page.getByText('Cut this morning.')).toBeVisible();
  await expect(page.locator('body')).not.toContainText('870-555-0101');
});

test('INQ-4: Contact me asks first, and shares the phone with that buyer only', async ({ page }) => {
  await asFarmer(page, '/dashboard/inquiries');
  const card = page.getByRole('listitem').filter({ hasText: 'Renata Voss' }).filter({ hasText: 'cherry' }).first();
  await expect(card).toBeVisible();
  await card.getByRole('button', { name: 'Contact me' }).click();
  const dialog = page.getByRole('dialog', { name: 'Share your phone number?' });
  await expect(dialog).toContainText('870-555-0101');
  await expect(dialog).toContainText('Nobody else will.');

  // Cancel changes nothing.
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  expect((await stored(page)).db.inquiry_replies.some((r) => r.inquiryId === 'inq-03')).toBe(false);

  await card.getByRole('button', { name: 'Contact me' }).click();
  await page.getByRole('dialog', { name: 'Share your phone number?' }).getByRole('button', { name: 'Share my number and reply' }).click();
  await expect(card.getByRole('status')).toHaveText('Your reply was sent.');
  await expect(card.getByText('Your phone number was shared with this buyer.')).toBeVisible();
  expect((await stored(page)).db.inquiry_replies.find((r) => r.inquiryId === 'inq-03')).toMatchObject({ kind: 'contact_me', phoneShared: true });

  await switchRole(page, 'Buyer');
  await page.goto('/inquiry/status-token-03');
  await expect(page.getByRole('link', { name: '870-555-0101' })).toBeVisible();
  // Another buyer's inquiry to the same farmer does not carry it.
  await page.goto('/inquiry/status-token-01');
  await expect(page.locator('body')).not.toContainText('870-555-0101');
});

test('INQ-4: a note that carries a phone number is refused in words', async ({ page }) => {
  await asFarmer(page, '/dashboard/inquiries');
  const card = page.getByRole('listitem').filter({ hasText: 'Renata Voss' }).filter({ hasText: 'Collard' }).first();
  await card.getByRole('button', { name: 'Add a short note' }).click();
  await card.getByLabel('Short note for the buyer').fill('Text me on 870-555-0101');
  await card.getByRole('button', { name: 'Available', exact: true }).click();
  await expect(card.getByText(/Leave phone numbers, emails and addresses out of the note/).first()).toBeVisible();
  expect((await stored(page)).db.inquiry_replies.some((r) => r.inquiryId === 'inq-01')).toBe(false);
});

test('OUT-1, OUT-2, STAT-5: the outcome question appears some days after a reply, takes one tap, and closes the inquiry', async ({ page }) => {
  await asFarmer(page, '/dashboard');
  // inq-05 was answered 3.5 days ago in the seed, so the question is due.
  const question = page.getByRole('group', { name: 'Did this inquiry result in a sale or new customer relationship?' });
  await expect(question).toHaveCount(1);
  await expect(question.getByText(/asks for no amounts and no payment details|no amounts and no payment details/)).toBeVisible();
  await expect(question.getByRole('button')).toHaveText(['Yes, a sale', 'Yes, a new potential customer', 'No', 'Still discussing', 'Skip']);

  // Skipping has no consequence.
  await question.getByRole('button', { name: 'Skip' }).click();
  await expect(page.getByRole('group', { name: /Did this inquiry result/ })).toHaveCount(0);
  expect((await stored(page)).db.inquiry_outcomes.some((o) => o.inquiryId === 'inq-05')).toBe(false);

  await page.reload();
  const again = page.getByRole('group', { name: /Did this inquiry result/ });
  await again.getByRole('button', { name: 'Yes, a sale' }).click();
  await expect(page.getByText('Your answer was saved.')).toBeVisible();
  const state = await stored(page);
  expect(state.db.inquiry_outcomes.find((o) => o.inquiryId === 'inq-05')).toMatchObject({ outcome: 'sale' });
  expect(state.db.inquiries.find((i) => i.id === 'inq-05')).toMatchObject({ status: 'closed', closedReason: 'outcome_recorded' });

  await page.reload();
  await expect(page.getByRole('group', { name: /Did this inquiry result/ })).toHaveCount(0);
});

test('PRIV-3, PRIV-1: privacy switches change what buyers see, and survive a reload', async ({ page }) => {
  await asFarmer(page, '/dashboard/privacy');
  const phone = page.getByRole('checkbox', { name: 'Show my phone number' });
  await expect(phone).toBeChecked();
  await phone.uncheck();
  await page.getByRole('checkbox', { name: 'Show my farm’s exact location on the map' }).uncheck();
  await page.getByRole('button', { name: 'Save privacy settings' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Saved.' })).toBeVisible();

  await page.goto('/farmers/cypress-knee-gardens');
  await expect(page.locator('body')).not.toContainText('870-555-0101');
  expect((await stored(page)).db.farmer_profiles.find((f) => f.id === 'farm-01')).toMatchObject({ showPhone: false, showExactLocation: false });

  await page.goto('/dashboard/privacy');
  await expect(page.getByRole('checkbox', { name: 'Show my phone number' })).not.toBeChecked();
  await page.getByRole('checkbox', { name: 'Show my phone number' }).check();
  await page.getByRole('button', { name: 'Save privacy settings' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Saved.' })).toBeVisible();
  await page.goto('/farmers/cypress-knee-gardens');
  await expect(page.locator('body')).toContainText('870-555-0101');
});

test('CONS-4: a farmer takes their profile down and puts it back', async ({ page }) => {
  await asFarmer(page, '/dashboard/privacy');
  await page.getByRole('button', { name: 'Take my profile down' }).click();
  const dialog = page.getByRole('dialog', { name: 'Take your profile down?' });
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  expect((await stored(page)).db.farmer_profiles.find((f) => f.id === 'farm-01')).toMatchObject({ publicationStatus: 'published' });

  await page.getByRole('button', { name: 'Take my profile down' }).click();
  await page.getByRole('dialog', { name: 'Take your profile down?' }).getByRole('button', { name: 'Take it down' }).click();
  await expect(page.getByText('Your profile was taken down.')).toBeVisible();
  await expect(page.getByText('Your profile is not public.').first()).toBeVisible();
  expect((await stored(page)).db.farmer_profiles.find((f) => f.id === 'farm-01')).toMatchObject({ publicationStatus: 'unpublished' });

  await page.goto('/farmers/cypress-knee-gardens');
  await expect(page.getByText('This farm is not listed.')).toBeVisible();
  await page.goto('/farmers');
  await expect(page.getByText('Cypress Knee Gardens')).toHaveCount(0);

  await page.goto('/dashboard/privacy');
  await page.getByRole('button', { name: 'Show my profile again' }).first().click();
  await expect(page.getByText('Your profile is public again.').first()).toBeVisible();
  await page.goto('/farmers/cypress-knee-gardens');
  await expect(page.getByRole('heading', { level: 1, name: 'Cypress Knee Gardens' })).toBeVisible();
});

test('CONS-2, CONS-3: the farmer approves a profile an administrator started, and reviews an administrator’s changes', async ({ page }) => {
  await asFarmer(page);
  // Make the demo farmer's profile look administrator-made and unreviewed (step 7 builds the admin side).
  await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('musoko.demo.v1')!);
    raw.state.db.farmer_profiles = raw.state.db.farmer_profiles.map((f: Record<string, unknown>) =>
      f.id === 'farm-01' ? { ...f, farmerReviewedLatestChanges: false, reviewMethod: null, reviewDate: null, reviewRecordedBy: null } : f,
    );
    localStorage.setItem('musoko.demo.v1', JSON.stringify(raw));
  });
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Musoko changed your profile.' })).toBeVisible();
  await page.getByRole('button', { name: 'These changes are right' }).click();
  await expect(page.getByText('Your review was recorded.')).toBeVisible();
  expect((await stored(page)).db.farmer_profiles.find((f) => f.id === 'farm-01')).toMatchObject({
    farmerReviewedLatestChanges: true, reviewMethod: 'farmer_signed_in', reviewRecordedBy: 'user-demo-farmer',
  });

  await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('musoko.demo.v1')!);
    raw.state.db.farmer_profiles = raw.state.db.farmer_profiles.map((f: Record<string, unknown>) =>
      f.id === 'farm-01'
        ? { ...f, createdByRole: 'administrator', registrationStatus: 'pending_review', publicationStatus: 'draft', consentMethod: null, consentDate: null, consentRecordedBy: null }
        : f,
    );
    localStorage.setItem('musoko.demo.v1', JSON.stringify(raw));
  });
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Musoko started this profile for you.' })).toBeVisible();
  await page.getByRole('button', { name: 'Approve my profile' }).click();
  await expect(page.getByText('Your approval was recorded.')).toBeVisible();
  expect((await stored(page)).db.farmer_profiles.find((f) => f.id === 'farm-01')).toMatchObject({
    consentMethod: 'farmer_signed_in', consentRecordedBy: 'user-demo-farmer',
  });
});

test('profile edits, practices and pickup choices are saved and survive a reload', async ({ page }) => {
  await asFarmer(page, '/dashboard/profile');
  await page.getByLabel('What do you grow or make?').fill('Greens, sweet potatoes and tomatoes, grown outside Helena.');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Saved.' }).first()).toBeVisible();

  await page.getByRole('checkbox', { name: 'Pasture raised' }).check();
  await page.getByLabel('What to say').fill('Cottage food registration');
  await page.getByLabel('Kind').selectOption('licence');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByRole('button', { name: 'Save these' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Saved.' }).nth(1)).toBeVisible();

  await page.reload();
  await expect(page.getByLabel('What do you grow or make?')).toHaveValue('Greens, sweet potatoes and tomatoes, grown outside Helena.');
  await expect(page.getByRole('checkbox', { name: 'Pasture raised' })).toBeChecked();
  const state = await stored(page);
  // Anything a farmer enters is farmer-reported, never verified.
  const mine = state.db.claims.filter((c) => c.farmerProfileId === 'farm-01');
  expect(mine.every((c) => c.status === 'farmer_reported')).toBe(true);
  expect(mine.map((c) => c.label)).toEqual(expect.arrayContaining(['Pasture raised', 'Cottage food registration', 'Accepts SNAP/EBT']));

  await page.goto('/farmers/cypress-knee-gardens');
  await expect(page.getByText('Greens, sweet potatoes and tomatoes, grown outside Helena.').first()).toBeVisible();
  await expect(page.getByText('Cottage food registration')).toBeVisible();
});

test('the farmer’s numbers show their own figures and the plain note', async ({ page }) => {
  await asFarmer(page, '/dashboard/numbers');
  await expect(page.getByText('Inquiries received')).toBeVisible();
  await expect(page.getByText('Typical time to reply')).toBeVisible();
  await expect(page.getByText(/only people who used Musoko/)).toBeVisible();
  await expect(page.getByText('Self-reported by you. Musoko does not see sale amounts.')).toBeVisible();
});

test('CONS-2, TRUST-1, MODE-1: a farmer registers, becomes a draft awaiting review, and nothing is public', async ({ page }) => {
  test.slow();
  await page.goto('/join');
  await expect(page.getByRole('heading', { name: /Step 1 of 2/ })).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('Enter your farm’s name.')).toBeVisible();
  await expect(page.getByText('Choose your town.')).toBeVisible();

  await page.getByLabel('Farm name').fill('Cypress Row Farm');
  await page.getByLabel('Your name').fill('Ada Marsh');
  await page.getByLabel('Nearest town').selectOption({ label: 'Pine Bluff' });
  await page.getByLabel('What do you grow or make?').fill('Greens and eggs.');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: /Step 2 of 2/ })).toBeVisible();

  // Everything private is off, and consent is not ticked for them.
  for (const name of ['Show my phone number on my profile', 'Show my email on my profile', 'Show my farm’s exact location on the map']) {
    await expect(page.getByRole('checkbox', { name })).not.toBeChecked();
  }
  await page.getByRole('button', { name: 'Register my farm' }).click();
  await expect(page.getByText('Enter a mobile number or an email')).toBeVisible();
  await expect(page.getByText('Please tick this box to register.')).toBeVisible();

  await page.getByLabel('Mobile number').fill('870-555-0142');
  await page.getByLabel(/Farm street address/).fill('14 Demo Lane');
  await page.getByRole('checkbox', { name: /I agree that Musoko may list my farm’s profile/ }).check();
  await page.getByRole('button', { name: 'Register my farm' }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Cypress Row Farm' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Musoko will review your profile.' })).toBeVisible();
  await expect(page.getByText('Waiting for Musoko’s review')).toBeVisible();

  const state = await stored(page);
  const profile = state.db.farmer_profiles.find((f) => f.slug === 'cypress-row-farm')!;
  expect(profile).toMatchObject({
    registrationStatus: 'pending_review', publicationStatus: 'draft', consentMethod: 'farmer_signed_in',
    showPhone: false, showEmail: false, showExactLocation: false,
  });
  expect(state.db.farmer_private_contacts.find((c) => c.farmerProfileId === profile.id)).toMatchObject({ phone: '870-555-0142' });
  expect(state.db.farm_private_locations.find((l) => l.farmerProfileId === profile.id)?.streetAddress).toBe('14 Demo Lane');

  // Not public: no label of "Listed" or "Verified", and no page.
  await page.goto('/farmers/cypress-row-farm');
  await expect(page.getByText('This farm is not listed.')).toBeVisible();
  await page.goto('/farmers');
  await expect(page.getByText('Cypress Row Farm')).toHaveCount(0);

  // MODE-1: reload, role switch away and back, and the new farmer is still there.
  await page.goto('/dashboard');
  await expect(page.getByRole('heading', { level: 1, name: 'Cypress Row Farm' })).toBeVisible();
  await switchRole(page, 'Buyer');
  await expect(page.getByText('This area is for farmers.')).toBeVisible();
  await switchRole(page, 'Farmer');
  await expect(page.getByRole('heading', { level: 1, name: 'Cypress Row Farm' })).toBeVisible();

  // The new farmer can add a listing, which stays private with the profile.
  await page.goto('/dashboard/listings/new');
  await page.getByLabel('What is it?').selectOption({ label: 'Collard greens' });
  await page.getByRole('radio', { name: 'By the bunch' }).check();
  await page.getByLabel('Price in dollars').fill('3.50');
  await page.getByRole('button', { name: 'Save listing' }).click();
  await expect(page).toHaveURL(/\/dashboard\/listings$/, { timeout: 15_000 });
  await expect(listing(page, 'Collard greens').getByText('Available now, confirmed')).toBeVisible();
  await page.goto('/food?status=all');
  await expect(page.getByText('Cypress Row Farm')).toHaveCount(0);
});

test('A11Y-1: the farmer pages have no accessibility violations', async ({ page }) => {
  test.slow();
  await page.goto('/join');
  await check(page);
  await asFarmer(page, '/dashboard');
  await check(page);
  for (const path of ['/dashboard/listings', '/dashboard/listings/new', '/dashboard/inquiries', '/dashboard/profile', '/dashboard/privacy', '/dashboard/numbers']) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1, name: 'Cypress Knee Gardens' })).toBeVisible();
    await check(page);
  }
});
