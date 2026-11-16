import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { findPrivateLeaks } from '@/domain/privacy/leaks';
import type { Database } from '@/domain/types';
import { defaultSettings } from '@/config/settings';
import { buildSeed } from '../../seed';
import { createDemoServices } from './index';
import { createMemoryStorage } from './store';

const NOW = new Date('2026-11-15T15:00:00.000Z');
const seed: Database = buildSeed(NOW, defaultSettings);

function services() {
  return createDemoServices({ clock: { now: () => NOW }, storage: createMemoryStorage() });
}

describe('public gateway methods never leak private data', () => {
  it('returns nothing private from any public method over the full seed', async () => {
    const { gateway } = services();
    const results = {
      settings: await gateway.getSettings(),
      regions: await gateway.listRegions(),
      communities: await gateway.listCommunities(),
      productTypes: await gateway.listProductTypes(),
      farms: await gateway.listPublicFarms(),
      farmBySlug: await Promise.all(seed.farmer_profiles.map((f) => gateway.getPublicFarmBySlug(f.slug))),
      products: await gateway.listPublicProducts(),
      markets: await gateway.listPublicMarkets(),
      pickupLocations: await gateway.listPublicPickupLocations(),
    };
    expect(results.farms.length).toBeGreaterThan(0);
    expect(results.products.length).toBeGreaterThan(0);
    expect(findPrivateLeaks(results, seed)).toEqual([]);
    // Belt and braces: no private string appears in the serialised output.
    const text = JSON.stringify(results);
    for (const l of seed.farm_private_locations) expect(text).not.toContain(l.streetAddress);
    for (const c of seed.inquiry_buyer_contacts) {
      expect(text).not.toContain(c.name);
      if (c.phone) expect(text).not.toContain(c.phone);
      if (c.email) expect(text).not.toContain(c.email);
    }
  });

  it('shows a phone or email only where the farmer opted in', async () => {
    const farms = await services().gateway.listPublicFarms();
    for (const farm of farms) {
      const profile = seed.farmer_profiles.find((p) => p.id === farm.id)!;
      const contact = seed.farmer_private_contacts.find((c) => c.farmerProfileId === farm.id)!;
      expect(farm.contact.phone).toBe(profile.showPhone ? contact.phone : null);
      expect(farm.contact.email).toBe(profile.showEmail ? contact.email : null);
    }
    expect(farms.filter((f) => f.contact.phone)).toHaveLength(3);
    expect(farms.filter((f) => f.contact.email)).toHaveLength(2);
  });

  it('gives town-centre points unless the farmer opted in to the exact one', async () => {
    const farms = await services().gateway.listPublicFarms();
    for (const farm of farms) {
      const profile = seed.farmer_profiles.find((p) => p.id === farm.id)!;
      const centre = seed.communities.find((c) => c.id === profile.communityId)!.centre;
      if (profile.showExactLocation) {
        expect(farm.location.precision).toBe('exact');
        expect(farm.location.point).not.toEqual(centre);
      } else {
        expect(farm.location.precision).toBe('town_centre');
        expect(farm.location.point).toEqual(centre);
      }
    }
    expect(farms.filter((f) => f.location.precision === 'exact')).toHaveLength(3);
  });

  it('leaves the draft farm and the hidden product out of every result', async () => {
    const { gateway } = services();
    const draft = seed.farmer_profiles.find((f) => f.publicationStatus === 'draft')!;
    const hidden = seed.products.filter((p) => p.moderationStatus === 'hidden');
    expect(hidden).toHaveLength(1);
    expect(await gateway.getPublicFarmBySlug(draft.slug)).toBeNull();
    const text = JSON.stringify([
      await gateway.listPublicFarms(),
      await gateway.listPublicProducts(),
      await gateway.listPublicMarkets(),
      await gateway.listPublicPickupLocations(),
    ]);
    expect(text).not.toContain(draft.id);
    expect(text).not.toContain(draft.slug);
    expect(text).not.toContain(draft.farmName);
    for (const p of hidden) {
      expect(text).not.toContain(p.id);
      expect(text).not.toContain(p.title);
    }
    for (const p of seed.products.filter((x) => x.farmerProfileId === draft.id)) expect(text).not.toContain(p.id);
  });

  it('returns copies, so a caller cannot change the store', async () => {
    const { gateway } = services();
    const first = await gateway.listPublicProducts();
    first[0]!.title = 'Changed by the caller';
    expect((await gateway.listPublicProducts())[0]!.title).not.toBe('Changed by the caller');
  });

  it('keeps the gateway source away from the private collections', () => {
    const source = readFileSync(join(__dirname, 'gateway.ts'), 'utf8');
    for (const name of ['farm_private_locations', 'farmer_private_contacts', 'inquiry_buyer_contacts']) {
      expect(source).not.toContain(name);
    }
  });
});
