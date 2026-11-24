import { describe, expect, it } from 'vitest';
import { defaultSettings } from '@/config/settings';
import { effectiveStatus } from '@/domain/availability';
import { isPubliclyVisible } from '@/domain/privacy';
import type { Database } from '@/domain/types';
import { normalizedUnitPrice } from '@/domain/units';
import { buildSeed, DEMO_ACCOUNTS } from './index';

const NOW = new Date('2026-11-15T15:00:00.000Z');
const db: Database = buildSeed(NOW, defaultSettings);
const DAY = 86_400_000;

const visibleProducts = db.products.filter((p) => p.moderationStatus === 'visible');
const publicFarmIds = new Set(db.farmer_profiles.filter(isPubliclyVisible).map((f) => f.id));
const publicProducts = visibleProducts.filter((p) => publicFarmIds.has(p.farmerProfileId));
const availOf = (id: string) => db.product_availability.find((a) => a.productId === id)!;
const effective = (id: string) => effectiveStatus(availOf(id), NOW, db.settings);
const slug = (id: string) => db.communities.find((c) => c.id === id)!.slug;
const farmsIn = (s: string) => db.farmer_profiles.filter((f) => slug(f.communityId) === s);

function km(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const r = (x: number) => (x * Math.PI) / 180;
  const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}

