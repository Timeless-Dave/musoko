import {
  applyAdminProfileEdit,
  buildAdminDraftFarm,
  checkRecordDay,
  consentRecordSchema,
  moderationSchema,
  retentionSettingsSchema,
  toAdminClaimRows,
  toAdminFarm,
  toAdminFarmRows,
  toModerationItems,
  type AdminFarm,
  type ModerationItem,
} from '@/domain/admin';
import { noResultSearches, buildPilotMetrics } from '@/domain/analytics';
import { checkVerificationDay, removeVerification, verifyClaim, verifyClaimSchema } from '@/domain/claims';
import {
  approveRegistration,
  declineRegistration,
  recordAdminConsent,
  recordAdminReview,
} from '@/domain/consent';
import { parseProfile, parseWith } from '@/domain/farmer';
import { retentionStatus, type JobEvent } from '@/domain/jobs';
import { asId, type Community, type Database, type FarmerProfile, type FarmerProfileId } from '@/domain/types';
import { newId } from '@/lib/ids';
import type { Actor } from '../../ports/auth';
import { GatewayError } from '../../ports/errors';
import type { AdminGateway, RetentionRunResult, RetentionView } from '../../ports/admin';
import { invalid, requireAdmin } from './access';
import { demoExactPoint, writeProfileEdit } from './profiles';
import type { DemoRuntime } from './store';

/**
 * Everything an administrator does. This file reads the private contact, address
 * and raw search tables, so the public gateway never imports it (a test checks).
 * Every method starts with `requireAdmin` on the latest state.
 */
const copyOf = <T>(value: T): T => structuredClone(value);

function must<T>(parsed: { ok: true; value: T } | { ok: false; fields: Record<string, string> }, message: string): T {
  if (!parsed.ok) throw invalid(message, parsed.fields);
  return parsed.value;
}

function profileOf(db: Database, farmId: FarmerProfileId): FarmerProfile {
  const farm = db.farmer_profiles.find((f) => f.id === farmId);
  if (!farm) throw new GatewayError('not_found', 'That farm does not exist.');
  return farm;
}

function communityOf(db: Database, id: string): Community {
  const community = db.communities.find((c) => c.id === id);
  if (!community) throw invalid('Choose a town from the list.', { communityId: 'community_required' });
  return community;
}

/** A consent or review record: method and day from the form, the day checked against "now". */
function recordInput(input: unknown, now: Date): { method: 'in_person' | 'by_phone' | 'signed_form'; date: string } {
  const parsed = parseWith(consentRecordSchema, input);
  if (!parsed.ok) throw invalid('That record is not complete.', parsed.fields);
  const problem = checkRecordDay(parsed.value.date, now);
  if (problem) throw invalid('That day cannot be recorded.', { date: problem });
  return parsed.value;
}

const SETTINGS_KEYS = ['searchEventRetentionDays', 'buyerContactRetentionDays', 'minimumSampleSize'] as const;

