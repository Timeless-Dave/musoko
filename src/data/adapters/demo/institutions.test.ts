import { describe, expect, it } from 'vitest';
import { planSourcing } from '@/domain/institutions';
import type { Database } from '@/domain/types';
import type { Actor } from '../../ports/auth';
import { GatewayError } from '../../ports/errors';
import { DEMO_ACCOUNTS } from '../../seed';
import { createDemoServices } from './index';
import { createMemoryStorage, DEMO_STORAGE_KEY, type DemoState } from './store';

const NOW = new Date('2026-11-15T15:00:00.000Z');

function setup() {
  const storage = createMemoryStorage();
  const time = { current: NOW };
  const services = createDemoServices({ clock: { now: () => time.current }, storage });
  const db = (): Database => (JSON.parse(storage.getItem(DEMO_STORAGE_KEY)!) as { state: DemoState }).state.db;
  return { time, services, db };
}

const farmer: Actor = { role: 'farmer', userId: DEMO_ACCOUNTS.farmer.userId, farmerProfileId: DEMO_ACCOUNTS.farmer.farmerProfileId };
const signals = (openedAt: Date) => ({ honeypot: '', openedAt: new Date(openedAt.getTime() - 60_000).toISOString(), sessionKey: 'tab-1' });

const profile = {
  name: 'Riverside Middle School', kind: 'school' as const, communityId: 'com-marianna', about: '', receivingNote: '',
  showName: false, contactName: 'Kitchen lead', phone: null, email: 'kitchen@riverside.example',
};

