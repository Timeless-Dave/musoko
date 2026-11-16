import {
  asId,
  type FarmerPickupOptionId,
  type FarmersMarketId,
  type PickupLocationId,
  type ProductTypeId,
  type Inquiry,
  type InquiryBuyerContact,
  type InquiryId,
  type InquiryOutcome,
  type InquiryReply,
  type InquiryReplyId,
} from '@/domain/types';
import { communityId } from './communities';
import { farmId } from './farms';
import { productId } from './products';
import { daysAgo, hoursAgo } from './time';

const inqId = (n: number) => asId<InquiryId>(`inq-${String(n).padStart(2, '0')}`);

// Option ids come from pickups.ts: option-01 market (farm-01), option-02 pickup, option-03 delivery, option-04 farm-02 pickup.
const OPT = (n: number) => asId<FarmerPickupOptionId>(`option-${String(n).padStart(2, '0')}`);

export function buildInquiries(now: Date): {
  inquiries: Inquiry[];
  contacts: InquiryBuyerContact[];
  replies: InquiryReply[];
  outcomes: InquiryOutcome[];
} {
  const base = (n: number, over: Partial<Inquiry> & Pick<Inquiry, 'status' | 'farmerProfileId' | 'createdAt'>): Inquiry => ({
    id: inqId(n),
    statusToken: `status-token-${String(n).padStart(2, '0')}`,
    productId: null,
    productTypeId: null,
    communityId: communityId('helena-west-helena'),
    pickupOptionId: null,
    chosenOptionKind: null,
    pickupLocationId: null,
    marketId: null,
    requestedQuantity: null,
    replyChannel: 'text',
    respondedAt: null,
    reminderSentAt: null,
    closedAt: null,
    closedReason: null,
    ...over,
  });
  const f1 = farmId(1);
  const market = { pickupOptionId: OPT(1), chosenOptionKind: 'farmers_market' as const, marketId: asId<FarmersMarketId>('market-01') };
  const shed = { pickupOptionId: OPT(2), chosenOptionKind: 'pickup_location' as const, pickupLocationId: asId<PickupLocationId>('pickup-01') };
  const delivery = { pickupOptionId: OPT(3), chosenOptionKind: 'own_delivery' as const };
  const ptype = (slug: string) => asId<ProductTypeId>(`ptype-${slug}`);

  const inquiries: Inquiry[] = [
    // awaiting (3): one older than the reminder period, with the reminder sent
    base(1, { status: 'awaiting_response', farmerProfileId: f1, createdAt: hoursAgo(now, 5), productId: productId(1), productTypeId: ptype('collard-greens'), requestedQuantity: { amount: 3, unit: 'bunch' }, ...market }),
    base(2, { status: 'awaiting_response', farmerProfileId: f1, createdAt: hoursAgo(now, 60), reminderSentAt: hoursAgo(now, 12), productId: productId(2), productTypeId: ptype('sweet-potatoes'), requestedQuantity: { amount: 10, unit: 'lb' }, replyChannel: 'email', ...shed }),
    base(3, { status: 'awaiting_response', farmerProfileId: f1, createdAt: hoursAgo(now, 2), productId: productId(7), productTypeId: ptype('tomatoes'), requestedQuantity: { amount: 2, unit: 'pint' }, ...delivery }),
    // responded (3)
    base(4, { status: 'responded', farmerProfileId: f1, createdAt: daysAgo(now, 3), respondedAt: daysAgo(now, 2.5), productId: productId(6), productTypeId: ptype('winter-squash'), requestedQuantity: { amount: 4, unit: 'lb' }, ...market }),
    base(5, { status: 'responded', farmerProfileId: f1, createdAt: daysAgo(now, 4), respondedAt: daysAgo(now, 3.5), productId: productId(1), productTypeId: ptype('collard-greens'), communityId: communityId('lake-village'), ...shed }),
    base(6, { status: 'responded', farmerProfileId: f1, createdAt: daysAgo(now, 1), respondedAt: hoursAgo(now, 18), productId: productId(2), productTypeId: ptype('sweet-potatoes'), requestedQuantity: { amount: 20, unit: 'lb' }, ...delivery }),
    // closed (4)
    base(7, { status: 'closed', farmerProfileId: f1, createdAt: daysAgo(now, 20), closedAt: daysAgo(now, 6), closedReason: 'unanswered', productId: productId(5), productTypeId: ptype('mustard-greens'), ...market }),
    base(8, { status: 'closed', farmerProfileId: f1, createdAt: daysAgo(now, 12), respondedAt: daysAgo(now, 11), closedAt: daysAgo(now, 8), closedReason: 'outcome_recorded', productId: productId(2), productTypeId: ptype('sweet-potatoes'), ...market }),
    base(9, { status: 'closed', farmerProfileId: farmId(2), createdAt: daysAgo(now, 10), respondedAt: daysAgo(now, 9.5), closedAt: daysAgo(now, 6), closedReason: 'outcome_recorded', productId: productId(8), productTypeId: ptype('eggs'), pickupOptionId: OPT(4), chosenOptionKind: 'pickup_location', pickupLocationId: asId<PickupLocationId>('pickup-01') }),
    // old: contact rows already deleted by the retention rule
    base(10, { status: 'closed', farmerProfileId: f1, createdAt: daysAgo(now, 60), respondedAt: daysAgo(now, 59), closedAt: daysAgo(now, 45), closedReason: 'auto_after_response', productId: productId(6), productTypeId: ptype('winter-squash'), ...market }),
  ];

  // Fictional buyers. Phones 870-555-01xx, emails .example. Inquiry 10 has no row: retention has run.
  const contact = (n: number, name: string, phone: string | null, email: string | null, message: string): InquiryBuyerContact =>
    ({ inquiryId: inqId(n), name, phone, email, message });
  const contacts: InquiryBuyerContact[] = [
    contact(1, 'Renata Voss', '870-555-0171', null, 'Are the collards fresh this week?'),
    contact(2, 'Marcus Delacroix-Neal', null, 'marcus.neal@buyers.example', 'Could I pick up sweet potatoes at the shed?'),
    contact(3, 'Renata Voss', '870-555-0171', null, 'Two pints of cherry tomatoes, please.'),
    contact(4, 'Josephine Albright', '870-555-0172', null, 'Four pounds of butternut for a soup.'),
    contact(5, 'Lucille Marchetti', '870-555-0173', null, 'Do you have collards left?'),
    contact(6, 'Hector Brandt', '870-555-0174', 'hector.brandt@buyers.example', 'Twenty pounds of sweet potatoes for a church supper.'),
    contact(7, 'Tamsin Rourke', null, 'tamsin.rourke@buyers.example', 'Any mustard greens?'),
    contact(8, 'Josephine Albright', '870-555-0172', null, 'Ten pounds of sweet potatoes.'),
    contact(9, 'Desmond Okoye-Hart', '870-555-0175', null, 'A dozen eggs, picked up Monday.'),
  ];

  const reply = (n: number, inquiry: number, kind: InquiryReply['kind'], message: string | null, phoneShared: boolean, createdAt: string): InquiryReply => ({
    id: asId<InquiryReplyId>(`reply-${String(n).padStart(2, '0')}`), inquiryId: inqId(inquiry), kind, message, phoneShared, createdAt,
  });
  const replies: InquiryReply[] = [
    reply(1, 4, 'available', 'Yes, four pounds. See you Saturday.', false, daysAgo(now, 2.5)),
    reply(2, 5, 'sold_out', 'Sorry, the collards are gone until next week.', false, daysAgo(now, 3.5)),
    reply(3, 6, 'contact_me', 'Call me and we will work out the quantity.', true, hoursAgo(now, 18)),
    reply(4, 8, 'available', 'Ten pounds, ready Saturday.', false, daysAgo(now, 11)),
    reply(5, 9, 'available', 'Monday morning works.', false, daysAgo(now, 9.5)),
    reply(6, 10, 'available', 'Yes, two squash.', false, daysAgo(now, 59)),
  ];

  const outcomes: InquiryOutcome[] = [
    { inquiryId: inqId(8), outcome: 'sale', recordedAt: daysAgo(now, 8) },
    { inquiryId: inqId(9), outcome: 'new_potential_customer', recordedAt: daysAgo(now, 6) },
  ];

  return { inquiries, contacts, replies, outcomes };
}