export function createDemoAdmin(runtime: DemoRuntime, runJobs: () => Promise<JobEvent[]>): AdminGateway {
  async function read(actor: Actor): Promise<{ db: Database; now: Date }> {
    await runtime.ready();
    const { db } = runtime.read();
    requireAdmin(db, actor);
    return { db, now: runtime.clock.now() };
  }

  /** Runs a change on the latest state after the actor check, and resolves only once it is stored. */
  async function change(actor: Actor, apply: (db: Database, now: Date) => Database): Promise<Database> {
    await runtime.ready();
    const now = runtime.clock.now();
    let latest: Database | null = null;
    await runtime.commit((state) => {
      requireAdmin(state.db, actor);
      const db = apply(state.db, now);
      latest = db;
      return { ...state, db };
    });
    return latest!;
  }

  const farmView = (db: Database, farmId: FarmerProfileId): AdminFarm => {
    const view = toAdminFarm(db, farmId);
    if (!view) throw new GatewayError('not_found', 'That farm does not exist.');
    return copyOf(view);
  };
  const replaceProfile = (db: Database, next: FarmerProfile): Database => ({
    ...db,
    farmer_profiles: db.farmer_profiles.map((f) => (f.id === next.id ? next : f)),
  });
  const retention = (db: Database, now: Date): RetentionView => ({
    settings: {
      searchEventRetentionDays: db.settings.searchEventRetentionDays,
      buyerContactRetentionDays: db.settings.buyerContactRetentionDays,
      minimumSampleSize: db.settings.minimumSampleSize,
    },
    status: retentionStatus(db, now, db.settings),
  });

  return {
    // ---------------------------------------------------------------- profiles
    async listFarmsForAdmin(actor) {
      const { db } = await read(actor);
      return copyOf(toAdminFarmRows(db).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
    },

    async getFarmForAdmin(actor, farmId) {
      const { db } = await read(actor);
      return farmView(db, farmId);
    },

    async createFarmForFarmer(actor, input) {
      const values = must(parseProfile(input), 'The profile is not complete.');
      const profileId = asId<FarmerProfileId>(newId('farm'));
      const db = await change(actor, (db, now) => {
        const community = communityOf(db, values.communityId);
        const street = values.streetAddress?.trim() ? values.streetAddress.trim() : null;
        const built = buildAdminDraftFarm({
          values,
          community,
          adminUserId: actor.userId,
          profileId,
          takenSlugs: db.farmer_profiles.map((f) => f.slug),
          now,
          isDemo: true,
          exactPoint: street ? demoExactPoint(community.centre, street) : null,
        });
        return {
          ...db,
          farmer_profiles: [...db.farmer_profiles, built.profile],
          farm_public_locations: [...db.farm_public_locations, built.publicLocation],
          farm_private_locations: built.privateLocation ? [...db.farm_private_locations, built.privateLocation] : db.farm_private_locations,
          farmer_private_contacts: [...db.farmer_private_contacts, built.contact],
        };
      });
      return farmView(db, profileId);
    },

    async updateFarmAsAdmin(actor, farmId, input) {
      const values = must(parseProfile(input), 'The profile is not complete.');
      const db = await change(actor, (db, now) => {
        const farm = profileOf(db, farmId);
        const community = communityOf(db, values.communityId);
        return writeProfileEdit(db, farm.id, applyAdminProfileEdit(farm, values, community, now), community);
      });
      return farmView(db, farmId);
    },

    async recordFarmConsent(actor, farmId, input) {
      const db = await change(actor, (db, now) => {
        const farm = profileOf(db, farmId);
        const record = recordInput(input, now);
        const next = recordAdminConsent(farm, { ...record, recordedBy: actor.userId }, now);
        if (!next) throw invalid('Consent is already on record.', { form: 'consent_exists' });
        return replaceProfile(db, next);
      });
      return farmView(db, farmId);
    },

    async recordFarmReview(actor, farmId, input) {
      const db = await change(actor, (db, now) => {
        const farm = profileOf(db, farmId);
        const record = recordInput(input, now);
        const next = recordAdminReview(farm, { ...record, recordedBy: actor.userId }, now);
        if (!next) throw invalid('There is nothing to review.', { form: 'nothing_to_review' });
        return replaceProfile(db, next);
      });
      return farmView(db, farmId);
    },

    async approveFarmRegistration(actor, farmId) {
      const db = await change(actor, (db, now) => {
        const farm = profileOf(db, farmId);
        const next = approveRegistration(farm, now);
        if (!next) {
          const missing = farm.consentMethod === null || farm.consentDate === null || farm.consentRecordedBy === null;
          throw invalid(missing ? 'Consent has to be recorded first.' : 'This profile is already approved.', {
            form: missing ? 'consent_missing' : 'already_decided',
          });
        }
        return replaceProfile(db, next);
      });
      return farmView(db, farmId);
    },

    async declineFarmRegistration(actor, farmId) {
      const db = await change(actor, (db, now) => {
        const next = declineRegistration(profileOf(db, farmId), now);
        if (!next) throw invalid('This profile was already declined.', { form: 'already_decided' });
        return replaceProfile(db, next);
      });
      return farmView(db, farmId);
    },

    // ---------------------------------------------------------------- claims
    async listClaimsForAdmin(actor) {
      const { db } = await read(actor);
      return copyOf(toAdminClaimRows(db));
    },

    async verifyClaim(actor, claimId, input) {
      const parsed = parseWith(verifyClaimSchema, input);
      if (!parsed.ok) throw invalid('Say what you checked, and on what day.', parsed.fields);
      const db = await change(actor, (db, now) => {
        const claim = db.claims.find((c) => c.id === claimId);
        if (!claim) throw new GatewayError('not_found', 'That claim does not exist.');
        const problem = checkVerificationDay(parsed.value.verifiedOn, now);
        if (problem) throw invalid('That day cannot be recorded.', { verifiedOn: problem });
        const verified = verifyClaim(claim, { ...parsed.value, verifiedBy: actor.userId });
        return { ...db, claims: db.claims.map((c) => (c.id === claimId ? verified : c)) };
      });
      return copyOf(toAdminClaimRows(db).find((r) => r.claim.id === claimId)!);
    },

    async removeClaimVerification(actor, claimId) {
      const db = await change(actor, (db) => {
        const claim = db.claims.find((c) => c.id === claimId);
        if (!claim) throw new GatewayError('not_found', 'That claim does not exist.');
        return { ...db, claims: db.claims.map((c) => (c.id === claimId ? removeVerification(c) : c)) };
      });
      return copyOf(toAdminClaimRows(db).find((r) => r.claim.id === claimId)!);
    },

    // ---------------------------------------------------------------- moderation
    async listModerationItems(actor) {
      const { db } = await read(actor);
      return copyOf(toModerationItems(db));
    },

    async setModeration(actor, input) {
      const values = must(parseWith(moderationSchema, input), 'That change is not valid.');
      const db = await change(actor, (db) => {
        const exists = (rows: ReadonlyArray<{ id: string }>) => rows.some((r) => r.id === values.id);
        if (values.kind === 'product') {
          if (!exists(db.products)) throw new GatewayError('not_found', 'That listing does not exist.');
          return { ...db, products: db.products.map((p) => (p.id === values.id ? { ...p, moderationStatus: values.status } : p)) };
        }
        if (values.kind === 'market') {
          if (!exists(db.farmers_markets)) throw new GatewayError('not_found', 'That market does not exist.');
          return { ...db, farmers_markets: db.farmers_markets.map((m) => (m.id === values.id ? { ...m, moderationStatus: values.status } : m)) };
        }
        if (!exists(db.pickup_locations)) throw new GatewayError('not_found', 'That pickup location does not exist.');
        return { ...db, pickup_locations: db.pickup_locations.map((l) => (l.id === values.id ? { ...l, moderationStatus: values.status } : l)) };
      });
      const item: ModerationItem | undefined = toModerationItems(db).find((i) => i.kind === values.kind && i.id === values.id);
      return copyOf(item!);
    },

    // ---------------------------------------------------------------- metrics
    async getPilotMetrics(actor) {
      const { db, now } = await read(actor);
      return buildPilotMetrics(db, now, db.settings);
    },

    async listNoResultSearches(actor) {
      const { db } = await read(actor);
      return noResultSearches(db);
    },

    // ---------------------------------------------------------------- retention
    async getRetentionView(actor) {
      const { db, now } = await read(actor);
      return retention(db, now);
    },

    async updateRetentionSettings(actor, input) {
      const values = must(parseWith(retentionSettingsSchema, input), 'Those settings are not valid.');
      const db = await change(actor, (db) => ({ ...db, settings: { ...db.settings, ...Object.fromEntries(SETTINGS_KEYS.map((k) => [k, values[k]])) } }));
      return retention(db, runtime.clock.now());
    },

    async runRetention(actor): Promise<RetentionRunResult> {
      await read(actor);
      const events = await runJobs();
      return {
        searchEventsRolledUp: events.reduce((n, e) => (e.kind === 'search_events_rolled_up' ? n + e.count : n), 0),
        buyerContactsDeleted: events.filter((e) => e.kind === 'buyer_contact_deleted').length,
        inquiriesClosed: events.filter((e) => e.kind === 'closed_unanswered' || e.kind === 'closed_after_response').length,
        remindersSent: events.filter((e) => e.kind === 'reminder').length,
      };
    },
  };
}
