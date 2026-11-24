import 'server-only';
import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import { copy } from '@/content/copy';
import type { Community, PublicFarm, PublicProduct } from '@/domain/types';
import { pickupSummary, quantityLine, scheduleLines, statusDetail } from '@/features/catalogue/format';
import { formatListingPrice, formatUnitPrice } from '@/lib/format';
import { directionsUrl, findCommunity, findPlace, loadCatalogue, milesBetween, type Catalogue } from './catalogue';

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://getmusoko.vercel.app';

const RANK = { available_now: 0, coming_soon: 1, unconfirmed: 2 } as const;
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

function centreOf(cat: Catalogue, communityId: string) {
  return cat.communities.find((c) => c.id === communityId)?.centre ?? null;
}

function milesText(cat: Catalogue, from: Community | null, communityId: string): string {
  const to = centreOf(cat, communityId);
  if (!from || !to) return '';
  const miles = milesBetween(from.centre, to);
  return miles < 1 ? ' (in that town)' : ` (about ${Math.round(miles)} mi from ${from.name})`;
}

function listingLine(cat: Catalogue, p: PublicProduct, from: Community | null, now: Date): string {
  const price = formatListingPrice(p.priceCents, p.sellingUnit, p.unitSize);
  const unit = p.normalizedUnitPrice ? `, ${formatUnitPrice(p.normalizedUnitPrice)}` : '';
  const status = copy.availability[p.availability.status];
  const detail = statusDetail(p, now);
  const pickup = pickupSummary(p.pickupOptions);
  const qty = quantityLine(p);
  return [
    `- ${p.title} from ${p.farm.farmName}, ${p.farm.town}${milesText(cat, from, p.farm.communityId)}.`,
    `  ${price}${unit}. ${status}${detail ? ` (${detail})` : ''}.`,
    pickup ? `  ${pickup}.` : '',
    qty ? `  ${qty} (farmer's estimate).` : '',
    p.licenceSelfConfirmed ? '  Licence or inspection: farmer-reported.' : '',
    `  Contact the farmer: ${SITE}/inquiry/new?product=${p.id}`,
  ]
    .filter(Boolean)
    .join('\n');
}

function farmLine(cat: Catalogue, f: PublicFarm, from: Community | null): string {
  const listings = cat.products.filter((p) => p.farm.id === f.id);
  const now = listings.filter((p) => p.availability.status === 'available_now');
  const kinds = [...new Set(now.map((p) => p.productType.name))].slice(0, 6).join(', ');
  return [
    `- ${f.farmName}, run by ${f.farmerName}, ${f.location.town}${milesText(cat, from, f.location.communityId)}.`,
    `  ${f.intro}`,
    `  ${now.length} of ${listings.length} listings available now${kinds ? `: ${kinds}` : ''}.`,
    `  Profile: ${SITE}/farmers/${f.slug}`,
  ].join('\n');
}

/**
 * The guide's tools. Each returns plain text built from public projections,
 * so whatever Claude repeats to a caller is something the website already shows.
 */
