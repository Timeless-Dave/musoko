import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import knowledge from '@/content/assistant-knowledge.json';

/**
 * Ask Musoko: answers how-to questions about the site with Claude, grounded
 * only on the public brief excerpts in knowledge.json. It never sees demo
 * data, farmer contacts or locations. The key stays on the server.
 *
 * With no key set the route answers 503 and the widget falls back to its
 * local lookup, so the app still runs with no credentials.
 */

const MODEL = 'claude-opus-5-5';
const MAX_QUESTION = 500;
const MAX_TURNS = 10;
const LIMIT_PER_MINUTE = 8;

const SYSTEM = `You are Ask Musoko, the help guide inside Musoko, a local food marketplace for the Arkansas Delta run by ReMix Ideas.

Answer questions about how to use the site, in plain, friendly language, in two to five short sentences. Point people to the right page by its name: Find food, Farmers, Markets, Map, Compare, Join as a farmer, the farmer dashboard, or the demo strip at the bottom of the page.

Facts you must keep straight:
- Musoko helps buyers find farmers and contact them directly. There is no cart, checkout, payment or delivery service. Payment and pickup are arranged directly with the farmer; Musoko is not a party to the sale.
- Everything on the site right now is fictional demonstration data.
- Farmers reply when they can. Never promise a reply or a reply time.
- "Listed" only means Musoko reviewed a profile for publication. There is no "Verified farmer" badge. A single claim can be marked verified with a date; everything else is farmer-reported.
- Never say a farmer accepts SNAP/EBT, that food has a health benefit, or that prices are guaranteed affordable. SNAP/EBT is farmer-reported; tell people to confirm with the farmer.
- Farm street addresses, exact locations, phone numbers and emails are private unless the farmer chose to share them. Never guess or invent any.
- Do not invent farms, products, prices or markets. You cannot see listings; send people to Find food or Farmers.

If a question is not about Musoko or local food, say briefly that you can only help with Musoko. Use the brief excerpts below for detail. Plain text only, no markdown.

<brief_excerpts>
${(knowledge as { text: string }[]).map((chunk) => chunk.text.replace(/\s+/g, ' ').trim()).join('\n\n')}
</brief_excerpts>`;

const body = z.object({
  messages: z
    .array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().min(1).max(4000) }))
    .min(1)
    .max(MAX_TURNS * 2),
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
  const apiKey = process.env.ANT_API_KEY || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return Response.json({ error: 'not_configured' }, { status: 503 });

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
  if (limited(ip)) return Response.json({ error: 'rate_limited' }, { status: 429 });

  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'invalid' }, { status: 400 });
  const messages = parsed.data.messages.slice(-MAX_TURNS * 2);
  const last = messages.at(-1);
  if (!last || last.role !== 'user' || last.content.length > MAX_QUESTION) {
    return Response.json({ error: 'invalid' }, { status: 400 });
  }

  const client = new Anthropic({ apiKey });
  const stream = client.beta.messages.stream({
    model: MODEL,
    max_tokens: 2000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'low' },
    system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
    messages,
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
        const final = await stream.finalMessage();
        if (final.stop_reason === 'refusal') {
          controller.enqueue(encoder.encode('I can only help with questions about using Musoko.'));
        }
      } catch (error) {
        const status = error instanceof Anthropic.APIError ? error.status : 'network';
        console.error(`[assistant] Claude request failed: ${status}`);
        controller.enqueue(encoder.encode('\u0000'));
      } finally {
        controller.close();
      }
    },
    cancel() {
      stream.abort();
    },
  });

  return new Response(readable, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
