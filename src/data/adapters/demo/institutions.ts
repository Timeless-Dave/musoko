import {
  buildInquiry,
  checkInquiryAbuse,
  formatPhone,
  pruneAttempts,
  resolveInquiryTargets,
  type InquiryRequest,
} from '@/domain/inquiry';
import {
  buildPublicInstitutions,
  bulkRequestSchema,
  institutionInputSchema,
  needInputSchema,
  type InstitutionInput,
} from '@/domain/institutions';
import {
  asId,
  type CommunityId,
  type Database,
  type Inquiry,
  type InquiryBuyerContact,
  type InquiryId,
  type Institution,
  type InstitutionId,
  type InstitutionNeedId,
  type ProductTypeId,
} from '@/domain/types';
import { newId, newToken } from '@/lib/ids';
import { buyerConfirmationNotice, farmerReceivedNotice } from '../../messages';
import { GatewayError } from '../../ports/errors';
import type { InstitutionGateway, OwnInstitution } from '../../ports/institutions';
import type { NotificationService } from '../../ports/notifications';
import { invalid } from './access';
import type { DemoRuntime } from './store';

const copyOf = <T>(value: T): T => structuredClone(value);
const MAX_NEEDS = 20;

function fieldErrors(issues: ReadonlyArray<{ path: PropertyKey[]; message: string }>): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of issues) fields[issue.path.length ? issue.path.map(String).join('.') : 'form'] ??= issue.message;
  return fields;
}

const slugify = (name: string) =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'organisation';

function own(db: Database, token: string): OwnInstitution | null {
  if (!token) return null;
  const institution = db.institutions.find((i) => i.editToken === token);
  if (!institution) return null;
  const contact = db.institution_contacts.find((c) => c.institutionId === institution.id);
  if (!contact) return null;
  return copyOf({ institution, contact, needs: db.institution_needs.filter((n) => n.institutionId === institution.id) });
}

function parseInstitution(db: Database, input: InstitutionInput) {
  const parsed = institutionInputSchema.safeParse(input);
  if (!parsed.success) throw invalid('The profile is not complete.', fieldErrors(parsed.error.issues));
  if (!db.communities.some((c) => c.id === parsed.data.communityId)) throw invalid('Choose a town.', { communityId: 'town_required' });
  return parsed.data;
}

