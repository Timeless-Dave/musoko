import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { choose } from './choose';

/**
 * Step 4: map, equivalent list, markets list. IDs refer to docs/ACCEPTANCE.md.
 */

/** The demo strip is fixed to the bottom edge, so bring the map to the middle before clicking a pin. */
const centreMap = (page: Page) => page.locator('.map-canvas').evaluate((el) => el.scrollIntoView({ block: 'center' }));

const previewEvents = (page: Page) =>
  page.evaluate(() => {
    const raw = localStorage.getItem('musoko.demo.v1');
    if (!raw) return [];
    return JSON.parse(raw).state.db.preview_events as Array<{
      targetId: string;
      surface: string;
      count: number;
      day: string;
    }>;
  });

const total = (events: Awaited<ReturnType<typeof previewEvents>>, targetId: string, surface: string) =>
  events.filter((e) => e.targetId === targetId && e.surface === surface).reduce((n, e) => n + e.count, 0);

test('A11Y-2: the map is the default on /map and the list is one tap away', async ({ page }) => {
  await page.goto('/map');
  await expect(page.getByRole('tab', { name: 'Map' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.maplibregl-map')).toBeVisible();
  await page.getByRole('tab', { name: 'List' }).click();
  await expect(page.getByRole('tab', { name: 'List' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('heading', { name: 'Farmers markets', level: 2 })).toBeVisible();
});

test('the list is the whole map in words, with a Demo mark on every place', async ({ page }) => {
  await page.goto('/map');
  const rows = page.locator('.place-row');
  await expect(rows.first()).toBeVisible();
  const count = await rows.count();
  expect(count).toBeGreaterThan(10);
  await expect(page.getByRole('status').filter({ hasText: `${count} places` })).toBeVisible();
  for (let i = 0; i < count; i++) await expect(rows.nth(i)).toContainText('Demo');
  for (const group of ['Farmers markets', 'Pickup points', 'Farms']) {
    await expect(page.getByRole('heading', { name: group, level: 2 })).toBeVisible();
  }
});

test('filters narrow both views and live in the URL', async ({ page }) => {
  await page.goto('/map');
  await expect(page.locator('.place-row').first()).toBeVisible();
  const all = await page.locator('.place-row').count();
  await choose(page, 'Show', 'Farmers markets');
  await expect(page).toHaveURL(/show=market/);
  await expect(page.getByRole('heading', { name: 'Farms', level: 2 })).toHaveCount(0);
  const markets = await page.locator('.place-row').count();
  expect(markets).toBeGreaterThan(0);
  expect(markets).toBeLessThan(all);

  await choose(page, 'Town', 'Helena-West Helena');
  await expect(page).toHaveURL(/town=helena-west-helena/);
  for (const text of await page.locator('.place-row').allInnerTexts()) expect(text).toContain('Helena-West Helena');

  await page.getByRole('button', { name: 'Clear filters' }).first().click();
  await expect(page.locator('.place-row')).toHaveCount(all);
});

test('DATA-4: opening a market or pickup preview in the list adds one anonymous count, closing adds none', async ({
  page,
}) => {
  await page.goto('/map');
  const row = page.locator('.place-row').filter({ hasText: 'Delta Saturday Stalls' });
  const before = total(await previewEvents(page), 'market-01', 'list');
  await row.getByRole('button', { name: /Show details/ }).click();
  await expect(row.getByText('Farmers who sell here')).toBeVisible();
  await expect(row).toContainText('Demo');
  await expect.poll(async () => total(await previewEvents(page), 'market-01', 'list')).toBe(before + 1);
  await row.getByRole('button', { name: /Hide details/ }).click();
  await page.waitForTimeout(300);
  expect(total(await previewEvents(page), 'market-01', 'list')).toBe(before + 1);

  const pickup = page.locator('.place-row').filter({ hasText: 'Cypress Commons Pickup Shed' });
  const pickupBefore = total(await previewEvents(page), 'pickup-01', 'list');
  await pickup.getByRole('button', { name: /Show details/ }).click();
  await expect.poll(async () => total(await previewEvents(page), 'pickup-01', 'list')).toBe(pickupBefore + 1);

  const event = (await previewEvents(page)).find((e) => e.targetId === 'market-01' && e.surface === 'list')!;
  expect(Object.keys(event).sort()).toEqual(['count', 'day', 'id', 'surface', 'targetId', 'targetKind']);
});

test('DATA-4 and DEMO-2: the map opens a preview with the Demo mark and counts it; the count survives a reload', async ({
  page,
}) => {
  await page.goto('/map?view=map');
  await expect(page.locator('.maplibregl-map')).toBeVisible();
  const pin = page.getByRole('button', { name: /Farmers market: Delta Saturday Stalls/ });
  await expect(pin).toBeVisible();
  await centreMap(page);
  const before = total(await previewEvents(page), 'market-01', 'map');

  await pin.click();
  const preview = page.getByRole('region', { name: /Details for Delta Saturday Stalls/ });
  await expect(preview).toBeVisible();
  await expect(preview).toContainText('Demo');
  await expect(preview).toContainText('Farmers who sell here');
  await expect.poll(async () => total(await previewEvents(page), 'market-01', 'map')).toBe(before + 1);

  await page.reload();
  expect(total(await previewEvents(page), 'market-01', 'map')).toBe(before + 1);
});

test('the preview closes with Escape and focus returns to the pin', async ({ page }) => {
  await page.goto('/map?view=map');
  const pin = page.getByRole('button', { name: /Farmers market: Delta Saturday Stalls/ });
  await expect(pin).toBeVisible();
  await centreMap(page);
  await pin.click();
  const preview = page.getByRole('region', { name: /Details for Delta Saturday Stalls/ });
  await expect(preview).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(preview).toHaveCount(0);
  await expect(pin).toBeFocused();
});

test('PRIV-1: farm pins carry no address, phone or email and say they sit at the town centre', async ({ page }) => {
  await page.goto('/map?view=map');
  await expect(page.locator('.maplibregl-map')).toBeVisible();
  const farmPin = page.getByRole('button', { name: /Pelican Slough Orchard, farm near Lake Village/ });
  await expect(farmPin).toBeVisible();
  await centreMap(page);
  await farmPin.click();
  const preview = page.locator('.map-preview');
  await expect(preview).toBeVisible();
  const text = await preview.innerText();
  expect(text).not.toMatch(/\d{3}-\d{3}-\d{4}|@|\d+ \w+ (Road|Street|Lane|Drive)/i);
  expect(text).toMatch(/General location|Shown at the centre|exact location/);
  await expect(preview).toContainText('Demo');
});

test('the markets list is reachable and every market has a Demo mark', async ({ page }) => {
  await page.goto('/farmers-markets');
  await expect(page.getByRole('heading', { name: 'Farmers markets', level: 1 })).toBeVisible();
  const cards = page.getByRole('article');
  await expect(cards.first()).toBeVisible();
  for (let i = 0; i < (await cards.count()); i++) await expect(cards.nth(i)).toContainText('Demo');
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Map' }).click();
  await expect(page).toHaveURL(/\/map/);
});

test('A11Y: no axe violations on the list or the map (colour contrast is checked by the token test)', async ({ page }) => {
  for (const view of ['/map', '/map?view=map']) {
    await page.goto(view);
    await expect(page.locator('.place-row, .maplibregl-map').first()).toBeVisible();
    if (view.includes('map')) await page.waitForTimeout(1500);
    const results = await new AxeBuilder({ page }).disableRules(['color-contrast']).analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
  }
});