describe('institutional buyers', () => {
  it('keeps the contact private and the name hidden when asked', async () => {
    const { services } = setup();
    const receipt = await services.gateway.registerInstitution(profile);
    const pub = (await services.gateway.listPublicInstitutions()).find((i) => i.id === receipt.institutionId)!;
    expect(pub.buyerLabel).toBe('A school in Marianna');
    const text = JSON.stringify(await services.gateway.listPublicInstitutions());
    expect(text).not.toContain('kitchen@riverside.example');
    expect(text).not.toContain('Riverside Middle School');
    expect(text).not.toContain(receipt.editToken);
    expect(text).not.toContain('demo-institution-1');
  });

  it('opens a profile only with its edit token', async () => {
    const { services } = setup();
    const receipt = await services.gateway.registerInstitution(profile);
    expect(await services.gateway.getOwnInstitution('nope')).toBeNull();
    expect(await services.gateway.getOwnInstitution('')).toBeNull();
    const own = await services.gateway.getOwnInstitution(receipt.editToken);
    expect(own?.contact.email).toBe('kitchen@riverside.example');
    await expect(services.gateway.addInstitutionNeed('nope', { productTypeId: 'ptype-eggs', amount: 10, cadence: 'weekly', startMonth: '2026-12', endMonth: '2027-02', note: '' })).rejects.toBeInstanceOf(GatewayError);
    const after = await services.gateway.addInstitutionNeed(receipt.editToken, { productTypeId: 'ptype-eggs', amount: 10, cadence: 'weekly', startMonth: '2026-12', endMonth: '2027-02', note: '' });
    expect(after.needs).toHaveLength(1);
  });

  it('rejects a need that ends before it starts', async () => {
    const { services } = setup();
    const { editToken } = await services.gateway.registerInstitution(profile);
    await expect(
      services.gateway.addInstitutionNeed(editToken, { productTypeId: 'ptype-eggs', amount: 10, cadence: 'weekly', startMonth: '2027-02', endMonth: '2026-12', note: '' }),
    ).rejects.toMatchObject({ code: 'invalid' });
  });

  it('sends one order as one inquiry per farm, marked as institutional, in one group', async () => {
    const { services, db } = setup();
    const products = await services.gateway.listPublicProducts();
    const eggs = products.filter((p) => p.productType.slug === 'eggs' && p.availability.status === 'available_now');
    expect(eggs.length).toBeGreaterThan(0);
    const lines = eggs.slice(0, 2).map((p) => ({
      farmerProfileId: p.farm.id, productId: p.id, pickupOptionId: p.pickupOptions[0]?.id ?? null, amount: 4, unit: p.sellingUnit,
    }));
    const receipt = await services.gateway.submitBulkRequest(
      { organisation: 'Riverside Middle School', institutionId: null, communityId: 'com-marianna', contactName: 'Kitchen lead', replyChannel: 'email', phone: null, email: 'kitchen@riverside.example', neededBy: null, cadence: 'weekly', message: 'Graded please.', lines },
      signals(NOW),
    );
    expect(receipt.statusTokens).toHaveLength(lines.length);
    const made = db().inquiries.filter((i) => i.requestGroup === receipt.requestGroup);
    expect(made).toHaveLength(lines.length);
    expect(made.every((i) => i.buyerKind === 'institution' && i.status === 'awaiting_response')).toBe(true);
    const contacts = db().inquiry_buyer_contacts.filter((c) => made.some((i) => i.id === c.inquiryId));
    expect(contacts.every((c) => c.organisation === 'Riverside Middle School' && c.message.includes('Repeats every week.'))).toBe(true);
    // The farmer sees it in their own inbox like any inquiry.
    const own = await services.gateway.listInquiriesForActor(farmer);
    const mine = made.filter((i) => i.farmerProfileId === farmer.farmerProfileId);
    for (const i of mine) expect(own.some((r) => r.inquiry.id === i.id)).toBe(true);
  });

  it('stores nothing when any line of an order is not listed', async () => {
    const { services } = setup();
    const before = (await services.demo!.getTableCounts()).inquiries;
    await expect(
      services.gateway.submitBulkRequest(
        { organisation: 'X', institutionId: null, communityId: null, contactName: 'Y', replyChannel: 'email', phone: null, email: 'y@x.example', neededBy: null, cadence: 'one_time', message: '', lines: [
          { farmerProfileId: 'farm-01', productId: 'prod-001', pickupOptionId: 'option-01', amount: 2, unit: 'bunch' },
          { farmerProfileId: 'farm-01', productId: 'prod-does-not-exist', pickupOptionId: 'option-01', amount: 2, unit: 'bunch' },
        ] },
        signals(NOW),
      ),
    ).rejects.toBeInstanceOf(GatewayError);
    expect((await services.demo!.getTableCounts()).inquiries).toBe(before);
  });

  it('gives a farmer planning rows with suppressed small search counts and planned buyers near them', async () => {
    const { services } = setup();
    const plan = await services.gateway.getFarmerPlanning(farmer);
    expect(plan.rows.length).toBeGreaterThan(0);
    for (const r of plan.rows) {
      if (r.searches !== null) expect(r.searches).toBeGreaterThanOrEqual(plan.minimumSampleSize);
      expect(r.advice.length).toBeGreaterThan(0);
      expect(JSON.stringify(r)).not.toMatch(/\.example|870-555/);
    }
    expect(plan.rows.some((r) => r.seasonTotal > 0)).toBe(true);
    await expect(services.gateway.getFarmerPlanning({ role: 'buyer', userId: DEMO_ACCOUNTS.buyer.userId, farmerProfileId: null })).rejects.toBeInstanceOf(GatewayError);
  });
});

describe('planSourcing', () => {
  it('fills from farms that stated an amount, nearest first, and asks the rest of farms that did not', async () => {
    const { services } = setup();
    const products = await services.gateway.listPublicProducts();
    const communities = await services.gateway.listCommunities();
    const types = await services.gateway.listProductTypes();
    const eggs = types.find((t) => t.slug === 'eggs')!;
    const plan = planSourcing({ productType: eggs, amount: 40, products, from: communities[0], communities });
    expect(plan.lines.length).toBeGreaterThan(0);
    const known = plan.lines.filter((l) => l.quantityKnown).reduce((s, l) => s + l.amount, 0);
    expect(Math.round(known * 10) / 10).toBe(plan.covered);
    expect(plan.covered).toBeLessThanOrEqual(40);
    for (const l of plan.lines) expect(l.sellingUnits).toBeGreaterThan(0);
    const small = planSourcing({ productType: eggs, amount: 0.5, products, from: communities[0], communities });
    expect(small.lines).toHaveLength(1);
  });
});
