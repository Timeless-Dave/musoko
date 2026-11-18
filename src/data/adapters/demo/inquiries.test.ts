import { describe, expect, it } from 'vitest';
import { copy } from '@/content/copy';
import { findPrivateLeaks } from '@/domain/privacy/leaks';
import type { InquiryRequestInput, InquirySignals } from '@/domain/inquiry';
import { asId, type Database, type FarmerProfileId } from '@/domain/types';
import type { Actor } from '../../ports/auth';
import { GatewayError } from '../../ports/errors';
import { DEMO_ACCOUNTS } from '../../seed';
import { createDemoServices } from './index';
import { createMemoryStorage, DEMO_STORAGE_KEY, type DemoState, type DemoStorage } from './store';

const NOW = new Date('2026-11-15T15:00:00.000Z');
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

function setup(storage: DemoStorage = createMemoryStorage()) {
  const time = { current: NOW };
  const services = createDemoServices({ clock: { now: () => time.current }, storage });
  const state = () => (JSON.parse(storage.getItem(DEMO_STORAGE_KEY)!) as { state: DemoState }).state;
  return { time, services, storage, state, db: (): Database => state().db };
}

const farmer: Actor = { role: 'farmer', userId: DEMO_ACCOUNTS.farmer.userId, farmerProfileId: DEMO_ACCOUNTS.farmer.farmerProfileId };
const admin: Actor = { role: 'administrator', userId: DEMO_ACCOUNTS.administrator.userId, farmerProfileId: null };
const buyer: Actor = { role: 'buyer', userId: DEMO_ACCOUNTS.buyer.userId, farmerProfileId: null };

const request = (over: Partial<InquiryRequestInput> = {}): InquiryRequestInput => ({
  farmerProfileId: 'farm-01',
  productId: 'prod-001',
  pickupOptionId: 'option-01',
  communityId: 'com-helena-west-helena',
  requestedQuantity: { amount: 3, unit: 'bunch' },
  replyChannel: 'text',
  name: 'Wilhelmina Strand',
  phone: '(870) 555-0188',
  email: null,
  message: 'Are these cut this morning?',
  ...over,
});
const signals = (time: Date, over: Partial<InquirySignals> = {}): InquirySignals => ({
  honeypot: '',
  openedAt: new Date(time.getTime() - 20_000).toISOString(),
  sessionKey: 'tab-1',
  ...over,
});
const failure = async (promise: Promise<unknown>): Promise<GatewayError> => {
  try {
    await promise;
  } catch (error) {
    if (error instanceof GatewayError) return error;
    throw error;
  }
  throw new Error('expected the call to reject');
};

