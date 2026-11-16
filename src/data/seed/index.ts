/**
 * Demo seed. Everything here is fictional: farms, people, markets, phones
 * (870-555-01xx), emails (.example) and street addresses. Town centres are real
 * Delta communities; private exact points are invented and are not addresses.
 *
 * Every date is an offset from `now`, resolved when the seed is built.
 *
 * Rule for later steps: any change to this seed, or to the Database shape,
 * bumps DEMO_SCHEMA_VERSION in adapters/demo/store.ts.
 *
 * SEED id to records
 *  SEED-1   farms.ts FARM_SPECS: 12 profiles. Helena-West Helena farm-01..03, Pine Bluff farm-04..05,
 *           Forrest City farm-06..07, Marianna farm-08, Stuttgart farm-09, Dumas farm-10,
 *           Wynne farm-11 (draft), Lake Village farm-12. None in Clarendon.
 *  SEED-2   products.ts PRODUCT_SPECS: 41 visible products on published farms, all eight categories.
 *           24 fresh (F), 1 on watch at 13 days (prod-003), 6 lapsed (L: prod-004, 005, 017, 029, 038, 039),
 *           7 coming soon (C), 3 unconfirmed (U). prod-011 is hidden. prod-043 and 044 belong to the draft farm.
 *  SEED-3   Tomatoes: prod-003 by lb (farm-01), prod-025 5 lb box (farm-06), prod-016 10 lb box (farm-04),
 *           prod-007 pint of cherry tomatoes (no conversion). Eggs: prod-008 dozen, prod-009 half dozen, prod-033 flat of 30.
 *           Milk: prod-036 half gallon, prod-037 gallon. Honey: prod-012 12 oz, prod-013 1 lb.
 *           No conversion: prod-001 collards bunch, prod-041 peaches basket, prod-032 watermelon each.
 *  SEED-4   claims.ts: 20 claims, 3 verified (claim-18 to 20: licence, certification, licence on farm-02, 09, 10), none SNAP/EBT.
 *  SEED-5   events.ts: 40 search events over 30 days (7 or more with resultCount 0, three in Clarendon),
 *           12 preview events, 7 aggregate counts older than searchEventRetentionDays (their searches are long deleted).
 *  SEED-6   products.ts: 15 quantity rows. prod-008 is fresh available_now with about 3 dozen.
 *  SEED-7   farms.ts: farm-11 is an administrator-created draft with no consent. farm-08 is published with
 *           farmerReviewedLatestChanges false. Consent methods: farmer_signed_in (farm-01), in_person, by_phone, signed_form.
 *  SEED-8   Lake Village: one farm, 2 searches, 1 inquiry. Clarendon: searches, no farm.
 *  SEED-9   markets.ts 5 markets in 5 communities, pickups.ts 3 pickup locations, options for every published farm,
 *           own_delivery on farm-01, 03, 07, 10.
 *  SEED-10  farms.ts: exact location on farm-01, 06, 09; phone on farm-01, 02, 10; email on farm-01, 06.
 *           Every farm has a private location and a private contact row.
 *  SEED-11  claims.ts: farmer-reported snap_ebt on farm-01, 06, 08.
 *  SEED-12  inquiries.ts: 10 inquiries (3 awaiting, 3 responded, 4 closed). inq-10 has no buyer contact row.
 *  SEED-13  users.ts: user-demo-farmer (owns farm-01), user-demo-buyer, user-demo-admin. DEMO_ACCOUNTS.
 */
import type { Database, Settings } from '@/domain/types';
import { buildClaims } from './claims';
import { buildCommunities } from './communities';
import { buildAggregateCounts, buildPreviewEvents, buildSearchEvents } from './events';
import { buildFarms } from './farms';
import { buildInquiries } from './inquiries';
import { buildMarkets } from './markets';
import { buildPickupLocations, buildPickupOptions } from './pickups';
import { buildProductTypes } from './product-types';
import { buildProducts } from './products';
import { buildRegions } from './regions';
import { buildUsers } from './users';

export { DEMO_ACCOUNTS } from './users';

/** Pure and deterministic for a given `now`. */
export function buildSeed(now: Date, settings: Settings): Database {
  const farms = buildFarms(now);
  const productTypes = buildProductTypes();
  const products = buildProducts(now, productTypes);
  const markets = buildMarkets();
  const inquiries = buildInquiries(now);
  const users = buildUsers(now);

  return {
    regions: buildRegions(),
    communities: buildCommunities(),
    users: users.users,
    user_roles: users.roles,
    farmer_profiles: farms.profiles,
    farm_public_locations: farms.publicLocations,
    farm_private_locations: farms.privateLocations,
    farmer_private_contacts: farms.privateContacts,
    product_types: productTypes,
    products: products.products,
    product_availability: products.availability,
    product_availability_history: products.history,
    product_quantities: products.quantities,
    farmers_markets: markets.markets,
    farmer_market_links: markets.links,
    pickup_locations: buildPickupLocations(),
    farmer_pickup_options: buildPickupOptions(),
    inquiries: inquiries.inquiries,
    inquiry_buyer_contacts: inquiries.contacts,
    inquiry_replies: inquiries.replies,
    inquiry_outcomes: inquiries.outcomes,
    claims: buildClaims(now),
    search_events: buildSearchEvents(now),
    preview_events: buildPreviewEvents(now),
    aggregate_counts: buildAggregateCounts(now, settings.searchEventRetentionDays),
    settings: { ...settings },
  };
}
