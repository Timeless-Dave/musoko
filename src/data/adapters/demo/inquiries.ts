import { buildPublicCatalogue } from '@/domain/privacy';
import {
  buildInquiry,
  checkInquiryAbuse,
  inquiryRequestSchema,
  pruneAttempts,
  resolveInquiryTargets,
  toBuyerInquiryView,
  toInquiryRecord,
  type InquiryRequest,
} from '@/domain/inquiry';
import { runScheduledJobs, type JobEvent } from '@/domain/jobs';
import { asId, type Database, type Inquiry, type InquiryBuyerContact, type InquiryId } from '@/domain/types';
import { newId, newToken } from '@/lib/ids';
import {
  buyerClosedNotice,
  buyerConfirmationNotice,
  farmerReceivedNotice,
  farmerReminderNotice,
} from '../../messages';
import type { Actor } from '../../ports/auth';
import { GatewayError } from '../../ports/errors';
import type { InquiryGateway } from '../../ports/inquiries';
import type { NotificationService, OutboundNotification } from '../../ports/notifications';
import type { DemoRuntime } from './store';

/**
 * Everything that touches the buyer-contact table lives in this file, and the
 * public gateway in gateway.ts never reads it (a test checks). Buyers are not
 * signed in: the inquiry's status token is their only key.
 */
const copyOf = <T>(value: T): T => structuredClone(value);

/** One validation code per field, the first that applies. */
function fieldErrors(issues: ReadonlyArray<{ path: PropertyKey[]; message: string }>): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path.length ? issue.path.map(String).join('.') : 'form';
    fields[key] ??= issue.message;
  }
  return fields;
}

async function deliver(notifications: NotificationService, notice: OutboundNotification | null): Promise<void> {
  if (!notice) return;
  try {
    await notifications.send(notice);
  } catch (error) {
    // A notice that fails to send never undoes a stored inquiry or a status change.
    console.warn('[inquiry] notification not sent', error);
  }
}

const productTitle = (db: Database, inquiry: Inquiry): string | null =>
  inquiry.productId ? (db.products.find((p) => p.id === inquiry.productId)?.title ?? null) : null;
const farmName = (db: Database, inquiry: Inquiry): string =>
  db.farmer_profiles.find((f) => f.id === inquiry.farmerProfileId)?.farmName ?? 'the farm';
const farmerContact = (db: Database, inquiry: Inquiry) =>
  db.farmer_private_contacts.find((c) => c.farmerProfileId === inquiry.farmerProfileId) ?? null;
const buyerContact = (db: Database, id: InquiryId): InquiryBuyerContact | null =>
  db.inquiry_buyer_contacts.find((c) => c.inquiryId === id) ?? null;

