import { describe, expect, it, vi } from 'vitest';
import { defaultSettings } from '@/config/settings';
import { effectiveStatus } from '@/domain/availability';
import type { FarmerProfileId, ProductId } from '@/domain/types';
import { asId } from '@/domain/types';
import type { Actor } from '../../ports/auth';
import { GatewayError } from '../../ports/errors';
import { buildSeed, DEMO_ACCOUNTS } from '../../seed';
import { maskRecipient } from './notifications';
import { createDemoServices } from './index';
import { createMemoryStorage, DEMO_SCHEMA_VERSION, DEMO_STORAGE_KEY, type DemoState, type DemoStorage } from './store';

const NOW = new Date('2026-11-15T15:00:00.000Z');
const clock = { now: () => NOW };
const LAPSED = asId<ProductId>('prod-004'); // demo farmer's pole beans, 17 days old
const farmerActor: Actor = { role: 'farmer', userId: DEMO_ACCOUNTS.farmer.userId, farmerProfileId: DEMO_ACCOUNTS.farmer.farmerProfileId };

const open = (storage: DemoStorage) => createDemoServices({ clock, storage });
const status = async (s: ReturnType<typeof open>, id: ProductId) =>
  (await s.gateway.listPublicProducts()).find((p) => p.id === id)!.availability.status;
const stored = (storage: DemoStorage): { state: DemoState; version: number } => JSON.parse(storage.getItem(DEMO_STORAGE_KEY)!);

describe('persistence (MODE-1)', () => {
  it('seeds on first load and writes the versioned key', async () => {
    const storage = createMemoryStorage();
    const s = open(storage);
    await s.demo!.ready();
    expect(stored(storage).version).toBe(DEMO_SCHEMA_VERSION);
    expect(stored(storage).state.db).toEqual(buildSeed(NOW, defaultSettings));
  });

  it('keeps a confirmation after a reload', async () => {
    const storage = createMemoryStorage();
    const first = open(storage);
    expect(await status(first, LAPSED)).toBe('unconfirmed');
    await first.gateway.farmerConfirmAvailability(farmerActor, LAPSED);
    expect(await status(first, LAPSED)).toBe('available_now');

    const second = open(storage); // a reload: new services over the same storage
    expect(await status(second, LAPSED)).toBe('available_now');
    const { db } = stored(storage).state;
    expect(db.product_availability_history.filter((h) => h.productId === LAPSED)).toHaveLength(2);
  });

  it('has written to storage by the time the write resolves', async () => {
    const storage = createMemoryStorage();
    const s = open(storage);
    await s.gateway.farmerConfirmAvailability(farmerActor, LAPSED);
    const row = stored(storage).state.db.product_availability.find((a) => a.productId === LAPSED)!;
    expect(effectiveStatus(row, NOW, defaultSettings)).toBe('available_now');
  });

  it('keeps the role across a reload and leaves the data alone', async () => {
    const storage = createMemoryStorage();
    const first = open(storage);
    await first.demo!.ready();
    const before = stored(storage).state.db;
    const session = await first.demo!.switchRole('farmer');
    expect(session.role).toBe('farmer');
    expect(session.farmerProfileId).toBe(DEMO_ACCOUNTS.farmer.farmerProfileId);
    expect(session.user.displayName).toBe('Odell Fairweather');
    const second = open(storage);
    expect((await second.auth.getSession())!.role).toBe('farmer');
    expect(stored(storage).state.db).toEqual(before);
  });

  it('signs out to the buyer account', async () => {
    const s = open(createMemoryStorage());
    await s.demo!.switchRole('administrator');
    await s.auth.signOut();
    expect((await s.auth.getSession())!.role).toBe('buyer');
  });
});

