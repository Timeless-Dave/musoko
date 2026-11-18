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
            `  ${scheduleLines(m.schedule).join(', ')}. ${m.venue}. ${m.seasonNote}`,
            `  Farmers: ${m.farms.map((f) => f.farmName).join(', ') || 'none listed yet'}.`,
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

  return [findListings, findFarms, farmDetails, farmersMarkets, directions, towns];
}