describe('sending an inquiry (INQ-1, INQ-2, DATA-3)', () => {
  it('stores the inquiry and the contact in separate tables, and returns a private token', async () => {
    const { services, time, db } = setup();
    const { statusToken } = await services.gateway.submitInquiry(request(), signals(time.current));
    expect(statusToken).toMatch(/^[0-9a-f-]{36}$/);
    const inquiry = db().inquiries.find((i) => i.statusToken === statusToken)!;
    expect(inquiry).toMatchObject({
      status: 'awaiting_response', farmerProfileId: 'farm-01', productId: 'prod-001', replyChannel: 'text',
      requestedQuantity: { amount: 3, unit: 'bunch' }, createdAt: NOW.toISOString(),
    });
    // DATA-3: the chosen option is recorded on the inquiry row.
    expect(inquiry).toMatchObject({ pickupOptionId: 'option-01', chosenOptionKind: 'farmers_market', marketId: 'market-01' });
    expect(inquiry.productTypeId).not.toBeNull();
    expect(JSON.stringify(inquiry)).not.toContain('Wilhelmina');
    expect(JSON.stringify(inquiry)).not.toContain('0188');
    expect(db().inquiry_buyer_contacts.find((c) => c.inquiryId === inquiry.id)).toEqual({
      inquiryId: inquiry.id, name: 'Wilhelmina Strand', phone: '870-555-0188', email: null, message: 'Are these cut this morning?',
    });
  });

  it('records a pickup location and an own-delivery choice too', async () => {
    const { services, time, db } = setup();
    const pickup = await services.gateway.submitInquiry(request({ pickupOptionId: 'option-02' }), signals(time.current));
    const delivery = await services.gateway.submitInquiry(request({ pickupOptionId: 'option-03' }), signals(time.current));
    expect(db().inquiries.find((i) => i.statusToken === pickup.statusToken)).toMatchObject({ chosenOptionKind: 'pickup_location', pickupLocationId: 'pickup-01' });
    expect(db().inquiries.find((i) => i.statusToken === delivery.statusToken)).toMatchObject({ chosenOptionKind: 'own_delivery', marketId: null, pickupLocationId: null });
  });

  it('appears for the farmer it was sent to, with the buyer contact, newest first', async () => {
    const { services, time } = setup();
    await services.gateway.submitInquiry(request(), signals(time.current));
    const rows = await services.gateway.listInquiriesForActor(farmer);
    expect(rows).toHaveLength(10); // nine seeded for farm-01 plus this one
    expect(rows[0]!.inquiry.createdAt).toBe(NOW.toISOString());
    expect(rows[0]!.buyer).toMatchObject({ name: 'Wilhelmina Strand', phone: '870-555-0188' });
    expect(rows[0]!.productTitle).toBeTruthy();
    expect(rows.map((r) => r.inquiry.createdAt)).toEqual([...rows.map((r) => r.inquiry.createdAt)].sort().reverse());
  });

  it('notifies the farmer and confirms to the buyer through the notification port', async () => {
    const { services, time, state } = setup();
    const { statusToken } = await services.gateway.submitInquiry(request(), signals(time.current));
    const outbox = state().outbox;
    expect(outbox.map((m) => `${m.template}:${m.channel}`)).toEqual(['inquiry_received:sms', 'inquiry_confirmation:sms']);
    const [toFarmer, toBuyer] = outbox;
    expect(toFarmer!.toMasked).toBe('*****01'); // the farmer's phone ends 0101
    expect(toFarmer!.body).toContain('Wilhelmina Strand');
    expect(toBuyer!.toMasked).toBe('*****88');
    // STAT-2, STAT-6, INQ-7: private link, no promised time, the transaction statement.
    expect(toBuyer!.body).toContain(`/inquiry/${statusToken}`);
    expect(toBuyer!.body).toContain(copy.response.noPromise);
    expect(toBuyer!.body).toContain(copy.transaction.statement);
    expect(toBuyer!.body).not.toContain('0188');
  });

  it('answers by email when the buyer chose email', async () => {
    const { services, time, state } = setup();
    await services.gateway.submitInquiry(
      request({ replyChannel: 'email', phone: null, email: 'wil@buyers.example' }),
      signals(time.current),
    );
    const confirmation = state().outbox.find((m) => m.template === 'inquiry_confirmation')!;
    expect(confirmation).toMatchObject({ channel: 'email', toMasked: 'w*****@buyers.example' });
  });

  it('keeps the inquiry when a notification fails to send', async () => {
    const { services, time, db } = setup();
    services.notifications.send = () => Promise.reject(new Error('provider down'));
    const { statusToken } = await services.gateway.submitInquiry(request(), signals(time.current));
    expect(db().inquiries.some((i) => i.statusToken === statusToken)).toBe(true);
  });

  it('survives a reload and shows on the buyer status page (MODE-1)', async () => {
    const first = setup();
    const { statusToken } = await first.services.gateway.submitInquiry(request(), signals(first.time.current));
    const second = setup(first.storage);
    const view = await second.services.gateway.getBuyerInquiry(statusToken);
    expect(view).toMatchObject({ status: 'awaiting_response', replyChannel: 'text', farm: { name: 'Cypress Knee Gardens' } });
    expect(view!.requestedQuantity).toEqual({ amount: 3, unit: 'bunch' });
    expect(view!.pickup).toMatchObject({ kind: 'farmers_market' });
    expect(view!.reply).toBeNull();
    expect(view!.alternatives).toEqual([]);
  });

  it('works for an inquiry about a farm with no product chosen', async () => {
    const { services, time, db } = setup();
    const { statusToken } = await services.gateway.submitInquiry(
      request({ productId: null, requestedQuantity: null }),
      signals(time.current),
    );
    expect(db().inquiries.find((i) => i.statusToken === statusToken)).toMatchObject({ productId: null, productTypeId: null });
    expect((await services.gateway.getBuyerInquiry(statusToken))!.product).toBeNull();
  });
});

