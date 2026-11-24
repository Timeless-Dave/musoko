import { buildFarmerPlanning } from '@/domain/planning';
import { confirmAvailability, isValidComingSoonMonth, markComingSoon, markUnavailable } from '@/domain/availability';
import { recordFarmerConsent, recordFarmerReview, republishProfile, unpublishProfile } from '@/domain/consent';
import {
  applyProfileEdit,
  availabilityChangeSchema,
  buildListing,
  buildQuantityRow,
  buildRegisteredFarm,
  checkPrivacyAgainstFile,
  farmerClaimsSchema,
  farmerNumbers,
  parseListingCreate,
  parseListingUpdate,
  parseProfile,
  parseRegistration,
  parseWith,
  pickupOptionsSchema,
  privacySchema,
  resolveListingFields,
  toOwnFarm,
  toOwnListings,
  type OwnFarm,
  type OwnListing,
} from '@/domain/farmer';
import {
  asId,
  type Claim,
  type ClaimId,
  type Community,
  type Database,
  type EventId,
  type FarmerPickupOption,
  type FarmerPickupOptionId,
  type FarmersMarketId,
  type PickupLocationId,
  type FarmerProfileId,
  type ProductId,
  type UserId,
} from '@/domain/types';
import { newId } from '@/lib/ids';
import type { Actor } from '../../ports/auth';
import { GatewayError } from '../../ports/errors';
import type { FarmerGateway } from '../../ports/farmer';
import { invalid, requireOwnFarm } from './access';
import { demoExactPoint, writeProfileEdit } from './profiles';
import type { DemoRuntime } from './store';

/**
 * Everything the farmer does to their own farm. This file reads the private
 * contact and address tables, so the public gateway never imports it.
 */

const copyOf = <T>(value: T): T => structuredClone(value);

function communityOf(db: Database, id: string): Community {
  const community = db.communities.find((c) => c.id === id);
  if (!community) throw invalid('Choose a town from the list.', { communityId: 'community_required' });
  return community;
}

function must<T>(parsed: { ok: true; value: T } | { ok: false; fields: Record<string, string> }, message: string): T {
  if (!parsed.ok) throw invalid(message, parsed.fields);
  return parsed.value;
}

function ownProduct(db: Database, farmId: FarmerProfileId, productId: ProductId) {
  const product = db.products.find((p) => p.id === productId);
  if (!product) throw new GatewayError('not_found', 'That listing does not exist.');
  if (product.farmerProfileId !== farmId) throw new GatewayError('forbidden', 'You can only change your own listings.');
  return product;
}

function view(db: Database, farmId: FarmerProfileId): OwnFarm {
  const own = toOwnFarm(db, farmId);
  if (!own) throw new GatewayError('not_found', 'That farm does not exist.');
  return copyOf(own);
}

