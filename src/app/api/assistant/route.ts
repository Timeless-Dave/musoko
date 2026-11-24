import { z } from 'zod';
import { apiKey, askGuide, normaliseTurns } from '@/server/guide/ask';

/**
 * Ask Musoko on the website. Claude answers with tools over the public
 * catalogue (see src/server/guide). The key stays on the server; with none set
 * the route answers 503 and the widget falls back to its local guide.
 */

export const maxDuration = 60;

const MAX_QUESTION = 500;
const LIMIT_PER_MINUTE = 10;

const body = z.object({
  town: z.string().max(60).nullish(),
  messages: z
    .array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().min(1).max(4000) }))
    .min(1)
    .max(30),
});

/** A per-instance limit. Enough to stop a stuck loop or a casual abuser; not a real quota. */
const hits = new Map<string, number[]>();
function limited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > LIMIT_PER_MINUTE;
}

export async function POST(request: Request) {
  if (!apiKey()) return Response.json({ error: 'not_configured' }, { status: 503 });

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
  if (limited(ip)) return Response.json({ error: 'rate_limited' }, { status: 429 });

  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'invalid' }, { status: 400 });
  const messages = normaliseTurns(parsed.data.messages, 16);
  const last = messages.at(-1);
  if (!last || last.role !== 'user' || last.content.length > MAX_QUESTION) {
    return Response.json({ error: 'invalid' }, { status: 400 });
  }

  try {
    const answer = await askGuide({ channel: 'web', messages, town: parsed.data.town ?? null });
    return new Response(answer, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error(`[assistant] guide failed: ${String(error).slice(0, 200)}`);
    return Response.json({ error: 'failed' }, { status: 502 });
  }
}
