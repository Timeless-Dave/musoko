import {
  asId,
  type AggregateCount,
  type EventId,
  type PreviewEvent,
  type SearchEvent,
  type SearchFilters,
} from '@/domain/types';
import { communityId } from './communities';
import { productTypeId } from './product-types';
import { dayOnly } from './time';
import { marketId } from './markets';
import { pickupLocationId } from './pickups';

// [days ago, term, matched product type slug, community slug, result count, filters]
type Row = [number, string, string | null, string | null, number, SearchFilters?];

const SEARCHES: Row[] = [
  // Helena-West Helena
  [0, 'collards', 'collard-greens', 'helena-west-helena', 1],
  [1, 'eggs', 'eggs', 'helena-west-helena', 4],
  [1, 'sweet potatoes', 'sweet-potatoes', 'helena-west-helena', 1],
  [3, 'honey', 'honey', 'helena-west-helena', 3],
  [4, 'tomatoes', 'tomatoes', 'helena-west-helena', 4, { availability: 'available_now' }],
  [6, 'milk', 'milk', 'helena-west-helena', 2],
  [8, 'goat milk', null, 'helena-west-helena', 0],
  [11, 'pecans', 'pecans', 'helena-west-helena', 2],
  [15, 'eggs', 'eggs', 'helena-west-helena', 4, { sort: 'unit_price' }],
  [20, 'catfish', null, 'helena-west-helena', 0],
  // Pine Bluff
  [0, 'rice', 'rice', 'pine-bluff', 1],
  [2, 'sorghum', 'sorghum-syrup', 'pine-bluff', 2],
  [5, 'eggs', 'eggs', 'pine-bluff', 4],
  [7, 'tomatoes', 'tomatoes', 'pine-bluff', 4],
  [12, 'pears', null, 'pine-bluff', 0],
  [18, 'honey', 'honey', 'pine-bluff', 3],
  [24, 'kale', 'kale', 'pine-bluff', 1],
  // Forrest City
  [1, 'beef', 'ground-beef', 'forrest-city', 1],
  [4, 'tomatoes', 'tomatoes', 'forrest-city', 4, { fulfilment: 'delivery' }],
  [9, 'kale', 'kale', 'forrest-city', 1],
  [13, 'blackberries', null, 'forrest-city', 0],
  [17, 'bacon', 'pork-products', 'forrest-city', 1],
  [26, 'eggs', 'eggs', 'forrest-city', 4],
  // Marianna, Stuttgart, Dumas, Wynne
  [2, 'peas', 'field-peas', 'marianna', 1],
  [10, 'eggs', 'eggs', 'marianna', 4],
  [22, 'okra', 'okra', 'marianna', 1],
  [3, 'rice', 'rice', 'stuttgart', 1],
  [14, 'grits', 'cornmeal', 'stuttgart', 2],
  [27, 'mushrooms', null, 'stuttgart', 0],
  [5, 'milk', 'milk', 'dumas', 2],
  [16, 'cheese', 'fresh-cheese', 'dumas', 1],
  [21, 'peanuts', null, 'wynne', 0],
  [25, 'turnips', 'turnips', 'wynne', 1],
  // Lake Village: fewer than the minimum sample
  [6, 'apples', 'apples', 'lake-village', 1],
  [19, 'peaches', 'peaches', 'lake-village', 1],
  // Clarendon: searches, no farm
  [2, 'eggs', 'eggs', 'clarendon', 4],
  [7, 'vegetables', null, 'clarendon', 0],
  [12, 'milk', 'milk', 'clarendon', 2],
  [23, 'honey', 'honey', 'clarendon', 3],
  [28, 'chicken', 'whole-chicken', 'clarendon', 1],
  [29, 'greens', null, 'clarendon', 0],
];

export function buildSearchEvents(now: Date): SearchEvent[] {
  return SEARCHES.map(([ago, term, type, com, count, filters], i) => ({
    id: asId<EventId>(`search-${String(i + 1).padStart(3, '0')}`),
    day: dayOnly(now, ago),
    terms: term,
    matchedProductTypeId: type ? productTypeId(type) : null,
    filters: filters ?? {},
    communityId: com ? communityId(com) : null,
    resultCount: count,
  }));
}

export function buildPreviewEvents(now: Date): PreviewEvent[] {
  type P = [number, 'pickup_location' | 'farmers_market', string, 'map' | 'list', number];
  const rows: P[] = [
    [1, 'farmers_market', marketId(1), 'map', 6],
    [2, 'farmers_market', marketId(1), 'list', 3],
    [3, 'pickup_location', pickupLocationId(1), 'map', 4],
    [5, 'farmers_market', marketId(2), 'map', 2],
    [6, 'farmers_market', marketId(3), 'list', 2],
    [8, 'pickup_location', pickupLocationId(2), 'map', 1],
    [10, 'farmers_market', marketId(4), 'map', 1],
    [12, 'farmers_market', marketId(5), 'list', 2],
    [14, 'pickup_location', pickupLocationId(3), 'list', 1],
    [17, 'farmers_market', marketId(1), 'map', 5],
    [21, 'farmers_market', marketId(2), 'list', 2],
    [27, 'pickup_location', pickupLocationId(1), 'list', 3],
  ];
  return rows.map(([ago, targetKind, targetId, surface, count], i) => ({
    id: asId<EventId>(`preview-${String(i + 1).padStart(3, '0')}`),
    day: dayOnly(now, ago), targetKind, targetId, surface, count,
  }));
}

/** Rolled-up counts for a period older than searchEventRetentionDays, so the raw rows are already gone. */
export function buildAggregateCounts(now: Date, retentionDays: number): AggregateCount[] {
  const periodEnd = dayOnly(now, retentionDays + 30);
  const periodStart = dayOnly(now, retentionDays + 60);
  const row = (n: number, metric: AggregateCount['metric'], count: number, over: Partial<AggregateCount> = {}): AggregateCount => ({
    id: asId<EventId>(`aggregate-${String(n).padStart(3, '0')}`),
    metric, periodStart, periodEnd, productTypeId: null, communityId: null, pickupLocationId: null, marketId: null, count, ...over,
  });
  return [
    row(1, 'searches', 31, { productTypeId: productTypeId('tomatoes'), communityId: communityId('helena-west-helena') }),
    row(2, 'searches', 18, { productTypeId: productTypeId('eggs'), communityId: communityId('pine-bluff') }),
    row(3, 'zero_result_searches', 7, { communityId: communityId('clarendon') }),
    row(4, 'inquiries', 12, { productTypeId: productTypeId('sweet-potatoes'), communityId: communityId('helena-west-helena') }),
    row(5, 'preview_opens', 22, { marketId: marketId(1) }),
    row(6, 'preview_opens', 9, { pickupLocationId: pickupLocationId(1) }),
    // The older searches in Clarendon behind row 3, so no-result searches never outnumber the searches.
    row(7, 'searches', 14, { communityId: communityId('clarendon') }),
  ];
}