describe('seed integrity', () => {
  it('is deterministic for a given now', () => {
    expect(buildSeed(NOW, defaultSettings)).toEqual(buildSeed(NOW, defaultSettings));
  });

  it('has valid foreign keys everywhere', () => {
    const ids = (rows: { id: string }[]) => new Set(rows.map((r) => r.id as string));
    const farm = ids(db.farmer_profiles);
    const com = ids(db.communities);
    const user = ids(db.users);
    const type = ids(db.product_types);
    const prod = ids(db.products);
    const market = ids(db.farmers_markets);
    const pickup = ids(db.pickup_locations);
    const option = ids(db.farmer_pickup_options);
    const inq = ids(db.inquiries);
    const ok = (set: Set<string>, v: string | null) => v === null || set.has(v);

    for (const c of db.communities) expect(db.regions.map((r) => r.id)).toContain(c.regionId);
    for (const f of db.farmer_profiles) {
      expect(ok(user, f.userId)).toBe(true);
      expect(user.has(f.createdBy)).toBe(true);
      expect(ok(user, f.consentRecordedBy)).toBe(true);
      expect(ok(user, f.reviewRecordedBy)).toBe(true);
      expect(com.has(f.communityId)).toBe(true);
    }
    for (const t of [db.farm_public_locations, db.farm_private_locations, db.farmer_private_contacts]) {
      expect(t).toHaveLength(db.farmer_profiles.length);
      for (const r of t) expect(farm.has(r.farmerProfileId)).toBe(true);
    }
    for (const l of db.farm_public_locations) expect(com.has(l.communityId)).toBe(true);
    for (const p of db.products) {
      expect(farm.has(p.farmerProfileId)).toBe(true);
      expect(type.has(p.productTypeId)).toBe(true);
    }
    for (const t of [db.product_availability, db.product_availability_history, db.product_quantities]) {
      for (const r of t) expect(prod.has(r.productId)).toBe(true);
    }
    expect(db.product_availability).toHaveLength(db.products.length);
    for (const m of db.farmers_markets) expect(com.has(m.communityId)).toBe(true);
    for (const l of db.farmer_market_links) { expect(farm.has(l.farmerProfileId)).toBe(true); expect(market.has(l.marketId)).toBe(true); }
    for (const p of db.pickup_locations) expect(com.has(p.communityId)).toBe(true);
    for (const o of db.farmer_pickup_options) {
      expect(farm.has(o.farmerProfileId)).toBe(true);
      expect(ok(pickup, o.pickupLocationId)).toBe(true);
      expect(ok(market, o.marketId)).toBe(true);
      if (o.kind === 'pickup_location') expect(o.pickupLocationId).not.toBeNull();
      if (o.kind === 'farmers_market') expect(o.marketId).not.toBeNull();
    }
    for (const i of db.inquiries) {
      expect(farm.has(i.farmerProfileId)).toBe(true);
      expect(ok(prod, i.productId)).toBe(true);
      expect(ok(type, i.productTypeId)).toBe(true);
      expect(ok(com, i.communityId)).toBe(true);
      expect(ok(option, i.pickupOptionId)).toBe(true);
      expect(ok(pickup, i.pickupLocationId)).toBe(true);
      expect(ok(market, i.marketId)).toBe(true);
    }
    for (const r of [...db.inquiry_buyer_contacts, ...db.inquiry_replies, ...db.inquiry_outcomes]) expect(inq.has(r.inquiryId)).toBe(true);
    for (const c of db.claims) {
      expect(farm.has(c.farmerProfileId)).toBe(true);
      if (c.verification) expect(user.has(c.verification.verifiedBy)).toBe(true);
    }
    for (const e of db.search_events) { expect(ok(com, e.communityId)).toBe(true); expect(ok(type, e.matchedProductTypeId)).toBe(true); }
    for (const a of db.aggregate_counts) {
      expect(ok(type, a.productTypeId)).toBe(true); expect(ok(com, a.communityId)).toBe(true);
      expect(ok(pickup, a.pickupLocationId)).toBe(true); expect(ok(market, a.marketId)).toBe(true);
    }
    for (const u of db.user_roles) expect(user.has(u.userId)).toBe(true);
  });

  it('keeps every published profile visible and every id unique', () => {
    for (const f of db.farmer_profiles.filter((p) => p.publicationStatus === 'published')) expect(isPubliclyVisible(f)).toBe(true);
    for (const [name, rows] of Object.entries(db)) {
      if (!Array.isArray(rows)) continue;
      const ids = rows.map((r) => (r as { id?: string }).id).filter((v): v is string => typeof v === 'string');
      expect(new Set(ids).size, name).toBe(ids.length);
    }
  });

  it('stores the computed normalised unit price', () => {
    for (const p of db.products) {
      const type = db.product_types.find((t) => t.id === p.productTypeId)!;
      expect(p.normalizedUnitPriceCents).toBe(normalizedUnitPrice(p, type)?.cents ?? null);
    }
  });

  it('puts no exact point on a community centre, and keeps it 3 to 12 km out', () => {
    for (const loc of db.farm_private_locations) {
      const centre = db.farm_public_locations.find((l) => l.farmerProfileId === loc.farmerProfileId)!.coarsePoint;
      expect(loc.exactPoint).not.toEqual(centre);
      const d = km(centre, loc.exactPoint);
      expect(d).toBeGreaterThanOrEqual(3);
      expect(d).toBeLessThanOrEqual(12);
    }
  });

  it('is fictional throughout', () => {
    const farmerPhones = new Set(db.farmer_private_contacts.map((c) => c.phone));
    for (const c of db.farmer_private_contacts) {
      expect(c.phone).toMatch(/^870-555-01\d\d$/);
      expect(c.email).toMatch(/\.example$/);
    }
    for (const l of db.farm_private_locations) expect(l.streetAddress).toContain('Demo');
    for (const m of db.farmers_markets.filter((x) => x.isDemo)) {
      expect(farmerPhones.has(m.contactPhone)).toBe(false);
      expect(m.contactEmail).toMatch(/\.example$/);
    }
    for (const c of db.inquiry_buyer_contacts) {
      if (c.phone) expect(c.phone).toMatch(/^870-555-01\d\d$/);
      if (c.email) expect(c.email).toMatch(/\.example$/);
    }
    for (const r of [...db.farmer_profiles, ...db.products, ...db.pickup_locations, ...db.institutions]) expect(r.isDemo).toBe(true);
    for (const c of db.institution_contacts) expect(c.email).toMatch(/\.example$/);
    expect(JSON.stringify(db)).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgb\(/);
  });
});