describe('reset (MODE-3)', () => {
  it('restores a state deep-equal to the seed, keeps the role, clears outbox and notice', async () => {
    const storage = createMemoryStorage();
    const s = open(storage);
    await s.demo!.switchRole('farmer');
    await s.gateway.farmerConfirmAvailability(farmerActor, LAPSED);
    await s.notifications.send({ channel: 'sms', to: '870-555-0171', template: 'inquiry_received', body: 'x', relatedInquiryId: null });
    await s.demo!.reset();
    const after = stored(storage).state;
    expect(after.db).toEqual(buildSeed(NOW, defaultSettings));
    expect(after.session.role).toBe('farmer');
    expect(after.outbox).toEqual([]);
    expect(after.notice).toBeNull();
    expect(await status(s, LAPSED)).toBe('unconfirmed');
  });
});

describe('version and corruption', () => {
  it('reseeds with a notice when the stored version differs', async () => {
    const storage = createMemoryStorage();
    const first = open(storage);
    await first.demo!.ready();
    const old = stored(storage);
    old.version = DEMO_SCHEMA_VERSION - 1;
    old.state.db.products = [];
    storage.setItem(DEMO_STORAGE_KEY, JSON.stringify(old));

    const s = open(storage);
    expect((await s.demo!.getNotice())?.kind).toBe('reseeded_after_version_change');
    expect((await s.gateway.listPublicProducts()).length).toBeGreaterThan(30);
    expect(stored(storage).version).toBe(DEMO_SCHEMA_VERSION);
    await s.demo!.dismissNotice();
    expect(await s.demo!.getNotice()).toBeNull();
    expect(await open(storage).demo!.getNotice()).toBeNull();
  });

  it('reseeds with a notice on unparseable JSON', async () => {
    const storage = createMemoryStorage();
    storage.setItem(DEMO_STORAGE_KEY, '{not json');
    const s = open(storage);
    expect((await s.demo!.getNotice())?.kind).toBe('reseeded_after_corrupt_state');
    expect((await s.gateway.listPublicFarms()).length).toBe(11);
  });

  it('reseeds with a notice on valid JSON of the wrong shape', async () => {
    const storage = createMemoryStorage();
    storage.setItem(DEMO_STORAGE_KEY, JSON.stringify({ state: { db: 3 }, version: DEMO_SCHEMA_VERSION }));
    const s = open(storage);
    expect((await s.demo!.getNotice())?.kind).toBe('reseeded_after_corrupt_state');
  });
});

describe('farmerConfirmAvailability access', () => {
  it('rejects a buyer, an administrator and a farmer who does not own the product', async () => {
    const s = open(createMemoryStorage());
    const buyer: Actor = { role: 'buyer', userId: DEMO_ACCOUNTS.buyer.userId, farmerProfileId: null };
    const admin: Actor = { role: 'administrator', userId: DEMO_ACCOUNTS.administrator.userId, farmerProfileId: null };
    const other: Actor = { ...farmerActor, farmerProfileId: asId<FarmerProfileId>('farm-02') };
    for (const actor of [buyer, admin, other]) {
      await expect(s.gateway.farmerConfirmAvailability(actor, LAPSED)).rejects.toMatchObject({ code: 'forbidden' });
    }
    expect(await status(s, LAPSED)).toBe('unconfirmed');
  });

  it('rejects an unknown product and an actor whose user does not own the farm', async () => {
    const s = open(createMemoryStorage());
    await expect(s.gateway.farmerConfirmAvailability(farmerActor, asId('prod-999'))).rejects.toBeInstanceOf(GatewayError);
    await expect(s.gateway.farmerConfirmAvailability(farmerActor, asId('prod-999'))).rejects.toMatchObject({ code: 'not_found' });
    const impostor: Actor = { ...farmerActor, userId: DEMO_ACCOUNTS.buyer.userId };
    await expect(s.gateway.farmerConfirmAvailability(impostor, LAPSED)).rejects.toMatchObject({ code: 'forbidden' });
  });

  it('does not write history when the listing was already fresh', async () => {
    const storage = createMemoryStorage();
    const s = open(storage);
    const fresh = asId<ProductId>('prod-001');
    await s.gateway.farmerConfirmAvailability(farmerActor, fresh);
    expect(stored(storage).state.db.product_availability_history.filter((h) => h.productId === fresh)).toHaveLength(1);
  });

  it('rejects and rolls back when the browser cannot store the change', async () => {
    const backing = createMemoryStorage();
    let failWrites = false;
    const flaky: DemoStorage = {
      getItem: (k) => backing.getItem(k),
      removeItem: (k) => backing.removeItem(k),
      setItem: (k, v) => {
        if (failWrites) throw new Error('quota');
        backing.setItem(k, v);
      },
    };
    const s = open(flaky);
    await s.demo!.ready();
    failWrites = true;
    await expect(s.gateway.farmerConfirmAvailability(farmerActor, LAPSED)).rejects.toMatchObject({ code: 'invalid' });
    expect(await status(s, LAPSED)).toBe('unconfirmed');
  });
});