describe('what is refused', () => {
  it('names each field that is wrong and stores nothing', async () => {
    const { services, time, db } = setup();
    await services.demo!.ready();
    const before = db().inquiries.length;
    const error = await failure(
      services.gateway.submitInquiry(request({ name: ' ', phone: '123', requestedQuantity: { amount: 0, unit: 'bunch' } }), signals(time.current)),
    );
    expect(error.code).toBe('invalid');
    expect(error.detail.fields).toMatchObject({
      name: 'name_required', phone: 'phone_invalid', 'requestedQuantity.amount': 'quantity_invalid',
    });
    expect(db().inquiries).toHaveLength(before);
  });

  it('refuses a farm that is not publicly listed, a product from another farm, and an option that is not theirs', async () => {
    const { services, time, db } = setup();
    await services.demo!.ready(); // seed at NOW before the clock moves
    const draft = db().farmer_profiles.find((f) => f.publicationStatus === 'draft')!;
    expect((await failure(services.gateway.submitInquiry(request({ farmerProfileId: draft.id, productId: null, pickupOptionId: null }), signals(time.current)))).code).toBe('not_found');
    const other = db().products.find((p) => p.farmerProfileId !== 'farm-01' && p.moderationStatus === 'visible')!;
    expect((await failure(services.gateway.submitInquiry(request({ productId: other.id }), signals(time.current)))).code).toBe('not_found');
    expect((await failure(services.gateway.submitInquiry(request({ pickupOptionId: 'option-04' }), signals(time.current)))).code).toBe('not_found');
    const hidden = db().products.find((p) => p.moderationStatus === 'hidden')!;
    expect((await failure(services.gateway.submitInquiry(request({ farmerProfileId: hidden.farmerProfileId, productId: hidden.id, pickupOptionId: null }), signals(time.current)))).code).toBeTruthy();
  });

  it('requires a pickup choice when the farm offers any (DATA-3)', async () => {
    const { services, time } = setup();
    const error = await failure(services.gateway.submitInquiry(request({ pickupOptionId: null }), signals(time.current)));
    expect(error).toMatchObject({ code: 'invalid', detail: { fields: { pickupOptionId: 'option_required' } } });
  });
});

describe('abuse protection (INQ-6)', () => {
  it('stops a filled honeypot and a form sent too fast, and stores nothing', async () => {
    const { services, time, db, state } = setup();
    await services.demo!.ready(); // seed at NOW before the clock moves
    const before = db().inquiries.length;
    expect((await failure(services.gateway.submitInquiry(request(), signals(time.current, { honeypot: 'http://x.example' })))).code).toBe('spam_suspected');
    const fast = signals(time.current, { openedAt: new Date(time.current.getTime() - 500).toISOString() });
    expect((await failure(services.gateway.submitInquiry(request(), fast))).code).toBe('spam_suspected');
    expect(db().inquiries).toHaveLength(before);
    expect(state().outbox).toEqual([]);
  });

  it('limits one session to five an hour, counts sessions apart, and lets the hour pass', async () => {
    const { services, time, db } = setup();
    await services.demo!.ready(); // seed at NOW before the clock moves
    const before = db().inquiries.length;
    for (let i = 0; i < 5; i++) await services.gateway.submitInquiry(request(), signals(time.current));
    const sixth = await failure(services.gateway.submitInquiry(request(), signals(time.current)));
    expect(sixth.code).toBe('rate_limited');
    expect(sixth.detail.retryAt).toBe(new Date(NOW.getTime() + HOUR).toISOString());
    expect(db().inquiries).toHaveLength(before + 5);

    await services.gateway.submitInquiry(request(), signals(time.current, { sessionKey: 'tab-2' }));
    time.current = new Date(NOW.getTime() + HOUR + 1000);
    await services.gateway.submitInquiry(request(), signals(time.current));
    expect(db().inquiries).toHaveLength(before + 7);
  });

  it('does not count a refused attempt toward the limit', async () => {
    const { services, time } = setup();
    for (let i = 0; i < 8; i++) await failure(services.gateway.submitInquiry(request({ name: '' }), signals(time.current)));
    await expect(services.gateway.submitInquiry(request(), signals(time.current))).resolves.toBeTruthy();
  });

  it('reads the limit from settings, not from the code', async () => {
    const { services } = setup();
    const settings = await services.gateway.getSettings();
    expect(settings.inquiryRateLimitPerHour).toBe(5);
    expect(settings.inquiryMinFillSeconds).toBe(3);
  });
});

