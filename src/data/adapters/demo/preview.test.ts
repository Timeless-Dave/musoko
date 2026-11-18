import { describe, expect, it } from 'vitest';
import type { PreviewEvent } from '@/domain/types';
import { GatewayError } from '../../ports/errors';
import { createDemoServices } from './index';
import { createMemoryStorage, DEMO_STORAGE_KEY, type DemoState } from './store';

const NOW = new Date('2026-11-15T15:00:00.000Z');
const clock = { now: () => NOW };

const events = (storage: ReturnType<typeof createMemoryStorage>): PreviewEvent[] =>
  (JSON.parse(storage.getItem(DEMO_STORAGE_KEY)!).state as DemoState).db.preview_events;

describe('preview-open counting (DATA-4)', () => {
  it('adds one anonymous row for the first open and counts repeats on the same row', async () => {
    const storage = createMemoryStorage();
    const { gateway, demo } = createDemoServices({ clock, storage });
    await demo!.ready();
    const before = events(storage).length;

    await gateway.recordPreviewOpen({ targetKind: 'farmers_market', targetId: 'market-02', surface: 'map' });
    await gateway.recordPreviewOpen({ targetKind: 'farmers_market', targetId: 'market-02', surface: 'map' });
    await gateway.recordPreviewOpen({ targetKind: 'farmers_market', targetId: 'market-02', surface: 'list' });

    const rows = events(storage);
    expect(rows).toHaveLength(before + 2);
    const today = rows.filter((e) => e.day === '2026-11-15' && e.targetId === 'market-02');
    expect(today.find((e) => e.surface === 'map')?.count).toBe(2);
    expect(today.find((e) => e.surface === 'list')?.count).toBe(1);
  });

  it('stores only the place, surface, day and count, nothing about the visitor', async () => {
    const storage = createMemoryStorage();
    const { gateway } = createDemoServices({ clock, storage });
    await gateway.recordPreviewOpen({ targetKind: 'pickup_location', targetId: 'pickup-01', surface: 'list' });
    const row = events(storage).find((e) => e.day === '2026-11-15' && e.targetId === 'pickup-01')!;
    expect(Object.keys(row).sort()).toEqual(['count', 'day', 'id', 'surface', 'targetId', 'targetKind']);
  });

  it('keeps the count after a reload', async () => {
    const storage = createMemoryStorage();
    await createDemoServices({ clock, storage }).gateway.recordPreviewOpen({
      targetKind: 'pickup_location',
      targetId: 'pickup-03',
      surface: 'map',
    });
    const second = createDemoServices({ clock, storage });
    await second.demo!.ready();
    expect(events(storage).find((e) => e.day === '2026-11-15' && e.targetId === 'pickup-03')?.count).toBe(1);
  });

  it('counts farm and product opens the same way', async () => {
    const storage = createMemoryStorage();
    const { gateway, demo } = createDemoServices({ clock, storage });
    await demo!.ready();
    // The seed already has some opens for the demo farm today; each open adds exactly one.
    const count = (kind: string, id: string, surface: string) =>
      events(storage)
        .filter((e) => e.day === '2026-11-15' && e.targetKind === kind && e.targetId === id && e.surface === surface)
        .reduce((n, e) => n + e.count, 0);
    const farmBefore = count('farm', 'farm-01', 'profile');
    const productBefore = count('product', 'prod-003', 'card');
    await gateway.recordPreviewOpen({ targetKind: 'farm', targetId: 'farm-01', surface: 'profile' });
    await gateway.recordPreviewOpen({ targetKind: 'product', targetId: 'prod-003', surface: 'card' });
    expect(count('farm', 'farm-01', 'profile')).toBe(farmBefore + 1);
    expect(count('product', 'prod-003', 'card')).toBe(productBefore + 1);
  });

  it('rejects a place that does not exist or is the wrong kind', async () => {
    const { gateway } = createDemoServices({ clock, storage: createMemoryStorage() });
    await expect(
      gateway.recordPreviewOpen({ targetKind: 'farmers_market', targetId: 'nowhere', surface: 'map' }),
    ).rejects.toBeInstanceOf(GatewayError);
    await expect(
      gateway.recordPreviewOpen({ targetKind: 'pickup_location', targetId: 'market-01', surface: 'map' }),
    ).rejects.toBeInstanceOf(GatewayError);
  });
});