export function createDemoInquiries(
  runtime: DemoRuntime,
  notifications: NotificationService,
): InquiryGateway & { runJobs(): Promise<JobEvent[]> } {
  return {
    async submitInquiry(requestInput, signals) {
      await runtime.ready();
      const parsed = inquiryRequestSchema.safeParse(requestInput);
      if (!parsed.success) {
        throw new GatewayError('invalid', 'The inquiry is not complete.', { fields: fieldErrors(parsed.error.issues) });
      }
      const request: InquiryRequest = parsed.data;
      const now = runtime.clock.now();
      const created: { value: { inquiry: Inquiry; contact: InquiryBuyerContact; db: Database } | null } = { value: null };

      // Every check runs inside the commit, on the latest state, so two quick sends cannot both pass the limit.
      await runtime.commit((state) => {
        const recent = pruneAttempts(state.inquiryAttempts, now);
        const verdict = checkInquiryAbuse(
          {
            honeypot: signals.honeypot,
            openedAt: signals.openedAt,
            name: request.name,
            message: request.message,
            attempts: recent.filter((a) => a.key === signals.sessionKey).map((a) => a.at),
          },
          now,
          state.db.settings,
        );
        if (!verdict.ok) {
          if (verdict.reason === 'rate_limited') {
            throw new GatewayError('rate_limited', 'Too many inquiries from this browser.', { retryAt: verdict.retryAt });
          }
          throw new GatewayError('spam_suspected', 'The spam check stopped this inquiry.');
        }

        const targets = resolveInquiryTargets(state.db, request);
        if (!targets.ok) {
          if (targets.problem === 'option_required') {
            throw new GatewayError('invalid', 'Choose how to get it.', { fields: { pickupOptionId: 'option_required' } });
          }
          throw new GatewayError('not_found', 'That farm, listing or option is no longer available.');
        }

        const built = buildInquiry({
          id: asId<InquiryId>(newId('inq')),
          statusToken: newToken(),
          now,
          request,
          product: targets.product,
          option: targets.option,
        });
        const db: Database = {
          ...state.db,
          inquiries: [...state.db.inquiries, built.inquiry],
          inquiry_buyer_contacts: [...state.db.inquiry_buyer_contacts, built.contact],
        };
        created.value = { ...built, db };
        return { ...state, db, inquiryAttempts: [...recent, { key: signals.sessionKey, at: now.toISOString() }] };
      });

      // The inquiry is stored. Now the two notices, through the port.
      const { inquiry, contact, db } = created.value!;
      await deliver(
        notifications,
        farmerReceivedNotice({ inquiry, buyer: contact, farmer: farmerContact(db, inquiry), what: productTitle(db, inquiry) }),
      );
      await deliver(notifications, buyerConfirmationNotice({ inquiry, buyer: contact, farmName: farmName(db, inquiry) }));
      return { statusToken: inquiry.statusToken };
    },

    async getBuyerInquiry(statusToken) {
      await runtime.ready();
      if (!statusToken) return null;
      const { db } = runtime.read();
      const { products } = buildPublicCatalogue(db, runtime.clock.now(), db.settings);
      const view = toBuyerInquiryView(db, statusToken, products);
      return view ? copyOf(view) : null;
    },

    async listInquiriesForActor(actor: Actor) {
      await runtime.ready();
      const { db } = runtime.read();
      let rows: Inquiry[];
      if (actor.role === 'administrator') {
        rows = db.inquiries;
      } else if (actor.role === 'farmer' && actor.farmerProfileId !== null) {
        const farm = db.farmer_profiles.find((f) => f.id === actor.farmerProfileId);
        if (!farm || farm.userId !== actor.userId) throw new GatewayError('forbidden', 'These are not your inquiries.');
        rows = db.inquiries.filter((i) => i.farmerProfileId === farm.id);
      } else {
        throw new GatewayError('forbidden', 'Only the farmer an inquiry was sent to, or an administrator, can see it.');
      }
      return copyOf([...rows].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((i) => toInquiryRecord(db, i)));
    },

    async runJobs() {
      await runtime.ready();
      const now = runtime.clock.now();
      const { db: before } = runtime.read();
      if (runScheduledJobs(before, now, before.settings).events.length === 0) return [];

      let events: JobEvent[] = [];
      let snapshot: Database = before;
      await runtime.commit((state) => {
        // Run again on the latest state: whichever caller commits first does the work, the other finds none.
        const result = runScheduledJobs(state.db, now, state.db.settings);
        events = result.events;
        snapshot = state.db;
        return result.events.length ? { ...state, db: result.db } : state;
      });

      // Notices use the rows as they were before the run, because a long-closed inquiry loses its contact row in the same run.
      for (const event of events) {
        const inquiry = snapshot.inquiries.find((i) => i.id === event.inquiryId);
        if (!inquiry) continue;
        if (event.kind === 'reminder') {
          await deliver(
            notifications,
            farmerReminderNotice({
              inquiry,
              buyer: buyerContact(snapshot, inquiry.id),
              farmer: farmerContact(snapshot, inquiry),
              what: productTitle(snapshot, inquiry),
            }),
          );
        } else if (event.kind === 'closed_unanswered') {
          await deliver(
            notifications,
            buyerClosedNotice({ inquiry, buyer: buyerContact(snapshot, inquiry.id), farmName: farmName(snapshot, inquiry) }),
          );
        }
      }
      return events;
    },
  };
}