describe('who can see buyer contact (INQ-5, DPRIV-4)', () => {
  it('shows it to the farmer it was sent to and to an administrator', async () => {
    const { services } = setup();
    const own = await services.gateway.listInquiriesForActor(farmer);
    expect(own.length).toBeGreaterThan(0);
    expect(own.every((r) => r.inquiry.farmerProfileId === 'farm-01')).toBe(true);
    expect(own.find((r) => r.inquiry.id === 'inq-01')!.buyer).toMatchObject({ name: 'Renata Voss', phone: '870-555-0171' });
    const all = await services.gateway.listInquiriesForActor(admin);
    expect(all).toHaveLength(10);
    expect(all.some((r) => r.inquiry.farmerProfileId === 'farm-02')).toBe(true);
  });

  it('refuses a buyer, and a farmer claiming another farm', async () => {
    const { services } = setup();
    expect((await failure(services.gateway.listInquiriesForActor(buyer))).code).toBe('forbidden');
    const imposter: Actor = { role: 'farmer', userId: DEMO_ACCOUNTS.farmer.userId, farmerProfileId: asId<FarmerProfileId>('farm-02') };
    expect((await failure(services.gateway.listInquiriesForActor(imposter))).code).toBe('forbidden');
    const noFarm: Actor = { role: 'farmer', userId: DEMO_ACCOUNTS.farmer.userId, farmerProfileId: null };
    expect((await failure(services.gateway.listInquiriesForActor(noFarm))).code).toBe('forbidden');
  });

  it('keeps buyer contact out of every public method, before and after an inquiry', async () => {
    const { services, time, db } = setup();
    await services.gateway.submitInquiry(request(), signals(time.current));
    const { gateway } = services;
    const results = [
      await gateway.listPublicFarms(), await gateway.listPublicProducts(), await gateway.listPublicMarkets(),
      await gateway.listPublicPickupLocations(), await gateway.getSettings(), await gateway.listCommunities(),
    ];
    expect(findPrivateLeaks(results, db())).toEqual([]);
    const text = JSON.stringify(results);
    expect(text).not.toContain('Wilhelmina');
    expect(text).not.toContain('555-0188');
  });
});