describe('SEED-1 farms', () => {
  it('has 12 profiles in the right communities', () => {
    expect(db.farmer_profiles).toHaveLength(12);
    expect(farmsIn('helena-west-helena')).toHaveLength(3);
    expect(farmsIn('pine-bluff')).toHaveLength(2);
    expect(farmsIn('forrest-city')).toHaveLength(2);
    expect(farmsIn('lake-village')).toHaveLength(1);
    expect(farmsIn('clarendon')).toHaveLength(0);
    expect(new Set(db.farmer_profiles.map((f) => f.communityId)).size).toBeGreaterThanOrEqual(7);
  });
});

describe('SEED-2 products', () => {
  it('has about 40 visible products over all eight categories and every status', () => {
    expect(publicProducts.length).toBeGreaterThanOrEqual(38);
    expect(publicProducts.length).toBeLessThanOrEqual(45);
    const cats = new Set(publicProducts.map((p) => db.product_types.find((t) => t.id === p.productTypeId)!.category));
    expect(cats.size).toBe(8);
    const fresh = publicProducts.filter((p) => {
      const a = availOf(p.id);
      return a.status === 'available_now' && NOW.getTime() - Date.parse(a.lastConfirmedAt!) <= 10 * DAY;
    });
    expect(fresh.length).toBeGreaterThanOrEqual(22);
    expect(fresh.length).toBeLessThanOrEqual(27);
    const coming = publicProducts.filter((p) => availOf(p.id).status === 'coming_soon');
    expect(coming).toHaveLength(7);
    for (const p of coming) expect(effective(p.id)).toBe('coming_soon');
    const lapsed = publicProducts.filter((p) => {
      const a = availOf(p.id);
      const age = a.lastConfirmedAt ? (NOW.getTime() - Date.parse(a.lastConfirmedAt)) / DAY : 0;
      return a.status === 'available_now' && age >= 15 && age <= 40;
    });
    expect(lapsed).toHaveLength(6);
    for (const p of lapsed) expect(effective(p.id)).toBe('unconfirmed');
    expect(publicProducts.filter((p) => availOf(p.id).status === 'unconfirmed')).toHaveLength(3);
    const watch = publicProducts.filter((p) => {
      const a = availOf(p.id);
      return a.status === 'available_now' && Math.round((NOW.getTime() - Date.parse(a.lastConfirmedAt!)) / DAY) === 13;
    });
    expect(watch).toHaveLength(1);
    expect(effective(watch[0]!.id)).toBe('available_now');
  });
  it('has one hidden product', () => {
    expect(db.products.filter((p) => p.moderationStatus === 'hidden')).toHaveLength(1);
  });
});

describe('SEED-3 unit variety', () => {
  const byType = (slugName: string) => {
    const t = db.product_types.find((x) => x.slug === slugName)!;
    return db.products.filter((p) => p.productTypeId === t.id);
  };
  it('has tomatoes per lb, 5 lb box and 10 lb box on three farms, and a pint with no conversion', () => {
    const tom = byType('tomatoes');
    const sizes = tom.map((p) => `${p.unitSize?.amount}${p.unitSize?.measure}`);
    expect(sizes).toEqual(expect.arrayContaining(['1lb', '5lb', '10lb', '1pint']));
    expect(new Set(tom.filter((p) => p.unitSize?.measure === 'lb').map((p) => p.farmerProfileId)).size).toBe(3);
    expect(tom.find((p) => p.unitSize?.measure === 'pint')!.normalizedUnitPriceCents).toBeNull();
  });
  it('has eggs, milk and honey in several sizes and unconvertible listings', () => {
    expect(byType('eggs').map((p) => p.sellingUnit)).toEqual(expect.arrayContaining(['dozen', 'carton', 'flat']));
    expect(byType('milk').map((p) => p.sellingUnit)).toEqual(expect.arrayContaining(['half_gallon', 'gallon']));
    expect(byType('honey').map((p) => `${p.unitSize?.amount}${p.unitSize?.measure}`)).toEqual(expect.arrayContaining(['12oz', '1lb']));
    expect(byType('collard-greens').some((p) => p.sellingUnit === 'bunch' && p.normalizedUnitPriceCents === null)).toBe(true);
    expect(byType('peaches').some((p) => p.sellingUnit === 'basket' && p.normalizedUnitPriceCents === null)).toBe(true);
    expect(byType('watermelon').some((p) => p.sellingUnit === 'each' && p.normalizedUnitPriceCents === null)).toBe(true);
  });
});