export function createDemoFarmer(runtime: DemoRuntime): FarmerGateway {
  /** Runs a change on the latest state after the actor check, and resolves only once it is stored. */
  async function change(actor: Actor, apply: (db: Database, farm: ReturnType<typeof requireOwnFarm>, now: Date) => Database): Promise<Database> {
    await runtime.ready();
    const now = runtime.clock.now();
    let latest: Database | null = null;
    await runtime.commit((state) => {
      const farm = requireOwnFarm(state.db, actor);
      const db = apply(state.db, farm, now);
      latest = db;
      return { ...state, db };
    });
    return latest!;
  }

  async function read(actor: Actor): Promise<{ db: Database; farm: ReturnType<typeof requireOwnFarm>; now: Date }> {
    await runtime.ready();
    const { db } = runtime.read();
    return { db, farm: requireOwnFarm(db, actor), now: runtime.clock.now() };
  }

  function listing(db: Database, farmId: FarmerProfileId, productId: ProductId, now: Date): OwnListing {
    const found = toOwnListings(db, farmId, now).find((l) => l.product.id === productId);
    if (!found) throw new GatewayError('not_found', 'That listing does not exist.');
    return copyOf(found);
  }

  return {
    // ---------------------------------------------------------------- registration
    async registerFarmer(input) {
      await runtime.ready();
      const values = must(parseRegistration(input), 'The registration is not complete.');
      const now = runtime.clock.now();
      const userId = asId<UserId>(newId('user'));
      const profileId = asId<FarmerProfileId>(newId('farm'));

      await runtime.commit((state) => {
        const community = communityOf(state.db, values.communityId);
        const street = values.streetAddress?.trim() ? values.streetAddress.trim() : null;
        const built = buildRegisteredFarm({
          values,
          community,
          userId,
          profileId,
          takenSlugs: state.db.farmer_profiles.map((f) => f.slug),
          now,
          isDemo: true,
          exactPoint: street ? demoExactPoint(community.centre, street) : null,
        });
        const db: Database = {
          ...state.db,
          users: [...state.db.users, built.user],
          user_roles: [...state.db.user_roles, built.role],
          farmer_profiles: [...state.db.farmer_profiles, built.profile],
          farm_public_locations: [...state.db.farm_public_locations, built.publicLocation],
          farm_private_locations: built.privateLocation
            ? [...state.db.farm_private_locations, built.privateLocation]
            : state.db.farm_private_locations,
          farmer_private_contacts: [...state.db.farmer_private_contacts, built.contact],
        };
        // The browser is now signed in as the new farmer, so the dashboard opens on their own farm.
        return { ...state, db, session: { role: 'farmer', farmerUserId: userId } };
      });
      return { farmerProfileId: profileId, userId };
    },

    // ---------------------------------------------------------------- profile
    async getOwnFarm(actor) {
      const { db, farm } = await read(actor);
      return view(db, farm.id);
    },

    async updateOwnProfile(actor, input) {
      const values = must(parseProfile(input), 'The profile is not complete.');
      const db = await change(actor, (db, farm, now) => {
        const community = communityOf(db, values.communityId);
        return writeProfileEdit(db, farm.id, applyProfileEdit(farm, values, community, now), community);
      });
      return view(db, actor.farmerProfileId!);
    },

    async updateOwnPrivacy(actor, input) {
      const values = must(parseWith(privacySchema, input), 'Those settings are not valid.');
      const db = await change(actor, (db, farm, now) => {
        const contact = db.farmer_private_contacts.find((c) => c.farmerProfileId === farm.id);
        const address = db.farm_private_locations.find((l) => l.farmerProfileId === farm.id);
        const problems = checkPrivacyAgainstFile(values, {
          phone: contact?.phone ?? null,
          email: contact?.email ?? null,
          streetAddress: address?.streetAddress ?? null,
        });
        if (Object.keys(problems).length) throw invalid('Add that detail to your profile first.', problems);
        return {
          ...db,
          farmer_profiles: db.farmer_profiles.map((f) => (f.id === farm.id ? { ...f, ...values, updatedAt: now.toISOString() } : f)),
        };
      });
      return view(db, actor.farmerProfileId!);
    },

    async setOwnClaims(actor, input) {
      const claims = must(parseWith(farmerClaimsSchema, input), 'Those claims are not valid.');
      const db = await change(actor, (db, farm, now) => {
        const kept = db.claims.filter((c) => c.farmerProfileId !== farm.id || c.status === 'verified');
        const verifiedLabels = new Set(
          db.claims.filter((c) => c.farmerProfileId === farm.id && c.status === 'verified').map((c) => `${c.type}:${c.label.toLowerCase()}`),
        );
        const seen = new Set<string>();
        const reported: Claim[] = [];
        for (const claim of claims) {
          const key = `${claim.type}:${claim.label.toLowerCase()}`;
          if (seen.has(key) || verifiedLabels.has(key)) continue;
          seen.add(key);
          // Whatever a farmer enters is "farmer-reported". Only an administrator can verify a claim.
          reported.push({
            id: asId<ClaimId>(newId('claim')),
            farmerProfileId: farm.id,
            type: claim.type,
            label: claim.label,
            createdAt: now.toISOString(),
            status: 'farmer_reported',
            verification: null,
          });
        }
        return { ...db, claims: [...kept, ...reported] };
      });
      return view(db, actor.farmerProfileId!);
    },

    async setOwnPickupOptions(actor, input) {
      const options = must(parseWith(pickupOptionsSchema, input), 'Those pickup choices are not valid.');
      const db = await change(actor, (db, farm) => {
        const existing = db.farmer_pickup_options.filter((o) => o.farmerProfileId === farm.id);
        const next: FarmerPickupOption[] = [];
        const seen = new Set<string>();
        options.forEach((option, index) => {
          const marketId = option.kind === 'farmers_market' ? option.marketId : null;
          const pickupLocationId = option.kind === 'pickup_location' ? option.pickupLocationId : null;
          if (marketId !== null && !db.farmers_markets.some((m) => m.id === marketId && m.moderationStatus === 'visible')) {
            throw invalid('That market is not listed.', { [`${index}.marketId`]: 'option_target_required' });
          }
          if (pickupLocationId !== null && !db.pickup_locations.some((l) => l.id === pickupLocationId && l.moderationStatus === 'visible')) {
            throw invalid('That pickup point is not listed.', { [`${index}.pickupLocationId`]: 'option_target_required' });
          }
          const key = `${option.kind}:${marketId ?? pickupLocationId ?? ''}`;
          if (seen.has(key)) return;
          seen.add(key);
          // An option the farmer already had keeps its id and its days and hours.
          const match = existing.find((e) => e.kind === option.kind && e.marketId === marketId && e.pickupLocationId === pickupLocationId);
          next.push({
            id: match?.id ?? asId<FarmerPickupOptionId>(newId('option')),
            farmerProfileId: farm.id,
            kind: option.kind,
            pickupLocationId: pickupLocationId === null ? null : asId<PickupLocationId>(pickupLocationId),
            marketId: marketId === null ? null : asId<FarmersMarketId>(marketId),
            schedule: match?.schedule ?? [],
            note: option.note,
          });
        });

        // "Markets they sell at" follows the farmer's market options.
        const before = new Set(existing.map((o) => o.marketId).filter((m): m is FarmersMarketId => m !== null));
        const after = new Set(next.map((o) => o.marketId).filter((m): m is FarmersMarketId => m !== null));
        const links = db.farmer_market_links.filter((l) => l.farmerProfileId !== farm.id || !before.has(l.marketId) || after.has(l.marketId));
        for (const marketId of after) {
          if (!links.some((l) => l.farmerProfileId === farm.id && l.marketId === marketId)) links.push({ farmerProfileId: farm.id, marketId });
        }
        return {
          ...db,
          farmer_pickup_options: [...db.farmer_pickup_options.filter((o) => o.farmerProfileId !== farm.id), ...next],
          farmer_market_links: links,
        };
      });
      return view(db, actor.farmerProfileId!);
    },

    async setOwnPublication(actor, published) {
      const db = await change(actor, (db, farm, now) => {
        let next = farm;
        if (published) {
          const back = republishProfile(farm, now);
          if (!back) throw invalid('This profile cannot be published yet. Musoko reviews it first.', { form: 'not_publishable' });
          next = back;
        } else {
          next = unpublishProfile(farm, now);
        }
        return { ...db, farmer_profiles: db.farmer_profiles.map((f) => (f.id === farm.id ? next : f)) };
      });
      return view(db, actor.farmerProfileId!);
    },

    async approveOwnProfile(actor) {
      const db = await change(actor, (db, farm, now) => ({
        ...db,
        farmer_profiles: db.farmer_profiles.map((f) => (f.id === farm.id ? recordFarmerConsent(f, actor.userId, now) : f)),
      }));
      return view(db, actor.farmerProfileId!);
    },

    async confirmOwnReview(actor) {
      const db = await change(actor, (db, farm, now) => ({
        ...db,
        farmer_profiles: db.farmer_profiles.map((f) => (f.id === farm.id ? recordFarmerReview(f, actor.userId, now) : f)),
      }));
      return view(db, actor.farmerProfileId!);
    },

    // ---------------------------------------------------------------- listings
    async listOwnListings(actor) {
      const { db, farm, now } = await read(actor);
      return copyOf(toOwnListings(db, farm.id, now));
    },

    async createListing(actor, input) {
      const values = must(parseListingCreate(input), 'The listing is not complete.');
      const productId = asId<ProductId>(newId('prod'));
      const db = await change(actor, (db, farm, now) => {
        const type = db.product_types.find((t) => t.id === values.productTypeId);
        if (!type) throw invalid('Choose what you are selling.', { productTypeId: 'type_required' });
        if (values.status === 'coming_soon' && !isValidComingSoonMonth(values.expectedMonth ?? '', now, db.settings)) {
          throw invalid('Choose a month from the list.', { expectedMonth: 'month_invalid' });
        }
        const fields = must(resolveListingFields(values, type, null), 'The listing is not complete.');
        const built = buildListing({
          productId,
          historyId: asId<EventId>(newId('avail-hist')),
          farmerProfileId: farm.id,
          userId: actor.userId,
          fields,
          status: values.status,
          expectedMonth: values.expectedMonth,
          quantity: values.quantity,
          now,
          isDemo: farm.isDemo,
        });
        return {
          ...db,
          products: [...db.products, built.product],
          product_availability: [...db.product_availability, built.availability],
          product_availability_history: [...db.product_availability_history, built.history],
          product_quantities: built.quantity ? [...db.product_quantities, built.quantity] : db.product_quantities,
        };
      });
      return listing(db, actor.farmerProfileId!, productId, runtime.clock.now());
    },

    async updateListing(actor, productId, input) {
      const values = must(parseListingUpdate(input), 'The listing is not complete.');
      const db = await change(actor, (db, farm, now) => {
        const product = ownProduct(db, farm.id, productId);
        const type = db.product_types.find((t) => t.id === values.productTypeId);
        if (!type) throw invalid('Choose what you are selling.', { productTypeId: 'type_required' });
        const fields = must(resolveListingFields(values, type, product), 'The listing is not complete.');
        return {
          ...db,
          products: db.products.map((p) => (p.id === productId ? { ...p, ...fields, updatedAt: now.toISOString() } : p)),
        };
      });
      return listing(db, actor.farmerProfileId!, productId, runtime.clock.now());
    },

    async removeListing(actor, productId) {
      await change(actor, (db, farm) => {
        ownProduct(db, farm.id, productId);
        return {
          ...db,
          products: db.products.filter((p) => p.id !== productId),
          product_availability: db.product_availability.filter((a) => a.productId !== productId),
          product_availability_history: db.product_availability_history.filter((h) => h.productId !== productId),
          product_quantities: db.product_quantities.filter((q) => q.productId !== productId),
          // An inquiry about it stays, as a question about the product type.
          inquiries: db.inquiries.map((i) => (i.productId === productId ? { ...i, productId: null } : i)),
        };
      });
    },

    async farmerSetAvailability(actor, productId, input) {
      const changeInput = must(parseWith(availabilityChangeSchema, input), 'That change is not valid.');
      const db = await change(actor, (db, farm, now) => {
        ownProduct(db, farm.id, productId);
        const current = db.product_availability.find((a) => a.productId === productId);
        if (!current) throw new GatewayError('not_found', 'That listing has no availability record.');

        let result: { availability: typeof current; statusChanged: boolean };
        let quantities = db.product_quantities;
        if (changeInput.kind === 'still_available') {
          result = confirmAvailability(current, now, db.settings);
          // QTY-4: the quantity changes in the same step. Left alone when none was sent.
          if (changeInput.quantity === null) quantities = quantities.filter((q) => q.productId !== productId);
          else if (changeInput.quantity) {
            quantities = [...quantities.filter((q) => q.productId !== productId), buildQuantityRow(productId, changeInput.quantity, now)];
          }
        } else if (changeInput.kind === 'coming_soon') {
          if (!isValidComingSoonMonth(changeInput.expectedMonth, now, db.settings)) {
            throw invalid('Choose a month from the list.', { expectedMonth: 'month_invalid' });
          }
          result = markComingSoon(current, changeInput.expectedMonth, now);
          // Nothing is available yet, so an old quantity would be wrong.
          quantities = quantities.filter((q) => q.productId !== productId);
        } else {
          result = markUnavailable(current, now);
          quantities = quantities.filter((q) => q.productId !== productId);
        }
        return {
          ...db,
          product_availability: db.product_availability.map((a) => (a.productId === productId ? result.availability : a)),
          product_availability_history: result.statusChanged
            ? [
                ...db.product_availability_history,
                {
                  id: asId<EventId>(newId('avail-hist')),
                  productId,
                  status: result.availability.status,
                  changedAt: now.toISOString(),
                  changedBy: actor.userId,
                },
              ]
            : db.product_availability_history,
          product_quantities: quantities,
        };
      });
      return listing(db, actor.farmerProfileId!, productId, runtime.clock.now());
    },

    async getFarmerNumbers(actor) {
      const { db, farm, now } = await read(actor);
      return farmerNumbers(db, farm.id, now, db.settings);
    },
    async getFarmerPlanning(actor) {
      const { db, farm, now } = await read(actor);
      return buildFarmerPlanning(db, farm.id, now, db.settings);
    },
  };
}

