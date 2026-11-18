import 'server-only';
import { scheduleLines } from '@/features/catalogue/format';
import { formatListingPrice } from '@/lib/format';
import { loadCatalogue } from './catalogue';

/**
 * A short call-wide briefing for the phone voice, under 2,000 characters:
 * what Musoko is, the markets and their days, and what is available now with
 * prices. Built from public data only, without a model call, so it is instant.
 */
export async function callBriefing(): Promise<string> {
  const cat = await loadCatalogue();
  const now = cat.products.filter((p) => p.availability.status === 'available_now');
  const towns = [...new Set(cat.farms.map((f) => f.location.town))].join(', ');
  const markets = cat.markets.map((m) => `${m.name} in ${m.town}, ${scheduleLines(m.schedule).join(', ')}`).join('; ');
  const byType = new Map<string, (typeof now)[number]>();
  for (const p of now) {
    const best = byType.get(p.productType.name);
    const unit = (x: typeof p) => x.normalizedUnitPrice?.cents ?? x.priceCents;
    if (!best || unit(p) < unit(best)) byType.set(p.productType.name, p);
  }
  const offers = [...byType.values()]
    .slice(0, 14)
    .map((p) => `${p.productType.name}: ${formatListingPrice(p.priceCents, p.sellingUnit, p.unitSize)} from ${p.farm.farmName}, ${p.farm.town}`)
    .join('; ');
  return [
    'Musoko briefing (sample demo data). No payments or delivery service on Musoko; buyers arrange payment and pickup with the farmer.',
    `${cat.farms.length} farms in: ${towns}. ${now.length} listings available now.`,
    `Farmers markets: ${markets}.`,
    `Lowest price now for each food: ${offers}.`,
    'For anything more specific, such as a town, a farm, the cheapest of something or directions, wait for Musoko to look it up.',
  ].join('\n');
}