describe('SEED-4 and SEED-11 claims', () => {
  it('is mostly farmer-reported with three verified, none SNAP/EBT', () => {
    expect(db.claims.length).toBeGreaterThanOrEqual(18);
    expect(db.claims.length).toBeLessThanOrEqual(24);
    const verified = db.claims.filter((c) => c.status === 'verified');
    expect(verified).toHaveLength(3);
    expect(new Set(verified.map((c) => c.farmerProfileId)).size).toBe(3);
    for (const c of verified) {
      expect(['certification', 'licence']).toContain(c.type);
      expect(c.verification!.evidenceChecked.length).toBeGreaterThan(0);
      expect(c.verification!.verifiedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(c.verification!.verifiedBy).toBe(DEMO_ACCOUNTS.administrator.userId);
    }
    expect(db.claims.filter((c) => c.type === 'snap_ebt' && c.status === 'verified')).toHaveLength(0);
  });
  it('has SNAP/EBT on exactly three farms', () => {
    expect(new Set(db.claims.filter((c) => c.type === 'snap_ebt').map((c) => c.farmerProfileId)).size).toBe(3);
  });
});

describe('SEED-5 events', () => {
  const cutoff = NOW.getTime() - 30 * DAY;
  it('has about 40 recent search events, day only, some with no results', () => {
    expect(db.search_events.length).toBeGreaterThanOrEqual(38);
    for (const e of db.search_events) {
      expect(e.day).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Date.parse(e.day)).toBeGreaterThanOrEqual(cutoff - DAY);
      expect(e.terms.length).toBeLessThanOrEqual(db.settings.searchTermMaxLength);
    }
    const zero = db.search_events.filter((e) => e.resultCount === 0);
    expect(zero.length).toBeGreaterThanOrEqual(6);
    expect(zero.some((e) => slug(e.communityId!) === 'clarendon')).toBe(true);
  });
  it('has preview events and aggregates older than the retention period', () => {
    expect(db.preview_events.length).toBeGreaterThanOrEqual(10);
    expect(db.aggregate_counts.length).toBeGreaterThanOrEqual(3);
    for (const a of db.aggregate_counts) {
      expect(NOW.getTime() - Date.parse(a.periodEnd)).toBeGreaterThan(db.settings.searchEventRetentionDays * DAY);
    }
  });
});

describe('SEED-6 quantities', () => {
  it('has about 15 quantity rows and one small fresh available listing', () => {
    expect(db.product_quantities.length).toBeGreaterThanOrEqual(13);
    expect(db.product_quantities.length).toBeLessThan(publicProducts.length);
    const small = db.product_quantities.filter((q) => q.amount <= 3 && effective(q.productId) === 'available_now');
    expect(small.length).toBeGreaterThanOrEqual(1);
    expect(small[0]).toMatchObject({ amount: 3, unit: 'dozen' });
  });
});

