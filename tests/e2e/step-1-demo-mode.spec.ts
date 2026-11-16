import { expect, test, type Page } from '@playwright/test';

/**
 * Step 1: DEMO-1, MODE-1, MODE-3, MODE-4, DONE-1.
 * Below 1200px the role switcher and reset sit in the "Demo settings" sheet,
 * so these helpers open it first when the button is there.
 */

const STATEMENT = 'Demonstration data. Farms, prices and availability are fictional.';
const LAPSED = 'listing-prod-004';

async function openSettings(page: Page) {
  const button = page.getByRole('button', { name: 'Demo settings' });
  if (await button.isVisible()) {
    await button.click();
    await expect(page.getByRole('dialog', { name: 'Demo settings' })).toBeVisible();
  }
}

async function closeSettings(page: Page) {
  const dialog = page.getByRole('dialog', { name: 'Demo settings' });
  if (await dialog.isVisible()) {
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  }
}

async function switchRole(page: Page, role: 'Buyer' | 'Farmer' | 'Administrator') {
  await openSettings(page);
  const radio = page.getByRole('radio', { name: role });
  await page.locator('label', { has: radio }).click();
  await expect(radio).toBeChecked();
  await closeSettings(page);
}

test.describe('demo mode', () => {
  test('DEMO-1: the demo statement is real text on every route', async ({ page }) => {
    for (const path of ['/', '/styleguide']) {
      await page.goto(path);
      await expect(page.getByRole('complementary', { name: 'Demo mode' })).toContainText(STATEMENT);
    }
  });

  test('the theme survives a reload and is set before first paint', async ({ page }) => {
    await page.goto('/');
    const start = await page.locator('html').getAttribute('data-theme');
    const next = start === 'yellow' ? 'green' : 'yellow';
    await page.getByRole('button', { name: `Switch to the ${next} theme` }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', next);

    // The inline script runs while the document is still parsing.
    await page.addInitScript(() => {
      document.addEventListener('DOMContentLoaded', () => {
        (window as unknown as { __themeAtParse: string | null }).__themeAtParse =
          document.documentElement.getAttribute('data-theme');
      });
    });
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', next);
    expect(await page.evaluate(() => (window as unknown as { __themeAtParse: string }).__themeAtParse)).toBe(next);
  });

  test('MODE-1 and MODE-4: a confirmed listing and the role survive reload and role switch; reset restores', async ({
    page,
  }) => {
    await page.goto('/styleguide#demo-data');
    const listing = page.getByTestId(LAPSED);
    await expect(listing).toBeVisible();
    await expect(listing.getByTestId('listing-status')).toHaveText('Availability unconfirmed');

    // A buyer cannot confirm: the button explains itself through the sentence above.
    await expect(page.getByText('Switch to Farmer in the demo strip to confirm listings.')).toBeVisible();

    await switchRole(page, 'Farmer');
    await listing.scrollIntoViewIfNeeded();
    await listing.getByRole('button', { name: 'Still available' }).click();
    await expect(listing.getByRole('status')).toHaveText('Confirmed just now');
    await expect(listing.getByTestId('listing-status')).toHaveText('Available now');

    await page.reload();
    await expect(page.getByTestId(LAPSED).getByTestId('listing-status')).toHaveText('Available now');
    // The role survived the reload too.
    await openSettings(page);
    await expect(page.getByRole('radio', { name: 'Farmer' })).toBeChecked();
    await closeSettings(page);

    await switchRole(page, 'Buyer');
    await expect(page.getByTestId(LAPSED).getByTestId('listing-status')).toHaveText('Available now');

    // MODE-3: reset restores the seed, and says so only after it has.
    await openSettings(page);
    await page.getByRole('button', { name: 'Reset demo data' }).first().click();
    const confirm = page.getByRole('dialog', { name: 'Reset demo data' });
    await expect(confirm).toBeVisible();
    await confirm.getByRole('button', { name: 'Reset demo data' }).click();
    await expect(page.getByRole('complementary', { name: 'Demo mode' })).toContainText('Demo data was restored.');
    await expect(page.getByTestId(LAPSED).getByTestId('listing-status')).toHaveText('Availability unconfirmed');
  });
});
