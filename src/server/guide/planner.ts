import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { apiKey } from './ask';

/**
 * A farmer's season plan in plain words, from figures the dashboard already
 * shows. Claude only reasons over those numbers: it has no tools, no buyer
 * names and no contact details.
 */

const SYSTEM = `You help small farmers in the Arkansas Delta plan their season on Musoko, a local food marketplace.
You get figures from the farmer's dashboard as JSON: for each food, recent searches near them (null means too few to show), how many found nothing, what schools, hospitals and other buyers near them plan to buy each month (plans, not orders), and the range of prices other farms list on Musoko (in cents per unit).

Write practical advice a busy farmer can act on, in plain words:
- Start with one sentence on the biggest opportunity.
- Then three to five list items, each on its own line starting with "- ": what to plant or harvest more of and when, how much (from the figures), who to tell, and any price change worth trying.
- Use only the figures given. Never invent a buyer, an amount, a price or a date. If a figure is missing, say what to watch instead.
- Planned buys are not orders and nothing is guaranteed: say "planned" or "expected", never "will buy".
- Prices: compare per unit, round to cents, and never tell a farmer to undercut others below what is fair for them.
- Plain text only: no markdown, no bold, no headings. Under 180 words.`;

export async function suggestPlan(figures: unknown): Promise<string> {
  const key = apiKey();
  if (!key) throw new Error('not_configured');
  const client = new Anthropic({ apiKey: key, timeout: 60_000, maxRetries: 1 });
  const message = await client.beta.messages.create({
    model: 'claude-opus-5-5',
    max_tokens: 2000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'low' },
    system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: `My dashboard figures:\n${JSON.stringify(figures)}` }],
  });
  if (message.stop_reason === 'refusal') return 'No suggestion for these figures.';
  return message.content
    .flatMap((b) => (b.type === 'text' ? [b.text] : []))
    .join('\n')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/^#+\s*/gm, '')
    .trim();
}
