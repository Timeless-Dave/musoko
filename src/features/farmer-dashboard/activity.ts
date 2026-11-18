import { copy } from '@/content/copy';
import type { OwnListing } from '@/domain/farmer';
import type { InquiryRecord } from '@/domain/inquiry';

export interface ActivityItem {
  key: string;
  at: string;
  text: string;
  href: string;
}

const words = copy.dashboard.today.activity;

/** The farmer's own recent events, newest first: inquiries in, replies out, listings confirmed. */
export function recentActivity(
  inquiries: readonly InquiryRecord[],
  listings: readonly OwnListing[],
  limit = 15,
): ActivityItem[] {
  const items: ActivityItem[] = [];
  for (const r of inquiries) {
    const who = r.buyer?.name || words.someone;
    const id = r.inquiry.id;
    items.push({ key: `${id}-in`, at: r.inquiry.createdAt, text: words.asked(who, r.productTitle), href: '/dashboard/inquiries' });
    if (r.inquiry.respondedAt) {
      items.push({ key: `${id}-reply`, at: r.inquiry.respondedAt, text: words.replied(who), href: '/dashboard/inquiries' });
    }
    if (r.inquiry.closedAt) {
      const text = r.inquiry.closedReason === 'unanswered' ? words.closedUnanswered(who) : words.closed(who);
      items.push({ key: `${id}-closed`, at: r.inquiry.closedAt, text, href: '/dashboard/inquiries' });
    }
  }
  for (const l of listings) {
    if (!l.availability.lastConfirmedAt) continue;
    items.push({
      key: `${l.product.id}-confirmed`,
      at: l.availability.lastConfirmedAt,
      text: words.confirmed(l.product.title),
      href: `/dashboard/listings/${l.product.id}`,
    });
  }
  return items.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0)).slice(0, limit);
}