describe('the buyer status page (STAT-1, STAT-2, INQ-4)', () => {
  it('answers null for a token that matches nothing', async () => {
    const { services } = setup();
    expect(await services.gateway.getBuyerInquiry('nope')).toBeNull();
    expect(await services.gateway.getBuyerInquiry('')).toBeNull();
    expect(await services.gateway.getBuyerInquiry('inq-01')).toBeNull(); // the id is not the token
  });

  it('shows the three statuses from the seeded inquiries', async () => {
    const { services } = setup();
    const status = async (n: number) => (await services.gateway.getBuyerInquiry(`status-token-${String(n).padStart(2, '0')}`))!.status;
    expect(await status(1)).toBe('awaiting_response');
    expect(await status(4)).toBe('responded');
    expect(await status(7)).toBe('closed');
  });

  it('releases the farmer phone only for a confirmed Contact me, even when the farm shows its phone anyway', async () => {
    const { services } = setup();
    const contactMe = (await services.gateway.getBuyerInquiry('status-token-06'))!;
    expect(contactMe.reply).toMatchObject({ kind: 'contact_me', farmerPhone: '870-555-0101' });
    const available = (await services.gateway.getBuyerInquiry('status-token-04'))!;
    expect(available.reply).toMatchObject({ kind: 'available', farmerPhone: null });
    const soldOut = (await services.gateway.getBuyerInquiry('status-token-05'))!;
    expect(soldOut.reply).toMatchObject({ kind: 'sold_out', farmerPhone: null });
    const awaiting = (await services.gateway.getBuyerInquiry('status-token-01'))!;
    expect(JSON.stringify(awaiting)).not.toContain('870-555-0101');
  });

  it('leaks nothing private for any seeded inquiry or a new one', async () => {
    const { services, time, db } = setup();
    const created = await services.gateway.submitInquiry(request(), signals(time.current));
    const tokens = [...db().inquiries.map((i) => i.statusToken), created.statusToken];
    const views = await Promise.all(tokens.map((t) => services.gateway.getBuyerInquiry(t)));
    expect(views.every((v) => v !== null)).toBe(true);
    expect(findPrivateLeaks(views, db())).toEqual([]);
    const text = JSON.stringify(views);
    for (const c of db().inquiry_buyer_contacts) {
      expect(text).not.toContain(c.name);
      if (c.phone) expect(text).not.toContain(c.phone);
      if (c.email) expect(text).not.toContain(c.email);
    }
    for (const l of db().farm_private_locations) expect(text).not.toContain(l.streetAddress);
    expect(text).not.toContain('farm-0'); // no farm id
  });

  it('points an inquiry that closed unanswered to other listings available now (STAT-4)', async () => {
    const { services } = setup();
    const view = (await services.gateway.getBuyerInquiry('status-token-07'))!;
    expect(view).toMatchObject({ status: 'closed', closedReason: 'unanswered' });
    const products = await services.gateway.listPublicProducts();
    const asked = products.find((p) => p.title && view.product && p.title === view.product.title);
    for (const alt of view.alternatives) {
      expect(alt.availability.status).toBe('available_now');
      expect(alt.productType.name).toBe(view.productTypeName);
      expect(alt.id).not.toBe(asked?.id);
    }
    // A closed inquiry that was answered gets no alternatives.
    expect((await services.gateway.getBuyerInquiry('status-token-08'))!.alternatives).toEqual([]);
  });
});