export function createDemoInstitutions(runtime: DemoRuntime, notifications: NotificationService): InstitutionGateway {
  async function withOwn(token: string, change: (db: Database, inst: Institution) => Database): Promise<OwnInstitution> {
    await runtime.ready();
    await runtime.commit((state) => {
      const inst = state.db.institutions.find((i) => i.editToken === token);
      if (!token || !inst) throw new GatewayError('not_found', 'That organisation profile was not found.');
      return { ...state, db: change(state.db, inst) };
    });
    return own(runtime.read().db, token)!;
  }

  return {
    async listPublicInstitutions() {
      await runtime.ready();
      return copyOf(buildPublicInstitutions(runtime.read().db));
    },

    async registerInstitution(input) {
      await runtime.ready();
      const now = runtime.clock.now().toISOString();
      let receipt = { institutionId: asId<InstitutionId>(''), slug: '', editToken: '' };
      await runtime.commit((state) => {
        const v = parseInstitution(state.db, input);
        const base = slugify(v.name);
        let slug = base;
        for (let i = 2; state.db.institutions.some((x) => x.slug === slug); i += 1) slug = `${base}-${i}`;
        const id = asId<InstitutionId>(newId('inst'));
        const editToken = newToken();
        receipt = { institutionId: id, slug, editToken };
        return {
          ...state,
          db: {
            ...state.db,
            institutions: [
              ...state.db.institutions,
              {
                id, slug, name: v.name, kind: v.kind, communityId: v.communityId as CommunityId, about: v.about,
                receivingNote: v.receivingNote, showName: v.showName, editToken, isDemo: false, createdAt: now, updatedAt: now,
              },
            ],
            institution_contacts: [
              ...state.db.institution_contacts,
              { institutionId: id, contactName: v.contactName, phone: v.phone ? (formatPhone(v.phone) ?? v.phone) : null, email: v.email || null },
            ],
          },
        };
      });
      return receipt;
    },

    async getOwnInstitution(token) {
      await runtime.ready();
      return own(runtime.read().db, token);
    },

    updateOwnInstitution(token, input) {
      const now = runtime.clock.now().toISOString();
      return withOwn(token, (db, inst) => {
        const v = parseInstitution(db, input);
        return {
          ...db,
          institutions: db.institutions.map((i) =>
            i.id === inst.id
              ? { ...i, name: v.name, kind: v.kind, communityId: v.communityId as CommunityId, about: v.about, receivingNote: v.receivingNote, showName: v.showName, updatedAt: now }
              : i,
          ),
          institution_contacts: db.institution_contacts.map((c) =>
            c.institutionId === inst.id
              ? { ...c, contactName: v.contactName, phone: v.phone ? (formatPhone(v.phone) ?? v.phone) : null, email: v.email || null }
              : c,
          ),
        };
      });
    },

    addInstitutionNeed(token, need) {
      const now = runtime.clock.now().toISOString();
      return withOwn(token, (db, inst) => {
        const parsed = needInputSchema.safeParse(need);
        if (!parsed.success) throw invalid('The need is not complete.', fieldErrors(parsed.error.issues));
        if (!db.product_types.some((t) => t.id === parsed.data.productTypeId)) throw invalid('Choose a food.', { productTypeId: 'type_required' });
        if (db.institution_needs.filter((n) => n.institutionId === inst.id).length >= MAX_NEEDS) {
          throw invalid('That is the most needs one profile can list.', { form: 'too_many_needs' });
        }
        return {
          ...db,
          institution_needs: [
            ...db.institution_needs,
            { ...parsed.data, id: asId<InstitutionNeedId>(newId('need')), institutionId: inst.id, productTypeId: parsed.data.productTypeId as ProductTypeId, createdAt: now },
          ],
        };
      });
    },

    removeInstitutionNeed(token, needId) {
      return withOwn(token, (db, inst) => ({
        ...db,
        institution_needs: db.institution_needs.filter((n) => !(n.id === needId && n.institutionId === inst.id)),
      }));
    },

    async submitBulkRequest(input, signals) {
      await runtime.ready();
      const parsed = bulkRequestSchema.safeParse(input);
      if (!parsed.success) throw invalid('The order is not complete.', fieldErrors(parsed.error.issues));
      const order = parsed.data;
      const now = runtime.clock.now();
      const requestGroup = newId('order');
      const made: { inquiry: Inquiry; contact: InquiryBuyerContact }[] = [];

      await runtime.commit((state) => {
        const recent = pruneAttempts(state.inquiryAttempts, now);
        const verdict = checkInquiryAbuse(
          {
            honeypot: signals.honeypot,
            openedAt: signals.openedAt,
            name: order.contactName,
            message: order.message,
            attempts: recent.filter((a) => a.key === signals.sessionKey).map((a) => a.at),
          },
          now,
          state.db.settings,
        );
        if (!verdict.ok) {
          if (verdict.reason === 'rate_limited') throw new GatewayError('rate_limited', 'Too many requests from this browser.', { retryAt: verdict.retryAt });
          throw new GatewayError('spam_suspected', 'The spam check stopped this request.');
        }
        const institution = order.institutionId ? state.db.institutions.find((i) => i.id === order.institutionId) ?? null : null;
        const when = [
          order.neededBy ? `Needed by ${order.neededBy}.` : '',
          order.cadence === 'weekly' ? 'Repeats every week.' : order.cadence === 'monthly' ? 'Repeats every month.' : '',
        ].filter(Boolean).join(' ');

        // Check every line before storing any, so an order is never half sent.
        const built = order.lines.map((line, i) => {
          const request: InquiryRequest = {
            farmerProfileId: line.farmerProfileId,
            productId: line.productId,
            pickupOptionId: line.pickupOptionId,
            communityId: order.communityId,
            requestedQuantity: { amount: line.amount, unit: line.unit },
            replyChannel: order.replyChannel,
            name: order.contactName,
            phone: order.phone,
            email: order.email,
            message: [`Order for ${order.organisation}.`, when, order.message].filter(Boolean).join(' ').slice(0, 500),
          };
          const targets = resolveInquiryTargets(state.db, request);
          if (!targets.ok) {
            if (targets.problem === 'option_required') throw invalid('Choose how each farm gets the food to you.', { [`lines.${i}.pickupOptionId`]: 'option_required' });
            throw new GatewayError('not_found', 'A farm or listing in this order is no longer available.', { fields: { [`lines.${i}`]: 'not_found' } });
          }
          const result = buildInquiry({
            id: asId<InquiryId>(newId('inq')), statusToken: newToken(), now, request, product: targets.product, option: targets.option,
          });
          return {
            inquiry: { ...result.inquiry, buyerKind: 'institution' as const, institutionId: institution?.id ?? null, requestGroup },
            contact: { ...result.contact, organisation: order.organisation },
          };
        });
        made.push(...built);
        return {
          ...state,
          db: {
            ...state.db,
            inquiries: [...state.db.inquiries, ...built.map((b) => b.inquiry)],
            inquiry_buyer_contacts: [...state.db.inquiry_buyer_contacts, ...built.map((b) => b.contact)],
          },
          inquiryAttempts: [...recent, { key: signals.sessionKey, at: now.toISOString() }],
        };
      });

      const db = runtime.read().db;
      for (const { inquiry, contact } of made) {
        const farm = db.farmer_profiles.find((f) => f.id === inquiry.farmerProfileId);
        const notices = [
          farmerReceivedNotice({
            inquiry, buyer: contact,
            farmer: db.farmer_private_contacts.find((c) => c.farmerProfileId === inquiry.farmerProfileId) ?? null,
            what: inquiry.productId ? (db.products.find((p) => p.id === inquiry.productId)?.title ?? null) : null,
          }),
          buyerConfirmationNotice({ inquiry, buyer: contact, farmName: farm?.farmName ?? 'the farm' }),
        ];
        for (const notice of notices) {
          if (!notice) continue;
          try {
            await notifications.send(notice);
          } catch (error) {
            console.warn('[order] notification not sent', error);
          }
        }
      }
      return { requestGroup, statusTokens: made.map((m) => m.inquiry.statusToken) };
    },
  };
}
