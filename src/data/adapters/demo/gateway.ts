import { confirmAvailability } from '@/domain/availability';
import { buildPublicCatalogue } from '@/domain/privacy';
import { matchProductType, scrubSearchTerms } from '@/domain/search';
import type { JobEvent } from '@/domain/jobs';
import { asId, type EventId, type PublicCatalogue } from '@/domain/types';
import { newId } from '@/lib/ids';
import type { Actor } from '../../ports/auth';
import { GatewayError } from '../../ports/errors';
import type { DataGateway } from '../../ports/gateway';
import type { NotificationService } from '../../ports/notifications';
import { createDemoAdmin } from './admin';
import { createDemoFarmer } from './farmer';
import { createDemoInquiries } from './inquiries';
import type { DemoRuntime } from './store';

// Public reads go only through buildPublicCatalogue. This file never reads the
// private location, private contact or buyer contact collections (a test checks).
const copyOf = <T>(value: T): T => structuredClone(value);

export function createDemoGateway(
  runtime: DemoRuntime,
  notifications: NotificationService,
): DataGateway & { runJobs(): Promise<JobEvent[]> } {
  const inquiries = createDemoInquiries(runtime, notifications);
  const farmer = createDemoFarmer(runtime);
  const admin = createDemoAdmin(runtime, inquiries.runJobs);
  async function catalogue(): Promise<PublicCatalogue> {
    await runtime.ready();
    const { db } = runtime.read();
    return copyOf(buildPublicCatalogue(db, runtime.clock.now(), db.settings));
  }
  async function table<K extends 'regions' | 'communities' | 'product_types'>(key: K) {
    await runtime.ready();
    return copyOf(runtime.read().db[key]);
  }

  return {
    ...inquiries,
    ...farmer,
    ...admin,
    async getSettings() {
      await runtime.ready();
      return copyOf(runtime.read().db.settings);
    },
    listRegions: () => table('regions'),
    listCommunities: () => table('communities'),
    listProductTypes: () => table('product_types'),
    async listPublicFarms() {
      return (await catalogue()).farms;
    },
    async getPublicFarmBySlug(slug) {
      return (await catalogue()).farms.find((f) => f.slug === slug) ?? null;
    },
    async listPublicProducts() {
      return (await catalogue()).products;
    },
    async listPublicMarkets() {
      return (await catalogue()).markets;
    },
    async listPublicPickupLocations() {
      return (await catalogue()).pickupLocations;
    },

    async recordSearch({ rawTerms, filters, communityId, resultCount }) {
      await runtime.ready();
      const now = runtime.clock.now();
      const day = now.toISOString().slice(0, 10);
      await runtime.commit((state) => {
        const terms = scrubSearchTerms(rawTerms, state.db.settings);
        const matched = matchProductType(terms, state.db.product_types);
        return {
          ...state,
          db: {
            ...state.db,
            search_events: [
              ...state.db.search_events,
              {
                id: asId<EventId>(newId('search')),
                day,
                terms,
                matchedProductTypeId: matched?.id ?? null,
                filters,
                communityId,
                resultCount,
              },
            ],
          },
        };
      });
    },

    async recordPreviewOpen({ targetKind, targetId, surface }) {
      await runtime.ready();
      const { db } = runtime.read();
      const exists =
        targetKind === 'farmers_market'
          ? db.farmers_markets.some((m) => m.id === targetId && m.moderationStatus === 'visible')
          : db.pickup_locations.some((l) => l.id === targetId && l.moderationStatus === 'visible');
      if (!exists) throw new GatewayError('not_found', 'That place is not listed.');

      const day = runtime.clock.now().toISOString().slice(0, 10);
      await runtime.commit((state) => {
        // One row per place, surface and day. The row holds a count and nothing about who opened it.
        const same = (e: { day: string; targetKind: string; targetId: string; surface: string }) =>
          e.day === day && e.targetKind === targetKind && e.targetId === targetId && e.surface === surface;
        const existing = state.db.preview_events.some(same);
        return {
          ...state,
          db: {
            ...state.db,
            preview_events: existing
              ? state.db.preview_events.map((e) => (same(e) ? { ...e, count: e.count + 1 } : e))
              : [
                  ...state.db.preview_events,
                  { id: asId<EventId>(newId('preview')), day, targetKind, targetId, surface, count: 1 },
                ],
          },
        };
      });
    },

    async farmerConfirmAvailability(actor: Actor, productId) {
      await runtime.ready();
      if (actor.role !== 'farmer' || actor.farmerProfileId === null) {
        throw new GatewayError('forbidden', 'Only a farmer can confirm availability.');
      }
      const before = runtime.read().db;
      const product = before.products.find((p) => p.id === productId);
      if (!product) throw new GatewayError('not_found', 'That listing does not exist.');
      const farm = before.farmer_profiles.find((f) => f.id === product.farmerProfileId);
      if (product.farmerProfileId !== actor.farmerProfileId || !farm || farm.userId !== actor.userId) {
        throw new GatewayError('forbidden', 'You can only confirm your own listings.');
      }
      const current = before.product_availability.find((a) => a.productId === productId);
      if (!current) throw new GatewayError('not_found', 'That listing has no availability record.');

      const now = runtime.clock.now();
      let saved = current;
      await runtime.commit((state) => {
        // Re-read inside the commit so two quick taps cannot overwrite each other.
        const latest = state.db.product_availability.find((a) => a.productId === productId) ?? current;
        const result = confirmAvailability(latest, now, state.db.settings);
        saved = result.availability;
        return {
          ...state,
          db: {
            ...state.db,
            product_availability: state.db.product_availability.map((a) => (a.productId === productId ? result.availability : a)),
            product_availability_history: result.statusChanged
              ? [
                  ...state.db.product_availability_history,
                  { id: asId<EventId>(newId('avail-hist')), productId, status: 'available_now', changedAt: now.toISOString(), changedBy: actor.userId },
                ]
              : state.db.product_availability_history,
          },
        };
      });
      return copyOf(saved);
    },
  };
}