describe('SEED-7 consent and review', () => {
  it('has one admin-created draft and one published profile awaiting farmer review', () => {
    const drafts = db.farmer_profiles.filter((f) => f.publicationStatus === 'draft');
    expect(drafts).toHaveLength(1);
    expect(drafts[0]).toMatchObject({ createdByRole: 'administrator', userId: null, consentMethod: null, consentDate: null, consentRecordedBy: null });
    const published = db.farmer_profiles.filter((f) => f.publicationStatus === 'published');
    const unreviewed = published.filter((f) => !f.farmerReviewedLatestChanges);
    expect(unreviewed).toHaveLength(1);
    expect(published.filter((f) => f.farmerReviewedLatestChanges)).toHaveLength(published.length - 1);
    for (const f of published) expect(f.consentMethod).not.toBeNull();
    expect(new Set(published.map((f) => f.consentMethod))).toEqual(new Set(['farmer_signed_in', 'in_person', 'by_phone', 'signed_form']));
  });
});

describe('SEED-8 thin communities', () => {
  it('has Lake Village below the minimum sample and Clarendon with searches but no farm', () => {
    const min = db.settings.minimumSampleSize;
    const lvId = db.communities.find((c) => c.slug === 'lake-village')!.id;
    expect(db.search_events.filter((e) => e.communityId === lvId).length).toBeLessThan(min);
    expect(db.inquiries.filter((i) => i.communityId === lvId).length).toBeLessThan(min);
    const clId = db.communities.find((c) => c.slug === 'clarendon')!.id;
    expect(db.search_events.filter((e) => e.communityId === clId).length).toBeGreaterThan(0);
    expect(db.farmer_profiles.filter((f) => f.communityId === clId)).toHaveLength(0);
  });
});

describe('SEED-9 markets and pickups', () => {
  it('has 5 markets in 5 communities, 3 pickups, options for every published farm, 3 or more delivering', () => {
    const demo = db.farmers_markets.filter((m) => m.isDemo);
    expect(demo).toHaveLength(5);
    expect(new Set(demo.map((m) => m.communityId)).size).toBe(5);
    expect(db.pickup_locations).toHaveLength(3);
    for (const f of db.farmer_profiles.filter((p) => p.publicationStatus === 'published')) {
      expect(db.farmer_pickup_options.some((o) => o.farmerProfileId === f.id), f.farmName).toBe(true);
    }
    expect(new Set(db.farmer_pickup_options.filter((o) => o.kind === 'own_delivery').map((o) => o.farmerProfileId)).size).toBeGreaterThanOrEqual(3);
    // a market option agrees with the market link
    for (const o of db.farmer_pickup_options.filter((x) => x.kind === 'farmers_market')) {
      expect(db.farmer_market_links.some((l) => l.farmerProfileId === o.farmerProfileId && l.marketId === o.marketId)).toBe(true);
    }
  });
});

describe('SEED-10 privacy mix', () => {
  it('has 3 exact, 3 phone and 2 email opt-ins with partial overlap', () => {
    const by = (k: 'showExactLocation' | 'showPhone' | 'showEmail') => db.farmer_profiles.filter((f) => f[k]).map((f) => f.id);
    expect(by('showExactLocation')).toHaveLength(3);
    expect(by('showPhone')).toHaveLength(3);
    expect(by('showEmail')).toHaveLength(2);
    const overlap = by('showPhone').filter((id) => by('showEmail').includes(id));
    expect(overlap.length).toBeGreaterThan(0);
    expect(overlap.length).toBeLessThan(2);
    for (const f of db.farmer_profiles) {
      expect(db.farm_private_locations.some((l) => l.farmerProfileId === f.id)).toBe(true);
      expect(db.farmer_private_contacts.some((l) => l.farmerProfileId === f.id)).toBe(true);
    }
  });
});

