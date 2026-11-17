import { expect, test } from '@playwright/test';

/**
 * Browsing: homepage, marketplace, farmer directory and profile, markets.
 * IDs refer to docs/ACCEPTANCE.md.
 */

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('musoko.welcome.v1', 'buyer');
    } catch {
      /* ignore */
    }
  });
});

test('homepage answers what, how much and where without a click', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('searchbox', { name: 'What local food are you looking for?' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Your town: Helena-West Helena/ })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: /Available now near Helena-West Helena/ })).toBeVisible();
  const shelf = page.locator('#home-available-row');
  const first = shelf.getByRole('article').first();
  await expect(first).toContainText('Available now');
  await expect(first).toContainText('$');
  await expect(first).toContainText(/Pick up|Farmer delivers/);
});

test('DEMO-2: every product, farm and market card carries the Demo mark', async ({ page }) => {
  for (const path of ['/food?status=all', '/farmers', '/farmers-markets']) {
    await page.goto(path);
    const cards = page.getByRole('article');
    await expect(cards.first()).toBeVisible();
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) await expect(cards.nth(i)).toContainText('Demo');
  }
});

test('AVAIL-1 and AVAIL-3: each listing shows one status and a date; available first, unconfirmed last', async ({
  page,
}) => {
  await page.goto('/food?status=all');
  const cards = page.getByRole('article');
  await expect(cards.first()).toBeVisible();
  const texts = await cards.allInnerTexts();
  const rank = (t: string) => (t.includes('Available now') ? 0 : t.includes('Coming soon') ? 1 : 2);
  for (const text of texts) {
    const statuses = ['Available now', 'Coming soon', 'Availability unconfirmed'].filter((s) => text.includes(s));
    expect(statuses).toHaveLength(1);
    expect(text).toMatch(/Updated \d{1,2} \w{3} \d{4}/);
  }
  const ranks = texts.map(rank);
  expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
  expect(new Set(ranks).size).toBe(3);
});

test('PRICE-1 and PRICE-3: unit price shown where it is reliable and nowhere else', async ({ page }) => {
  await page.goto('/food?status=all&q=tomatoes');
  const box = page.getByRole('article').filter({ hasText: '5 lb box' }).first();
  await expect(box).toContainText(/\$[\d.]+ for a 5 lb box · \$\d+\.\d{2} per lb/);
  await page.goto('/food?status=all&q=collard');
  const bunch = page.getByRole('article').filter({ hasText: 'a bunch' }).first();
  await expect(bunch).toBeVisible();
  await expect(bunch).not.toContainText(' per ');
});

test('search and filters live in the URL and narrow the list', async ({ page }) => {
  await page.goto('/');
  const search = page.getByRole('searchbox', { name: 'What local food are you looking for?' });
  await search.fill('eggs');
  await search.press('Enter');
  await expect(page).toHaveURL(/\/food\?q=eggs/);
  const cards = page.getByRole('article');
  await expect(cards.first()).toContainText(/eggs/i);
  await page.reload();
  await expect(page.getByRole('searchbox', { name: 'What local food are you looking for?' })).toHaveValue('eggs');
  await page.goto('/food?q=zzzz');
  await expect(page.getByText('No listings match.')).toBeVisible();
});

test('CONS-1 and TRUST-4: a draft profile is not reachable and no farm-level verified badge exists', async ({
  page,
}) => {
  await page.goto('/farmers/fennel-and-flint-farm');
  await expect(page.getByText('This farm is not listed.')).toBeVisible();
  await page.goto('/farmers');
  await expect(page.getByRole('article').first()).toBeVisible();
  await expect(page.getByText('Fennel and Flint Farm')).toHaveCount(0);
  await expect(page.getByText(/verified farm/i)).toHaveCount(0);
});

test('PRIV-1 to PRIV-3: no street address, and contact only where the farmer opted in', async ({ page }) => {
  // Willowmere Hens shares a phone and no email. Three Gate Honey shares nothing.
  await page.goto('/farmers/three-gate-honey');
  await expect(page.getByRole('heading', { level: 1, name: 'Three Gate Honey' })).toBeVisible();
  const quiet = await page.locator('main').innerText();
  expect(quiet).not.toMatch(/870-555-01\d\d/);
  expect(quiet).not.toMatch(/@[a-z-]+\.example/);
  expect(quiet).not.toMatch(/Demo Road/);

  await page.goto('/farmers/cypress-knee-gardens');
  await expect(page.getByRole('heading', { level: 1, name: 'Cypress Knee Gardens' })).toBeVisible();
  const open = await page.locator('main').innerText();
  expect(open).toMatch(/870-555-01\d\d/);
  expect(open).toContain('The farmer has chosen to share the farm’s exact location.');
  expect(open).not.toMatch(/Demo Road/);
});

test('TRUST-2 and TRUST-3: claims read farmer-reported unless verified with a date', async ({ page }) => {
  await page.goto('/farmers/willowmere-hens');
  const main = page.locator('main');
  await expect(main).toContainText('farmer-reported');
  await expect(main).toContainText(/verified \d{1,2} \w{3} \d{4}/);
});

test('INQ-7 wording: the transaction statement is on the homepage and every farm profile', async ({ page }) => {
  const statement = 'Payment and pickup are arranged directly with the farmer.';
  await page.goto('/');
  await expect(page.locator('main')).toContainText(statement);
  await page.goto('/farmers/willowmere-hens');
  await expect(page.locator('main')).toContainText(statement);
});

test('SCOPE-3: nothing reads like a delivery app', async ({ page }) => {
  for (const path of ['/', '/food', '/farmers/cypress-knee-gardens']) {
    await page.goto(path);
    await expect(page.getByRole('article').first()).toBeVisible();
    const text = (await page.locator('body').innerText()).toLowerCase();
    for (const word of ['add to cart', 'checkout', 'your cart', 'order now', 'delivery fee']) {
      expect(text).not.toContain(word);
    }
  }
});
