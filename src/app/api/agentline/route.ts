import { after } from 'next/server';
import { agentline, agentlineConfig, type SmsMessage } from '@/server/agentline';
import { askGuide, normaliseTurns, type Turn } from '@/server/guide/ask';

/**
 * AgentLine webhook for the Musoko phone line. Calls and texts both reach
 * Ask Musoko, the same guide as the website.
 *
 * - sms.received: answer the text, with the last few texts as context.
 * - call.utterance: answer the caller's turn with short facts that AgentLine's
 *   voice says aloud. Calls wind down from 4 minutes and end at 5.
 *
 * AgentLine sends the Authorization header we registered with the webhook,
 * so anything without it is refused. Phone numbers are never logged.
 */

export const maxDuration = 60;

const WRAP_UP_MS = 4 * 60_000;
const HARD_STOP_MS = 5 * 60_000;
const seen = new Set<string>();

type Envelope = {
  event_type?: string;
  event_id?: string;
  call_id?: string;
  turn_id?: string;
  push_token?: string;
  push_context_url?: string;
  conversation?: unknown;
  payload?: Record<string, unknown>;
  [key: string]: unknown;
};

const str = (v: unknown) => (typeof v === 'string' ? v : undefined);

export async function POST(request: Request) {
  const config = agentlineConfig();
  if (!config) return Response.json({ error: 'not_configured' }, { status: 503 });
  if (request.headers.get('authorization') !== `Bearer ${config.hookToken}`) {
    return Response.json({ error: 'unauthorised' }, { status: 401 });
  }

  const event = (await request.json().catch(() => null)) as Envelope | null;
  if (!event) return Response.json({ error: 'invalid' }, { status: 400 });
  const type = event.event_type ?? request.headers.get('x-agentline-event') ?? '';
  const id = event.event_id ?? '';
  if (id) {
    if (seen.has(id)) return Response.json({ ok: true, duplicate: true });
    seen.add(id);
    if (seen.size > 2000) seen.clear();
  }

  if (type === 'sms.received') after(() => answerText(config, event));
  else if (type === 'call.utterance') after(() => answerTurn(config, event));
  else console.info(`[agentline] ${type || 'unknown'} event`);

  return Response.json({ ok: true });
}

async function answerText(config: NonNullable<ReturnType<typeof agentlineConfig>>, event: Envelope) {
  const p = event.payload ?? {};
  const from = str(p.from_number) ?? str(p.from) ?? str(event.from_number);
  const body = str(p.body) ?? str(p.text) ?? str(event.body) ?? '';
  if (!from) return console.error('[agentline] text without a sender');

  // The last few texts with this number, oldest first, as the conversation.
  let history: Turn[] = [];
  try {
    const all = await agentline.listSms(config.key, 50);
    history = all
      .filter((m: SmsMessage) => m.from_number === from || m.to_number === from)
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .slice(-10)
      .map((m) => ({ role: m.direction === 'inbound' ? ('user' as const) : ('assistant' as const), content: m.body }));
  } catch (error) {
    console.error(`[agentline] history unavailable: ${String(error)}`);
  }
  if (!history.length || history[history.length - 1].content !== body) history.push({ role: 'user', content: body });

  let reply: string;
  try {
    reply = await askGuide({ channel: 'sms', messages: normaliseTurns(history, 10) });
  } catch (error) {
    console.error(`[agentline] guide failed for a text: ${String(error)}`);
    reply = 'Sorry, Musoko could not answer just now. Try again in a minute, or browse https://getmusoko.vercel.app';
  }
  try {
    await agentline.sendSms(config.key, config.agentId, from, reply || 'Ask me what fresh food is near you, who grows it, or how Musoko works.');
  } catch (error) {
    console.error(`[agentline] reply not sent: ${String(error)}`);
  }
}

/** Reads the call's start from whichever field the API returns. */
function startedAt(details: Record<string, unknown>): number | null {
  for (const key of ['answered_at', 'started_at', 'start_time', 'created_at']) {
    const value = str(details[key]);
    if (value && !Number.isNaN(Date.parse(value))) return Date.parse(value);
  }
  return null;
}

/** The conversation so far, from whatever shape AgentLine sends it in. */
function turnsFrom(event: Envelope): Turn[] {
  const p = event.payload ?? {};
  const raw = (event.conversation ?? p.conversation ?? p.transcript) as unknown;
  const turns: Turn[] = [];
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (!item || typeof item !== 'object') continue;
      const r = item as Record<string, unknown>;
      const text = str(r.text) ?? str(r.content) ?? str(r.message) ?? '';
      const role = str(r.role) ?? str(r.speaker) ?? '';
      if (!text) continue;
      turns.push({ role: /user|caller|human|customer/i.test(role) ? 'user' : 'assistant', content: text });
    }
  }
  const latest = str(p.text) ?? str(p.utterance) ?? str(p.transcript_text) ?? str(event.text);
  if (latest && turns[turns.length - 1]?.content !== latest) turns.push({ role: 'user', content: latest });
  return turns;
}

async function answerTurn(config: NonNullable<ReturnType<typeof agentlineConfig>>, event: Envelope) {
  const p = event.payload ?? {};
  const callId = event.call_id ?? str(p.call_id);
  const turnId = event.turn_id ?? str(p.turn_id);
  const pushToken = event.push_token ?? str(p.push_token);
  const pushUrl = event.push_context_url ?? str(p.push_context_url) ?? (callId ? `/v1/calls/${callId}/context?turn_id=${turnId}` : null);
  if (!callId || !turnId || !pushUrl) return console.error('[agentline] utterance without call or turn ids');

  const push = (context: string, disposition = 'done') =>
    agentline.pushContext(config.key, pushUrl, { turn_id: turnId, disposition, context }, pushToken).catch((error) =>
      console.error(`[agentline] push failed: ${String(error)}`),
    );

  // Keep calls short: wind down from four minutes, end at five.
  let elapsed = 0;
  try {
    const start = startedAt(await agentline.getCall(config.key, callId));
    if (start) elapsed = Date.now() - start;
  } catch {
    /* timing is best-effort; the call carries on */
  }
  if (elapsed >= HARD_STOP_MS) {
    await push(
      'The five-minute call limit is reached. Thank the caller warmly, say goodbye, and invite them to text this number or visit get musoko dot vercel dot app for more.',
    );
    await new Promise((r) => setTimeout(r, 9_000));
    await agentline.hangup(config.key, callId).catch(() => {});
    return;
  }

  const turns = normaliseTurns(turnsFrom(event), 16);
  if (!turns.length) return void push('Ask the caller what food or farm they are looking for, and which town they are in.');

  const wrapUp =
    elapsed >= WRAP_UP_MS
      ? 'The call is near its five-minute limit. Answer this last question briefly, then tell the caller the call will end soon and they can text this number to keep going.'
      : undefined;

  try {
    const answer = await askGuide({ channel: 'voice', messages: turns, extraSystem: wrapUp });
    await push(answer || 'Musoko could not find that. Suggest asking about a food, a farm or a town.');
  } catch (error) {
    console.error(`[agentline] guide failed for a call turn: ${String(error)}`);
    await push('The lookup failed. Apologise and suggest trying again, or texting this number.', 'failed');
  }
}
