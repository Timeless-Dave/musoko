import { z } from 'zod';
import { apiKey } from '@/server/guide/ask';
import { suggestPlan } from '@/server/guide/planner';

/**
 * Planning advice for a farmer. The dashboard sends only figures it already
 * shows (foods, counts, months, prices); no buyer name or contact. With no key
 * the route answers 503 and the dashboard keeps its rule-based advice.
 */
export const maxDuration = 60;

const n = z.number().finite().nullable();
const body = z.object({
  town: z.string().max(60),
  radiusMiles: z.number().int().min(1).max(500),
  windowDays: z.number().int().min(1).max(365),
  foods: z
    .array(
      z.object({
        food: z.string().max(60),
        unit: z.string().max(12),
        youList: z.boolean(),
        searches: n,
        searchesFoundNothing: n,
        plannedByMonth: z.array(z.object({ month: z.string().max(12), amount: z.number().finite() })).max(12),
        plannedBuyerKinds: z.array(z.string().max(20)).max(20),
        price: z.object({ yourCents: n, lowCents: z.number(), medianCents: z.number(), highCents: z.number() }).nullable(),
      }),
    )
    .max(8),
});

const hits = new Map<string, number[]>();
function limited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > 4;
}

export async function POST(request: Request) {
  if (!apiKey()) return Response.json({ error: 'not_configured' }, { status: 503 });
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
  if (limited(ip)) return Response.json({ error: 'rate_limited' }, { status: 429 });
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success || parsed.data.foods.length === 0) return Response.json({ error: 'invalid' }, { status: 400 });
  try {
    const text = await suggestPlan(parsed.data);
    return new Response(text, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error(`[planner] failed: ${String(error).slice(0, 200)}`);
    return Response.json({ error: 'failed' }, { status: 502 });
  }
}