describe('SEED-12 inquiries', () => {
  it('has all three statuses and the required closures', () => {
    const count = (s: string) => db.inquiries.filter((i) => i.status === s).length;
    expect(db.inquiries).toHaveLength(10);
    expect(count('awaiting_response')).toBe(3);
    expect(count('responded')).toBe(3);
    expect(count('closed')).toBe(4);
    const reminderMs = db.settings.inquiryReminderHours * 3_600_000;
    expect(db.inquiries.some((i) => i.status === 'awaiting_response' && i.reminderSentAt && NOW.getTime() - Date.parse(i.createdAt) > reminderMs)).toBe(true);
    const kinds = db.inquiry_replies.filter((r) => db.inquiries.find((i) => i.id === r.inquiryId)!.status === 'responded').map((r) => r.kind);
    expect(new Set(kinds)).toEqual(new Set(['available', 'sold_out', 'contact_me']));
    expect(db.inquiry_replies.some((r) => r.kind === 'contact_me' && r.phoneShared)).toBe(true);
    const reasons = db.inquiries.filter((i) => i.status === 'closed').map((i) => i.closedReason);
    expect(reasons.sort()).toEqual(['auto_after_response', 'outcome_recorded', 'outcome_recorded', 'unanswered']);
    expect(db.inquiry_outcomes.map((o) => o.outcome).sort()).toEqual(['new_potential_customer', 'sale']);
    expect(db.inquiries.filter((i) => i.farmerProfileId === DEMO_ACCOUNTS.farmer.farmerProfileId).length).toBeGreaterThanOrEqual(8);
    const orphaned = db.inquiries.filter((i) => !db.inquiry_buyer_contacts.some((c) => c.inquiryId === i.id));
    expect(orphaned).toHaveLength(1);
    expect(orphaned[0]!.status).toBe('closed');
  });
});

describe('SEED-13 accounts', () => {
  it('has one user per role and a demo farmer who owns a Helena-West Helena farm with lapsed listings', () => {
    expect(db.users).toHaveLength(3);
    expect(new Set(db.user_roles.map((r) => r.role))).toEqual(new Set(['farmer', 'buyer', 'administrator']));
    for (const role of ['farmer', 'buyer', 'administrator'] as const) {
      expect(db.user_roles.find((r) => r.userId === DEMO_ACCOUNTS[role].userId)!.role).toBe(role);
    }
    const farm = db.farmer_profiles.find((f) => f.id === DEMO_ACCOUNTS.farmer.farmerProfileId)!;
    expect(farm.userId).toBe(DEMO_ACCOUNTS.farmer.userId);
    expect(slug(farm.communityId)).toBe('helena-west-helena');
    const lapsed = db.products.filter((p) => p.farmerProfileId === farm.id && effective(p.id) === 'unconfirmed' && availOf(p.id).status === 'available_now');
    expect(lapsed.length).toBeGreaterThanOrEqual(2);
  });
});

describe('SEED-15 real farms and markets', () => {
  it('lists real markets with sources and no stored contact', () => {
    const real = db.farmers_markets.filter((m) => !m.isDemo);
    expect(real.length).toBeGreaterThanOrEqual(8);
    for (const m of real) {
      expect(m.sources?.length, m.name).toBeGreaterThan(0);
      expect(m.contactPhone).toBeNull();
      expect(m.contactEmail).toBeNull();
      expect(db.farmer_market_links.some((l) => l.marketId === m.id), m.name).toBe(false);
    }
  });

  it('keeps directory farms to public business facts: sources, a check date, no prices, no street address', () => {
    expect(db.directory_farms.some((f) => f.slug === 'sunlight-farm')).toBe(true);
    for (const f of db.directory_farms) {
      expect(f.sources.length, f.farmName).toBeGreaterThan(0);
      expect(f.checkedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(db.communities.some((c) => c.id === f.communityId)).toBe(true);
      const text = JSON.stringify(f);
      expect(text, f.farmName).not.toMatch(/\$\d/);
      expect(text, f.farmName).not.toMatch(/\b\d{3,6} (Hwy|Highway|Road|Rd|Street|St)\b/i);
      expect(text, f.farmName).not.toMatch(/\d{3}[-. ]\d{3}[-. ]\d{4}/);
    }
    expect(new Set(db.directory_farms.map((f) => f.slug)).size).toBe(db.directory_farms.length);
  });
});
