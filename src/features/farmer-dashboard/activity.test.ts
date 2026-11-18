import { describe, expect, it } from 'vitest';
import type { OwnListing } from '@/domain/farmer';
import type { InquiryRecord } from '@/domain/inquiry';
import { recentActivity } from './activity';

const inquiry = (id: string, over: Partial<InquiryRecord['inquiry']>, buyer: string | null = 'Renata'): InquiryRecord =>
  ({
    inquiry: { id, createdAt: '2026-11-01T10:00:00.000Z', respondedAt: null, closedAt: null, closedReason: null, ...over },
    buyer: buyer ? { name: buyer, phone: null, email: null, message: '' } : null,
    productTitle: 'Okra',
  }) as unknown as InquiryRecord;

const listing = (id: string, confirmed: string | null): OwnListing =>
  ({ product: { id, title: 'Sweet potatoes' }, availability: { lastConfirmedAt: confirmed } }) as unknown as OwnListing;

describe('recentActivity', () => {
  it('lists inquiries, replies, closures and confirmations newest first', () => {
    const items = recentActivity(
      [inquiry('a', { respondedAt: '2026-11-02T10:00:00.000Z' }), inquiry('b', { createdAt: '2026-11-03T10:00:00.000Z', closedAt: '2026-11-05T10:00:00.000Z', closedReason: 'unanswered' } as never, null)],
      [listing('p1', '2026-11-04T10:00:00.000Z'), listing('p2', null)],
    );
    expect(items.map((i) => i.text)).toEqual([
      'The inquiry from A buyer closed without a reply',
      'You confirmed Sweet potatoes is still available',
      'A buyer asked about Okra',
      'You replied to Renata',
      'Renata asked about Okra',
    ]);
  });

  it('keeps only the newest items', () => {
    const many = Array.from({ length: 20 }, (_, i) => inquiry(`i${i}`, { createdAt: `2026-11-${String(i + 1).padStart(2, '0')}T00:00:00.000Z` }));
    const items = recentActivity(many, [], 5);
    expect(items).toHaveLength(5);
    expect(items[0]?.at).toBe('2026-11-20T00:00:00.000Z');
  });
});
