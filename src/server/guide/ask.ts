import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import knowledge from '@/content/assistant-knowledge.json';
import { guideTools } from './tools';

/**
 * Ask Musoko: one brain for the website, text messages and phone calls.
 * Claude answers with tools over the public catalogue, so its facts are the
 * same ones the site shows. Everything here runs on the server.
 */

export type Channel = 'web' | 'sms' | 'voice';
export type Turn = { role: 'user' | 'assistant'; content: string };

const MODEL = 'claude-opus-5-5';
const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://getmusoko.vercel.app';

export function apiKey(): string | null {
  return process.env.ANT_API_KEY || process.env.ANTHROPIC_API_KEY || null;
}

const BRIEF = (knowledge as { text: string }[]).map((c) => c.text.replace(/\s+/g, ' ').trim()).join('\n\n');

// Frozen, so it is cached across every request on every channel.
const CORE = `You are Ask Musoko, the guide for Musoko, a local food marketplace for the Arkansas Delta run by ReMix Ideas. Website: ${SITE}

People ask what fresh food is near them, what it costs, who grows it, where and when to get it, how to get somewhere, and how Musoko works. Anyone can ask; no account is needed.

How to answer:
- For anything about food, prices, farms, markets, pickup, towns or distances, call the tools first and answer only from what they return. Never invent a farm, product, price, market, day or distance.
- If where someone is matters and you do not know their town, ask which town they are in, or answer for the whole Delta and say so.
- For "cheapest", compare unit prices within the same kind of food, and say when a listing has no comparable size.
- Lead with the answer. Name the farm, the town, the price and where and when to pick it up.
- Refer to farmers by name or as "the farmer"; never guess he or she.
- Directions: give the distance and the directions link from the tool. You cannot give turn-by-turn directions.

Facts you must keep straight:
- Musoko connects buyers with farmers. There is no cart, checkout, payment or delivery service. Payment and pickup are arranged directly with the farmer; Musoko is not a party to the sale. Some farmers deliver themselves.
- All farms, prices and availability right now are fictional demonstration data. Say so once when you first give listings.
- To reach a farmer, people use "Contact farmer" on the website. Farmers reply when they can; never promise a reply or a time.
- "Listed" means Musoko reviewed the profile. There is no "verified farmer". A single claim may be verified with a date; everything else is farmer-reported.
- Never say a farmer accepts SNAP/EBT unless the tool shows that claim, and then say it is farmer-reported and to confirm with the farmer. Never claim a health benefit or guaranteed low prices.
- Quantities are the farmer's estimate, not reserved stock.
- Farm addresses, exact locations, phones and emails are private unless a tool shows the farmer chose to share them. Never guess one.
- If asked about something unrelated to Musoko or local food, say briefly that you only help with Musoko.

<musoko_brief>
${BRIEF}
</musoko_brief>`;

const STYLE: Record<Channel, string> = {
  web: `This conversation is in the chat box on the Musoko website, which already shows suggested questions as buttons.
- For a greeting, thanks or small talk, reply in one short friendly sentence and ask what they are looking for. Do not list example questions or describe what you can do.
- Otherwise start with a one-sentence answer, then at most six list items, each on its own line starting with "- ", one listing or place per item: food, farm and town, price, pickup day and place.
- Plain text only: no markdown, no bold, no headings, no tables.
- Put links last, each full URL on its own line, at most two. The chat shows them as buttons, so never write "here" or "this link".
- Mention that the data is a demo only the first time you give listings in this conversation.`,
  sms: `This conversation is by text message to the Musoko phone line. Reply in plain text under 480 characters: no markdown, no lists longer than three lines. Include at most one full link. If they would want more, invite them to text a follow-up or open the website.`,
  voice: `This conversation is a live phone call. Your words go to a voice that says them to the caller. Answer in one to three short spoken sentences with at most three items. No links, no lists, no symbols: say "five dollars fifty a dozen", not "$5.50/dozen", and say the website as "get musoko dot vercel dot app". Ask one short question if you need their town.`,
};

export async function askGuide({
  channel,
  messages,
  town,
  extraSystem,
}: {
  channel: Channel;
  messages: Turn[];
  town?: string | null;
  /** Turn-specific notes, e.g. that the call is about to end. */
  extraSystem?: string;
}): Promise<string> {
  const key = apiKey();
  if (!key) throw new Error('not_configured');
  const client = new Anthropic({ apiKey: key, timeout: channel === 'voice' ? 25_000 : 60_000, maxRetries: 1 });
  const now = new Date();
  const dated = `Today is ${now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'America/Chicago' })}.${town ? ` The person said or chose their town: ${town}.` : ''}${extraSystem ? `\n${extraSystem}` : ''}`;

  const final = await client.beta.messages.toolRunner({
    model: MODEL,
    max_tokens: channel === 'web' ? 4000 : 1500,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'low' },
    max_iterations: 6,
    system: [
      { type: 'text', text: CORE, cache_control: { type: 'ephemeral' } },
      { type: 'text', text: `${STYLE[channel]}\n${dated}` },
    ],
    tools: guideTools({ town: town ?? null, now }),
    messages,
  });

  if (final.stop_reason === 'refusal') return 'I can only help with questions about Musoko and local food.';
  const text = final.content
    .flatMap((block) => (block.type === 'text' ? [block.text] : []))
    .join('\n')
    .trim();
  return tidy(text, channel);
}

/** Strip markdown the model might still use; texts and voices read it literally. */
function tidy(text: string, channel: Channel): string {
  let out = text.replace(/\*\*(.+?)\*\*/g, '$1').replace(/^#+\s*/gm, '').replace(/`/g, '');
  if (channel !== 'web') out = out.replace(/^\s*[-*]\s+/gm, '');
  if (channel === 'sms' && out.length > 900) out = `${out.slice(0, 880).replace(/\s+\S*$/, '')}… More at ${SITE}`;
  return out.trim();
}

/** Messages must start with the person and alternate; merge repeats and drop empties. */
export function normaliseTurns(turns: Turn[], max = 16): Turn[] {
  const out: Turn[] = [];
  for (const t of turns) {
    const content = t.content.trim();
    if (!content) continue;
    const last = out[out.length - 1];
    if (last && last.role === t.role) last.content += `\n${content}`;
    else out.push({ role: t.role, content });
  }
  while (out.length && out[0].role !== 'user') out.shift();
  const trimmed = out.slice(-max);
  while (trimmed.length && trimmed[0].role !== 'user') trimmed.shift();
  return trimmed;
}
