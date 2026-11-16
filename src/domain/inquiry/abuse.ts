import type { IsoDateTime, Settings } from '../types';

export type AbuseReason = 'honeypot' | 'too_fast' | 'rate_limited' | 'spam_content';

export type AbuseVerdict = { ok: true } | { ok: false; reason: AbuseReason; retryAt?: IsoDateTime };

const HOUR_MS = 3_600_000;
const URL_LIKE = /(?:https?:\/\/|www\.)\S+/gi;
const MAX_LINKS_IN_MESSAGE = 1;

/** How many web addresses a piece of text contains. */
function linkCount(text: string): number {
  return text.match(URL_LIKE)?.length ?? 0;
}

/**
 * Basic abuse protection for the inquiry form (INQ-6): a hidden field a person
 * never fills, a minimum fill time, a few signs of link spam, and a limit on
 * how many inquiries one browser session can send in an hour.
 *
 * `attempts` is the time of each earlier accepted inquiry from this browser
 * session. Live mode adds server-side limits on top of the same rules.
 */
export function checkInquiryAbuse(
  input: { honeypot: string; openedAt: string; name: string; message: string; attempts: readonly IsoDateTime[] },
  now: Date,
  settings: Pick<Settings, 'inquiryRateLimitPerHour' | 'inquiryMinFillSeconds'>,
): AbuseVerdict {
  if (input.honeypot.trim() !== '') return { ok: false, reason: 'honeypot' };

  const opened = Date.parse(input.openedAt);
  const elapsed = now.getTime() - opened;
  // A missing or future start time is treated as too fast: a real form always has a real one.
  if (Number.isNaN(opened) || elapsed < settings.inquiryMinFillSeconds * 1000) {
    return { ok: false, reason: 'too_fast' };
  }

  if (linkCount(input.message) > MAX_LINKS_IN_MESSAGE || linkCount(input.name) > 0) {
    return { ok: false, reason: 'spam_content' };
  }

  const windowStart = now.getTime() - HOUR_MS;
  const recent = input.attempts.map((at) => Date.parse(at)).filter((t) => !Number.isNaN(t) && t > windowStart);
  if (recent.length >= settings.inquiryRateLimitPerHour) {
    const oldest = Math.min(...recent);
    return { ok: false, reason: 'rate_limited', retryAt: new Date(oldest + HOUR_MS).toISOString() };
  }
  return { ok: true };
}

/** Keeps only the attempts that still count toward the hourly limit. */
export function pruneAttempts<T extends { at: IsoDateTime }>(attempts: readonly T[], now: Date): T[] {
  const windowStart = now.getTime() - HOUR_MS;
  return attempts.filter((a) => Date.parse(a.at) > windowStart);
}
