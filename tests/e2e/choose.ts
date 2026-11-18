import type { Locator, Page } from '@playwright/test';

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Picks an option in Musoko's custom dropdown (the Select primitive renders a
 * listbox, not a native <select>). `option` is the visible label, or an index.
 */
export async function choose(scope: Page | Locator, label: string, option: string | { index: number }) {
  // The trigger is named "Label" or "Label: current value".
  await scope.getByRole('button', { name: new RegExp(`^${escape(label)}(:|$)`) }).first().click();
  const list = scope.getByRole('listbox', { name: label });
  const items = list.getByRole('option');
  if (typeof option === 'string') {
    const search = list.getByRole('textbox');
    if (await search.count()) await search.fill(option);
    await items.filter({ hasText: new RegExp(`^${escape(option)}$`) }).first().click();
  } else {
    await items.nth(option.index).click();
  }
}