describe('subscribe and notifications', () => {
  it('fires after a write, a role switch and a reset', async () => {
    const s = open(createMemoryStorage());
    await s.demo!.ready();
    const listener = vi.fn();
    const off = s.demo!.subscribe(listener);
    await s.gateway.farmerConfirmAvailability(farmerActor, LAPSED);
    expect(listener).toHaveBeenCalledTimes(1);
    await s.demo!.switchRole('farmer');
    expect(listener).toHaveBeenCalledTimes(2);
    await s.demo!.reset();
    expect(listener).toHaveBeenCalledTimes(3);
    off();
    await s.demo!.switchRole('buyer');
    expect(listener).toHaveBeenCalledTimes(3);
  });

  it('notifies auth listeners only when the session changes', async () => {
    const s = open(createMemoryStorage());
    await s.demo!.ready();
    const listener = vi.fn();
    s.auth.subscribe(listener);
    await s.gateway.farmerConfirmAvailability(farmerActor, LAPSED);
    expect(listener).not.toHaveBeenCalled();
    await s.demo!.switchRole('administrator');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('stores and logs masked recipients only', async () => {
    const storage = createMemoryStorage();
    const s = open(storage);
    const log = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    await s.notifications.send({ channel: 'sms', to: '870-555-0171', template: 'inquiry_received', body: 'A buyer asked about your eggs.', relatedInquiryId: null });
    await s.notifications.send({ channel: 'email', to: 'renata.voss@buyers.example', template: 'inquiry_reply', body: 'The farmer replied.', relatedInquiryId: null });
    const outbox = await s.demo!.listOutbox();
    expect(outbox).toHaveLength(2);
    const everything = JSON.stringify(outbox) + storage.getItem(DEMO_STORAGE_KEY)!.slice(storage.getItem(DEMO_STORAGE_KEY)!.indexOf('"outbox"')) + log.mock.calls.flat().join(' ');
    expect(everything).not.toContain('870-555-0171');
    expect(everything).not.toContain('renata.voss@buyers.example');
    expect(outbox[0]!.toMasked).toBe('*****71');
    expect(outbox[1]!.toMasked).toBe('r*****@buyers.example');
    log.mockRestore();
  });

  it('masks recipients', () => {
    expect(maskRecipient('sms', '870-555-0102')).toBe('*****02');
    expect(maskRecipient('email', 'a@b.example')).toBe('a*****@b.example');
  });
});

describe('other controls', () => {
  it('counts every table but settings', async () => {
    const s = open(createMemoryStorage());
    const counts = await s.demo!.getTableCounts();
    expect(counts.farmer_profiles).toBe(12);
    expect(counts.farmers_markets).toBe(5);
    expect(Object.keys(counts)).not.toContain('settings');
  });
  it('rejects image upload until a later step', async () => {
    const s = open(createMemoryStorage());
    await expect(s.images.save(new Blob(['x']), { alt: 'x', maxWidth: 10 })).rejects.toMatchObject({ code: 'not_implemented' });
  });
});
