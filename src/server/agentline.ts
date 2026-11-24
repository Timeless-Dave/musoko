import 'server-only';

/** A thin client for the AgentLine telephony API. The key never leaves the server. */
const BASE = 'https://api.agentline.cloud';

export function agentlineConfig() {
  const key = process.env.AGENTLINE_API_KEY;
  const agentId = process.env.AGENTLINE_AGENT_ID;
  const hookToken = process.env.AGENTLINE_WEBHOOK_TOKEN;
  return key && agentId && hookToken ? { key, agentId, hookToken } : null;
}

async function call<T>(key: string, path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...init.headers },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`agentline ${init.method ?? 'GET'} ${path.split('?')[0]} ${res.status}`);
  return (await res.json().catch(() => ({}))) as T;
}

export interface SmsMessage {
  id: string;
  direction: 'inbound' | 'outbound';
  from_number: string;
  to_number: string;
  body: string;
  created_at: string;
}

export const agentline = {
  sendSms: (key: string, agentId: string, to: string, body: string) =>
    call(key, '/v1/messages', { method: 'POST', body: JSON.stringify({ agent_id: agentId, to_number: to, body }) }),
  listSms: async (key: string, limit = 50) => {
    const data = await call<SmsMessage[] | { messages?: SmsMessage[]; data?: SmsMessage[] }>(key, `/v1/messages?limit=${limit}`);
    return Array.isArray(data) ? data : (data.messages ?? data.data ?? []);
  },
  getCall: (key: string, callId: string) => call<Record<string, unknown>>(key, `/v1/calls/${callId}`),
  pushContext: (key: string, url: string, body: Record<string, unknown>, pushToken?: string) =>
    call(key, url.startsWith('http') ? url.replace(BASE, '') : url, {
      method: 'POST',
      body: JSON.stringify(body),
      headers: pushToken ? { 'X-Push-Token': pushToken } : {},
    }),
  hangup: (key: string, callId: string) => call(key, `/v1/calls/${callId}/hangup`, { method: 'POST', body: '{}' }),
};