export function guideTools(context: { town: string | null; now: Date }) {
  const findListings = betaZodTool({
    name: 'find_listings',
    description:
      'Search food listings on Musoko. Use for any question about what food is available, prices, the cheapest option, what a farm or town has, or what is coming soon. Returns listings with price, unit price, availability, pickup and a link to contact the farmer.',
    inputSchema: z.object({
      query: z.string().optional().describe('Food words, e.g. "eggs", "tomatoes", "honey". Omit to list everything.'),
      category: z
        .enum(['vegetables', 'fruits', 'herbs', 'eggs', 'meat_poultry', 'dairy', 'grains_legumes', 'other'])
        .optional(),
      town: z.string().optional().describe("The caller's town, to sort by distance. Defaults to the town they chose, if any."),
      farm: z.string().optional().describe('Only listings from this farm name.'),
      availability: z.enum(['available_now', 'coming_soon', 'any']).optional().describe('Default available_now.'),
      sort: z.enum(['nearest', 'cheapest', 'newest']).optional().describe('cheapest compares unit price within the same kind of food.'),
      limit: z.number().int().min(1).max(15).optional(),
    }),
    run: async (input) => {
      const cat = await loadCatalogue();
      const from = findCommunity(cat, input.town ?? context.town);
      const terms = norm(input.query ?? '').split(' ').filter((t) => t.length > 1);
      const want = input.availability ?? 'available_now';
      let list = cat.products.filter((p) => {
        if (input.category && p.productType.category !== input.category) return false;
        if (want !== 'any' && p.availability.status !== want) return false;
        if (input.farm && !norm(p.farm.farmName).includes(norm(input.farm))) return false;
        if (!terms.length) return true;
        const hay = norm(`${p.title} ${p.productType.name} ${p.productType.category} ${p.description}`);
        // Loose singular match: "tomato" finds "tomatoes".
        return terms.every((t) => hay.includes(t) || hay.includes(t.replace(/(es|s)$/, '')));
      });
      const miles = (p: PublicProduct) => {
        const c = centreOf(cat, p.farm.communityId);
        return from && c ? milesBetween(from.centre, c) : 0;
      };
      if (input.sort === 'cheapest') {
        const unit = (p: PublicProduct) => p.normalizedUnitPrice?.cents ?? p.priceCents * 1000;
        list.sort((a, b) => a.productType.name.localeCompare(b.productType.name) || unit(a) - unit(b));
      } else if (input.sort === 'newest') {
        list.sort((a, b) => b.availability.updatedAt.localeCompare(a.availability.updatedAt));
      } else {
        list.sort((a, b) => RANK[a.availability.status] - RANK[b.availability.status] || miles(a) - miles(b));
      }
      const total = list.length;
      list = list.slice(0, input.limit ?? 8);
      if (!total) {
        const towns = [...new Set(cat.products.map((p) => p.farm.town))].join(', ');
        return `No listings match. Farms with listings are in: ${towns}. Try another food, "any" availability, or browse ${SITE}/food`;
      }
      return [
        `${total} listing${total === 1 ? '' : 's'} match${from ? `, sorted from ${from.name}` : ''}${total > list.length ? ` (showing ${list.length})` : ''}:`,
        ...list.map((p) => listingLine(cat, p, from, context.now)),
        `Browse all: ${SITE}/food${input.query ? `?q=${encodeURIComponent(input.query)}` : ''}`,
      ].join('\n');
    },
  });

  const findFarms = betaZodTool({
    name: 'find_farms',
    description:
      'List farms on Musoko, nearest first, with what each has available now. Use for "which farmers are near me", "who sells honey", or to find a farm by name.',
    inputSchema: z.object({
      town: z.string().optional(),
      name: z.string().optional().describe('Part of a farm or farmer name.'),
      sells: z.string().optional().describe('Only farms with a listing matching this food word.'),
    }),
    run: async (input) => {
      const cat = await loadCatalogue();
      const from = findCommunity(cat, input.town ?? context.town);
      let farms = cat.farms;
      if (input.name) {
        const q = norm(input.name);
        farms = farms.filter((f) => norm(`${f.farmName} ${f.farmerName}`).includes(q));
      }
      if (input.sells) {
        const q = norm(input.sells).replace(/(es|s)$/, '');
        const ids = new Set(cat.products.filter((p) => norm(`${p.title} ${p.productType.name}`).includes(q)).map((p) => p.farm.id));
        farms = farms.filter((f) => ids.has(f.id));
      }
      const miles = (f: PublicFarm) => {
        const c = centreOf(cat, f.location.communityId);
        return from && c ? milesBetween(from.centre, c) : 0;
      };
      farms = [...farms].sort((a, b) => miles(a) - miles(b));
      if (!farms.length) return `No farms match. All farms: ${SITE}/farmers`;
      return [`${farms.length} farm${farms.length === 1 ? '' : 's'}:`, ...farms.slice(0, 8).map((f) => farmLine(cat, f, from))].join('\n');
    },
  });

  const farmDetails = betaZodTool({
    name: 'farm_details',
    description:
      'Everything public about one farm: story, every listing, pickup places and days, farmer-managed delivery, markets attended, claims (farmer-reported or verified), and contact details only if the farmer chose to share them.',
    inputSchema: z.object({ name: z.string().describe('Farm or farmer name.') }),
    run: async ({ name }) => {
      const cat = await loadCatalogue();
      const q = norm(name);
      const farm = cat.farms.find((f) => norm(`${f.farmName} ${f.farmerName}`).includes(q)) ??
        cat.farms.find((f) => q.split(' ').some((w) => w.length > 3 && norm(f.farmName).includes(w)));
      if (!farm) return `No listed farm by that name. Farms: ${cat.farms.map((f) => f.farmName).join(', ')}.`;
      const listings = cat.products.filter((p) => p.farm.id === farm.id);
      const markets = cat.markets.filter((m) => farm.marketIds.includes(m.id));
      const pickup = farm.pickupOptions.map((o) =>
        `- ${o.kind === 'own_delivery' ? 'Farmer delivers' : `${o.name}, ${o.town}`}${o.schedule.length ? `: ${scheduleLines(o.schedule).join(', ')}` : ''}${o.note ? `. ${o.note}` : ''}`,
      );
      const claims = farm.claims.map((c) => `- ${c.label}: ${c.status === 'verified' ? `verified ${c.verifiedOn}` : 'farmer-reported'}`);
      const contact = [farm.contact.phone, farm.contact.email].filter(Boolean).join(', ');
      return [
        `${farm.farmName}, run by ${farm.farmerName}, ${farm.location.town}, ${farm.location.county} County.`,
        farm.story,
        `Listings:`,
        ...listings.map((p) => listingLine(cat, p, null, context.now)),
        `Pickup and delivery:`,
        ...(pickup.length ? pickup : ['- None listed']),
        markets.length ? `Sells at: ${markets.map((m) => `${m.name} (${m.town}, ${scheduleLines(m.schedule).join(', ')})`).join('; ')}` : '',
        claims.length ? `Claims:\n${claims.join('\n')}` : '',
        farm.openToWholesale ? 'Open to wholesale or institutional supply (farmer-reported).' : '',
        contact ? `The farmer chose to share: ${contact}` : 'Contact details are private; buyers reach this farmer through the inquiry form.',
        `Profile: ${SITE}/farmers/${farm.slug}`,
      ]
        .filter(Boolean)
        .join('\n');
    },
  });

  const farmersMarkets = betaZodTool({
    name: 'farmers_markets',
    description: 'Farmers markets with their days, hours, place, season and which farmers sell there, nearest first.',
    inputSchema: z.object({ town: z.string().optional() }),
    run: async (input) => {
      const cat = await loadCatalogue();
      const from = findCommunity(cat, input.town ?? context.town);
      const markets = [...cat.markets].sort((a, b) =>
        from ? milesBetween(from.centre, a.point) - milesBetween(from.centre, b.point) : 0,
      );
      return markets
        .map((m) =>
          [
            `- ${m.name}, ${m.town}${from ? ` (about ${Math.round(milesBetween(from.centre, m.point))} mi from ${from.name})` : ''}.`,
            `  ${m.schedule.length ? `${scheduleLines(m.schedule).join(', ')}. ` : ''}${m.venue}. ${m.seasonNote}`,
            m.isDemo ? '  Demo market (fictional).' : `  Real market, from its public listing; check days before going.${m.website ? ` Market page: ${m.website}` : ''}`,
            m.farms.length ? `  Musoko farmers who sell here: ${m.farms.map((f) => f.farmName).join(', ')}.` : '',
            m.contactPhone ? `  Market contact: ${m.contactPhone}` : '',
          ]
            .filter(Boolean)
            .join('\n'),
        )
        .join('\n');
    },
  });

  const directions = betaZodTool({
    name: 'directions',
    description:
      'Straight-line distance and a Google Maps driving link between two places: towns, farmers markets, pickup points or farms. Farms that keep their location private resolve to their town only.',
    inputSchema: z.object({ from: z.string(), to: z.string() }),
    run: async ({ from, to }) => {
      const cat = await loadCatalogue();
      const a = findPlace(cat, from);
      const b = findPlace(cat, to);
      if (!a || !b) {
        return `Could not place "${!a ? from : to}". Known towns: ${cat.communities.map((c) => c.name).join(', ')}.`;
      }
      const miles = Math.round(milesBetween(a.point, b.point));
      const note = b.kind === 'farm' && !b.mapsQuery.includes(',') ? '' : b.kind === 'farm' ? ` The farm keeps its exact location private, so this goes to ${b.town}; arrange the pickup spot with the farmer.` : '';
      return `${a.name} (${a.kind}, ${a.town}) to ${b.name} (${b.kind}, ${b.town}): about ${miles} miles in a straight line; driving is a little longer.${note}\nDirections: ${directionsUrl(a, b)}`;
    },
  });

  const towns = betaZodTool({
    name: 'towns',
    description: 'The Arkansas Delta towns Musoko covers, with county and how many farms and listings each has.',
    inputSchema: z.object({}),
    run: async () => {
      const cat = await loadCatalogue();
      return cat.communities
        .map((c) => {
          const farms = cat.farms.filter((f) => f.location.communityId === c.id).length;
          const now = cat.products.filter((p) => p.farm.communityId === c.id && p.availability.status === 'available_now').length;
          return `- ${c.name}, ${c.county} County: ${farms} farm${farms === 1 ? '' : 's'}, ${now} listings available now`;
        })
        .join('\n');
    },
  });

  const farmDirectory = betaZodTool({
    name: 'farm_directory',
    description:
      'Real Delta farms listed from their own public pages (not demo data): what each offers, how to buy (farm stand, pick-your-own, CSA, markets, online, delivery), season and website. They have no prices or listings on Musoko. Use alongside find_farms whenever someone asks about farms, a food, or a town.',
    inputSchema: z.object({
      town: z.string().optional(),
      food: z.string().optional().describe('A food word, e.g. "eggs", "beef", "strawberries".'),
      name: z.string().optional(),
    }),
    run: async (input) => {
      const cat = await loadCatalogue();
      const from = findCommunity(cat, input.town ?? context.town);
      let farms = cat.directory;
      if (input.name) farms = farms.filter((f) => norm(f.farmName).includes(norm(input.name!)));
      if (input.food) {
        const q = norm(input.food).replace(/(es|s)$/, '');
        farms = farms.filter((f) => norm(`${f.offers.join(' ')} ${f.summary}`).includes(q));
      }
      const miles = (communityId: string) => {
        const c = centreOf(cat, communityId);
        return from && c ? milesBetween(from.centre, c) : 0;
      };
      farms = [...farms].sort((a, b) => miles(a.communityId) - miles(b.communityId));
      if (!farms.length) return 'No farm in the public directory matches.';
      return farms
        .slice(0, 6)
        .map((f) =>
          [
            `- ${f.farmName}, ${f.town}, ${f.county} County${milesText(cat, from, f.communityId)}. Real farm, public listing.`,
            `  ${f.summary}`,
            `  Offers: ${f.offers.join(', ')}.${f.season ? ` Season: ${f.season}` : ''}`,
            `  How to buy: ${f.howToBuy.map((h) => h.detail).join(' ')}`,
            f.deliveryTowns.length ? `  Delivers to: ${f.deliveryTowns.join(', ')}.` : '',
            f.website ? `  Website: ${f.website}` : '',
            `  On Musoko: ${SITE}/farmers/public/${f.slug}`,
          ]
            .filter(Boolean)
            .join('\n'),
        )
        .join('\n');
    },
  });

  /** The cheapest available listing per food type, near the town, with its cost for one selling unit. */
  function cheapestByType(cat: Catalogue, from: Community | null, maxMiles: number) {
    const best = new Map<string, PublicProduct>();
    for (const p of cat.products) {
      if (p.availability.status !== 'available_now') continue;
      const c = centreOf(cat, p.farm.communityId);
      if (from && c && milesBetween(from.centre, c) > maxMiles) continue;
      const cur = best.get(p.productType.id);
      if (!cur || p.priceCents < cur.priceCents) best.set(p.productType.id, p);
    }
    return best;
  }

  const planBasket = betaZodTool({
    name: 'plan_basket',
    description:
      'Builds an affordable, varied basket of local food available now within a budget: vegetables, fruit, a protein (eggs, meat, beans or peas) and a staple, choosing low prices and as few farms as practical. Returns items, farms, pickup and the total at listed prices. Use for "what can I get for $25", "a cheap healthy week", "feed a family of four".',
    inputSchema: z.object({
      budgetDollars: z.number().positive().max(1000),
      town: z.string().optional(),
      people: z.number().int().positive().max(20).optional(),
      avoid: z.array(z.string()).optional().describe('Foods or categories to leave out.'),
      maxMiles: z.number().positive().max(200).optional(),
    }),
    run: async (input) => {
      const cat = await loadCatalogue();
      const from = findCommunity(cat, input.town ?? context.town);
      const avoid = (input.avoid ?? []).map(norm);
      const best = cheapestByType(cat, from, input.maxMiles ?? 40);
      const pool = [...best.values()].filter((p) => !avoid.some((a) => norm(`${p.title} ${p.productType.name} ${p.productType.category}`).includes(a)));
      // One from each group first, cheapest first; then more vegetables and fruit while the budget lasts.
      const groups: Record<string, string[]> = {
        vegetables: ['vegetables', 'herbs'], fruit: ['fruits'], protein: ['eggs', 'meat_poultry', 'grains_legumes'], staple: ['grains_legumes', 'dairy'],
      };
      const budget = Math.round(input.budgetDollars * 100);
      const chosen: PublicProduct[] = [];
      let spent = 0;
      const take = (p: PublicProduct) => {
        if (chosen.includes(p) || spent + p.priceCents > budget) return false;
        chosen.push(p);
        spent += p.priceCents;
        return true;
      };
      for (const cats of Object.values(groups)) {
        const options = pool.filter((p) => cats.includes(p.productType.category)).sort((a, b) => a.priceCents - b.priceCents);
        for (const p of options) if (take(p)) break;
      }
      const extras = pool.filter((p) => ['vegetables', 'fruits'].includes(p.productType.category)).sort((a, b) => a.priceCents - b.priceCents);
      for (const p of extras) take(p);
      if (!chosen.length) return `Nothing available now fits $${input.budgetDollars}${from ? ` near ${from.name}` : ''}. Try a bigger budget or a wider distance.`;
      const byFarm = new Map<string, PublicProduct[]>();
      for (const p of chosen) byFarm.set(p.farm.farmName, [...(byFarm.get(p.farm.farmName) ?? []), p]);
      return [
        `Basket at listed prices: $${(spent / 100).toFixed(2)} of $${input.budgetDollars}${input.people ? ` for ${input.people}` : ''}, from ${byFarm.size} farm${byFarm.size === 1 ? '' : 's'}${from ? ` near ${from.name}` : ''}.`,
        ...[...byFarm.entries()].map(([farm, items]) =>
          [`${farm}:`, ...items.map((p) => `- ${p.title}: ${formatListingPrice(p.priceCents, p.sellingUnit, p.unitSize)}`), `  ${pickupSummary(items[0].pickupOptions) ?? 'Pickup arranged with the farmer'}.`].join('\n'),
        ),
        'Pickup is free at the farm, market or pickup spot. Delivery, where a farmer offers it, is arranged and priced by the farmer and is not included. Prices are demo listings.',
        `Food: ${SITE}/food`,
      ].join('\n');
    },
  });

  const compareCosts = betaZodTool({
    name: 'compare_costs',
    description:
      'Compares the total cost of a shopping list across farms: the cheapest way to buy each item, the total, how many farms (stops) that takes, and the cheapest single farm that has most of the list. Use for "where is it cheapest to buy eggs, greens and honey", or comparing farms on total cost including pickup trips.',
    inputSchema: z.object({
      items: z.array(z.object({ food: z.string(), quantity: z.number().positive().max(100).optional() })).min(1).max(10),
      town: z.string().optional(),
      maxMiles: z.number().positive().max(200).optional(),
    }),
    run: async (input) => {
      const cat = await loadCatalogue();
      const from = findCommunity(cat, input.town ?? context.town);
      const near = (p: PublicProduct) => {
        const c = centreOf(cat, p.farm.communityId);
        return !from || !c || milesBetween(from.centre, c) <= (input.maxMiles ?? 60);
      };
      const lines: string[] = [];
      const perFarm = new Map<string, { cents: number; found: number }>();
      let total = 0;
      const stops = new Set<string>();
      for (const item of input.items) {
        const q = norm(item.food).replace(/(es|s)$/, '');
        const qty = item.quantity ?? 1;
        const matches = cat.products.filter((p) => p.availability.status === 'available_now' && near(p) && norm(`${p.title} ${p.productType.name}`).includes(q));
        if (!matches.length) {
          lines.push(`- ${item.food}: not available now nearby.`);
          continue;
        }
        const cheapest = [...matches].sort((a, b) => a.priceCents - b.priceCents)[0];
        total += cheapest.priceCents * qty;
        stops.add(cheapest.farm.farmName);
        lines.push(`- ${item.food} x${qty}: cheapest ${cheapest.title} at ${cheapest.farm.farmName}, ${cheapest.farm.town}, ${formatListingPrice(cheapest.priceCents, cheapest.sellingUnit, cheapest.unitSize)} each.`);
        const seen = new Set<string>();
        for (const p of [...matches].sort((a, b) => a.priceCents - b.priceCents)) {
          if (seen.has(p.farm.farmName)) continue;
          seen.add(p.farm.farmName);
          const f = perFarm.get(p.farm.farmName) ?? { cents: 0, found: 0 };
          f.cents += p.priceCents * qty;
          f.found += 1;
          perFarm.set(p.farm.farmName, f);
        }
      }
      const one = [...perFarm.entries()].sort((a, b) => b[1].found - a[1].found || a[1].cents - b[1].cents)[0];
      return [
        ...lines,
        `Cheapest split: $${(total / 100).toFixed(2)} from ${stops.size} farm${stops.size === 1 ? '' : 's'} (${[...stops].join(', ')}).`,
        one ? `Fewest stops: ${one[0]} has ${one[1].found} of ${input.items.length} items for $${(one[1].cents / 100).toFixed(2)}.` : '',
        'Each extra farm is another pickup trip or delivery to arrange; delivery charges are set by farmers and not listed. Prices are demo listings.',
      ]
        .filter(Boolean)
        .join('\n');
    },
  });

  const institutionalBuying = betaZodTool({
    name: 'institutional_buying',
    description:
      'For schools, hospitals, restaurants, colleges and pantries buying larger amounts: farms open to wholesale, how much of a food farms say they have now, and buyers\' shared planned needs. Use for bulk or institutional questions, and when a farmer asks what buyers need.',
    inputSchema: z.object({ food: z.string().optional(), town: z.string().optional() }),
    run: async (input) => {
      const cat = await loadCatalogue();
      const from = findCommunity(cat, input.town ?? context.town);
      const q = input.food ? norm(input.food).replace(/(es|s)$/, '') : '';
      const wholesale = cat.farms.filter((f) => f.openToWholesale).map((f) => `${f.farmName} (${f.location.town})`);
      const stock = cat.products
        .filter((p) => p.availability.status === 'available_now' && (!q || norm(`${p.title} ${p.productType.name}`).includes(q)))
        .slice(0, 8)
        .map((p) => `- ${p.title}, ${p.farm.farmName} (${p.farm.town})${milesText(cat, from, p.farm.communityId)}: ${quantityLine(p) ?? 'amount not stated'}.`);
      const needs = cat.institutions
        .flatMap((i) => i.needs)
        .filter((n) => !q || norm(n.productType.name).includes(q))
        .slice(0, 8)
        .map((n) => `- ${n.buyerLabel} (${n.town}) plans ${n.amount} ${n.productType.comparisonUnit} of ${n.productType.name.toLowerCase()} ${n.cadence === 'weekly' ? 'a week' : n.cadence === 'monthly' ? 'a month' : 'once'}, ${n.startMonth} to ${n.endMonth}.${n.isDemo ? ' (demo)' : ''}`);
      return [
        `Farms open to wholesale or institutional supply (farmer-reported): ${wholesale.join(', ') || 'none listed'}.`,
        stock.length ? `Available now${q ? ` (${input.food})` : ''}:\n${stock.join('\n')}` : '',
        needs.length ? `Planned needs shared by buyers:\n${needs.join('\n')}` : '',
        `Musoko splits one larger order across several farms; each farm replies directly and there is no checkout. Source an order: ${SITE}/institutions/order`,
      ]
        .filter(Boolean)
        .join('\n');
    },
  });

  return [findListings, findFarms, farmDetails, farmersMarkets, directions, towns, farmDirectory, planBasket, compareCosts, institutionalBuying];
}