describe('lifecycle jobs through the app (STAT-3 to STAT-5, DPRIV-2)', () => {
  it('finds nothing to do on a fresh seed', async () => {
    const { services, state } = setup();
    expect(await services.demo!.runScheduledJobs()).toEqual([]);
    expect(state().outbox).toEqual([]);
  });

  it('sends one reminder at 48 hours, then closes at 14 days and tells the buyer', async () => {
    const { services, time, state } = setup();
    const { statusToken } = await services.gateway.submitInquiry(request(), signals(time.current));
    const id = state().db.inquiries.find((i) => i.statusToken === statusToken)!.id;
    const mine = () => state().db.inquiries.find((i) => i.id === id)!;
    // The seed has open inquiries of its own, so look only at this one.
    const run = async () => (await services.demo!.runScheduledJobs()).filter((e) => 'inquiryId' in e && e.inquiryId === id).map((e) => e.kind);
    const sent = (template: string) => state().outbox.filter((m) => m.template === template && m.relatedInquiryId === id);

    time.current = new Date(NOW.getTime() + 47 * HOUR);
    expect(await run()).toEqual([]);

    time.current = new Date(NOW.getTime() + 49 * HOUR);
    expect(await run()).toEqual(['reminder']);
    expect(mine()).toMatchObject({ status: 'awaiting_response', reminderSentAt: time.current.toISOString() });
    expect(await run()).toEqual([]); // once only
    expect(sent('inquiry_reminder')).toHaveLength(1);
    expect(sent('inquiry_reminder')[0]!.toMasked).toBe('*****01');

    time.current = new Date(NOW.getTime() + 15 * DAY);
    expect(await run()).toContain('closed_unanswered');
    expect(mine()).toMatchObject({ status: 'closed', closedReason: 'unanswered' });
    const told = sent('inquiry_closed');
    expect(told).toHaveLength(1);
    expect(told[0]!.body).toContain(statusToken);
    expect(told[0]!.toMasked).toBe('*****88');

    const view = (await services.gateway.getBuyerInquiry(statusToken))!;
    expect(view).toMatchObject({ status: 'closed', closedReason: 'unanswered' });
    expect(view.alternatives.every((p) => p.availability.status === 'available_now')).toBe(true);
  });

  it('deletes the buyer contact 30 days after closing and keeps the inquiry (DPRIV-2)', async () => {
    const { services, time, state } = setup();
    const { statusToken } = await services.gateway.submitInquiry(request(), signals(time.current));
    const id = state().db.inquiries.find((i) => i.statusToken === statusToken)!.id;

    time.current = new Date(NOW.getTime() + 15 * DAY);
    await services.demo!.runScheduledJobs();
    expect(state().db.inquiry_buyer_contacts.some((c) => c.inquiryId === id)).toBe(true);

    time.current = new Date(NOW.getTime() + 14 * DAY + 31 * DAY);
    await services.demo!.runScheduledJobs();
    expect(state().db.inquiry_buyer_contacts.some((c) => c.inquiryId === id)).toBe(false);
    const row = (await services.gateway.listInquiriesForActor(admin)).find((r) => r.inquiry.id === id)!;
    expect(row.buyer).toBeNull();
    expect(row.inquiry.status).toBe('closed');
  });

  it('closes a responded inquiry with no outcome after the period (STAT-5)', async () => {
    const { services, time, state } = setup();
    await services.demo!.ready(); // seed at NOW before the clock moves
    // inq-06 was answered 18 hours ago. Fourteen days after that reply it closes by itself.
    time.current = new Date(NOW.getTime() + 14 * DAY);
    const events = await services.demo!.runScheduledJobs();
    expect(events.filter((e) => e.kind === 'closed_after_response').map((e) => e.inquiryId)).toContain('inq-06');
    expect(state().db.inquiries.find((i) => i.id === 'inq-06')).toMatchObject({ status: 'closed', closedReason: 'auto_after_response' });
    expect(state().db.inquiries.find((i) => i.id === 'inq-01')).toMatchObject({ status: 'closed', closedReason: 'unanswered' }); // sent 5 hours before NOW
  });

  it('two callers at once do the work once', async () => {
    const { services, time, state } = setup();
    await services.gateway.submitInquiry(request(), signals(time.current));
    time.current = new Date(NOW.getTime() + 49 * HOUR);
    const [a, b] = await Promise.all([services.demo!.runScheduledJobs(), services.demo!.runScheduledJobs()]);
    expect(a.length + b.length).toBeGreaterThan(0);
    const reminders = state().outbox.filter((m) => m.template === 'inquiry_reminder');
    const ids = reminders.map((m) => m.relatedInquiryId);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('fileInquiry (the farmer’s own inbox folders)', () => {
  it('files to buyers or done, survives a reload, and filing back to the inbox undoes it', async () => {
    const storage = createMemoryStorage();
    const { services, db } = setup(storage);
    const [first] = await services.gateway.listInquiriesForActor(farmer);
    const id = first!.inquiry.id;
    const before = db().inquiries.find((i) => i.id === id);

    expect((await services.gateway.fileInquiry(farmer, id, 'buyers')).folder).toBe('buyers');
    const reloaded = setup(storage).services;
    expect((await reloaded.gateway.listInquiriesForActor(farmer)).find((r) => r.inquiry.id === id)!.folder).toBe('buyers');

    expect((await services.gateway.fileInquiry(farmer, id, 'done')).folder).toBe('done');
    expect(db().inquiry_folders.filter((f) => f.inquiryId === id)).toHaveLength(1);
    expect((await services.gateway.fileInquiry(farmer, id, 'inbox')).folder).toBe('inbox');
    expect(db().inquiry_folders.some((f) => f.inquiryId === id)).toBe(false);
    // Filing never touches the inquiry itself: status, timestamps and what the buyer sees stay the same.
    expect(db().inquiries.find((i) => i.id === id)).toEqual(before);
  });

  it('refuses anyone but the farmer the inquiry was sent to', async () => {
    const { services, db } = setup();
    await services.gateway.listInquiriesForActor(farmer);
    const other = db().inquiries.find((i) => i.farmerProfileId !== DEMO_ACCOUNTS.farmer.farmerProfileId)!;
    await expect(services.gateway.fileInquiry(farmer, other.id, 'done')).rejects.toMatchObject({ code: 'forbidden' });
    await expect(services.gateway.fileInquiry(buyer, other.id, 'done')).rejects.toBeInstanceOf(GatewayError);
    await expect(services.gateway.fileInquiry(admin, other.id, 'done')).rejects.toBeInstanceOf(GatewayError);
  });
});
